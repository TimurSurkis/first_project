import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import type { Command } from '@codemirror/view'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LuColumns2, LuEye, LuPanelLeft, LuPenLine } from 'react-icons/lu'
import IconButton from './IconButton'
import StatusBar from './StatusBar'
import FormatToolbar from './FormatToolbar'
import SettingsDialog from './SettingsDialog'
import Sidebar from './Sidebar'
import DocumentEditor from './DocumentEditor'
import AuthDialog from './AuthDialog'
import FileLibrary from './FileLibrary'
import I18nProvider from './i18n/I18nProvider'
import { useTranslation } from './i18n/context'
import { createMarkdownKeymap } from './markdownCommands'
import { findLanguage } from './languages'
import { loadSettings, saveSettings } from './settings'
import { ApiError, authApi, documentsApi } from './api/client'
import { CloudWorkspace, isDirty } from './cloudWorkspace'
import { download } from './download'
import type { AuthResponse, DocumentSummary } from '../shared/api'
import type { DocumentId, EditorSettings, SettingsPatch, ViewMode } from './types'
import type { MenuCommand } from '../shared/electron-api'
import './App.css'

function syncScroll(from: HTMLElement, to: HTMLElement) {
	const fromMax = from.scrollHeight - from.clientHeight
	const toMax = to.scrollHeight - to.clientHeight
	if (fromMax > 0 && toMax > 0) {
		const target = (from.scrollTop / fromMax) * toMax
		if (Math.abs(to.scrollTop - target) > 1) to.scrollTop = target
	}
}

interface EditorProps {
	settings: EditorSettings
	onSettings: (patch: SettingsPatch) => void
	auth: AuthResponse
	enabled: boolean
	onDirty: (dirty: boolean) => void
	onLogout: () => void
}

function Editor({ settings, onSettings, auth, enabled, onDirty, onLogout }: EditorProps) {
	const { t } = useTranslation()
	const workspace = useMemo(() => new CloudWorkspace(documentsApi), [])
	const { docs, activeId } = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot)
	const doc = docs.find((item) => item.id === activeId)
	const [showSettings, setShowSettings] = useState(false)
	const [library, setLibrary] = useState<'files' | 'trash' | null>(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const creationBusy = useRef(false)
	const autosaves = useRef(new Map<number, { text: string; name: string; version: number; timer: ReturnType<typeof setTimeout> }>())
	const inputRef = useRef<HTMLInputElement>(null)
	const editorRefs = useRef<Record<DocumentId, ReactCodeMirrorRef | null>>({})
	const previewRef = useRef<HTMLDivElement>(null)
	const formatKeymap = useMemo(() => createMarkdownKeymap(t), [t])
	const isMarkdown = /\.(md|markdown)$/i.test(doc?.docName ?? '')
	const mode = isMarkdown ? doc?.mode ?? 'edit' : 'edit'
	const showEditor = mode !== 'preview'
	const showPreview = mode !== 'edit'
	const language = findLanguage(doc?.docName)
	const dirty = docs.some((item) => isDirty(item) || ['saving', 'error', 'conflict'].includes(item.status))

	useEffect(() => { workspace.connect(); return () => workspace.dispose() }, [workspace])
	useEffect(() => {
		workspace.paused = !enabled
		if (enabled) {
			for (const item of workspace.getSnapshot().docs) {
				if (item.status === 'error') void workspace.save(item.id)
			}
			void workspace.refresh()
		}
	}, [enabled, workspace, auth.expiresAt])
	useEffect(() => {
		const queue = autosaves.current
		const eligible = enabled ? docs.filter((item) => item.status === 'dirty' && isDirty(item)) : []
		for (const [id, scheduled] of queue) {
			const current = eligible.find((item) => item.id === id)
			if (!current || current.text !== scheduled.text || current.docName !== scheduled.name || current.version !== scheduled.version) {
				clearTimeout(scheduled.timer); queue.delete(id)
			}
		}
		for (const item of eligible) {
			if (queue.has(item.id)) continue
			const timer = setTimeout(() => { queue.delete(item.id); void workspace.save(item.id) }, 800)
			queue.set(item.id, { text: item.text, name: item.docName, version: item.version, timer })
		}
	}, [docs, enabled, workspace])
	useEffect(() => {
		const queue = autosaves.current
		return () => { for (const job of queue.values()) clearTimeout(job.timer); queue.clear() }
	}, [])
	useEffect(() => {
		onDirty(dirty)
		window.api?.setDirty(dirty)
		const warn = (event: BeforeUnloadEvent) => {
			if (dirty) { event.preventDefault(); event.returnValue = '' }
		}
		window.addEventListener('beforeunload', warn)
		return () => window.removeEventListener('beforeunload', warn)
	}, [dirty, onDirty])
	useEffect(() => {
		const refresh = () => { if (enabled) void workspace.refresh() }
		window.addEventListener('focus', refresh)
		return () => window.removeEventListener('focus', refresh)
	}, [workspace, enabled])
	useEffect(() => { window.api?.setCanExportHtml(isMarkdown) }, [isMarkdown])

	const registerEditor = useCallback((id: number, node: ReactCodeMirrorRef | null) => { editorRefs.current[id] = node }, [])
	const handleTextChange = useCallback((id: number, text: string) => workspace.edit(id, { text }), [workspace])
	const handleCursorChange = useCallback((id: number, cursor: { line: number; col: number }) => {
		const current = workspace.getSnapshot().docs.find((item) => item.id === id)?.cursor
		if (current?.line !== cursor.line || current?.col !== cursor.col) workspace.patch(id, { cursor })
	}, [workspace])

	async function perform(work: () => Promise<unknown>) {
		if (!enabled || creationBusy.current) return
		creationBusy.current = true
		setError(''); setBusy(true)
		try { await work() }
		catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
		finally { creationBusy.current = false; setBusy(false) }
	}
	function newFile() {
		void perform(() => workspace.create(`${t('doc.untitled')}.md`))
	}
	function closeDocument(id: number) {
		const item = docs.find((candidate) => candidate.id === id)
		if (!item) return
		if (item.status === 'saving') { setError(t('cloud.waitSaving')); return }
		if ((isDirty(item) || item.status === 'error' || item.status === 'conflict') && !window.confirm(t('confirm.closeTab', { name: item.docName }))) return
		workspace.close(id)
	}
	function renameDocument(id: number, input: string) {
		const trimmed = input.trim()
		const name = /\.[^./\\]+$/.test(trimmed) ? trimmed : `${trimmed}.txt`
		if (!trimmed) return
		if (name.length > 255 || /[\\/:*?"<>|]/.test(name) || [...name].some((char) => char.charCodeAt(0) < 32) || trimmed === '.' || trimmed === '..') { setError(t('alert.invalidName')); return }
		workspace.edit(id, { docName: name })
	}
	async function exportHtml() {
		if (!doc || !isMarkdown) return
		const { createHtmlExport } = await import('./exportHtml')
		const result = createHtmlExport(doc.text, doc.docName, settings.language)
		download(result.content, result.defaultName, 'text/html;charset=utf-8')
	}
	async function mutate(item: DocumentSummary, action: 'trash' | 'restore' | 'delete') {
		if (action === 'delete' && !window.confirm(t('cloud.confirmDelete', { name: item.name }))) return
		const opened = docs.find((candidate) => candidate.id === item.id)
		if (action === 'trash' && opened && isDirty(opened) && !window.confirm(t('cloud.confirmTrash', { name: item.name }))) return
		await workspace.mutate(item, action)
	}
	function command(command: MenuCommand) {
		if (!enabled || showSettings || library) return
		if (command === 'new') newFile()
		if (command === 'open') setLibrary('files')
		if (command === 'save' && doc) void workspace.save(doc.id)
		if (command === 'save-as' && doc) void perform(() => workspace.copy(doc.id))
		if (command === 'export-html') void perform(exportHtml)
		if (command === 'close-tab' && doc) closeDocument(doc.id)
		if (command === 'next-tab') workspace.cycle(1)
		if (command === 'prev-tab') workspace.cycle(-1)
	}
	useEffect(() => window.api?.onMenuCommand(command))
	useEffect(() => {
		const keydown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || !enabled || library || showSettings) return
			if (event.key === '\\') { event.preventDefault(); onSettings({ sidebarOpen: !settings.sidebarOpen }); return }
			// Native Electron accelerators already dispatch these commands.
			if (window.api) return
			const key = event.key.toLowerCase()
			const action: MenuCommand | undefined = key === 'n' ? 'new' : key === 'o' ? 'open' : key === 's' ? event.shiftKey ? 'save-as' : 'save' : key === 'w' ? 'close-tab' : key === 'tab' ? event.shiftKey ? 'prev-tab' : 'next-tab' : undefined
			if (action) { event.preventDefault(); command(action) }
		}
		window.addEventListener('keydown', keydown)
		return () => window.removeEventListener('keydown', keydown)
	})
	useEffect(() => {
		const scroller = activeId === null ? null : editorRefs.current[activeId]?.view?.scrollDOM
		const preview = previewRef.current
		if (mode !== 'split' || !scroller || !preview) return
		const fromEditor = () => syncScroll(scroller, preview)
		const fromPreview = () => syncScroll(preview, scroller)
		scroller.addEventListener('scroll', fromEditor); preview.addEventListener('scroll', fromPreview)
		return () => { scroller.removeEventListener('scroll', fromEditor); preview.removeEventListener('scroll', fromPreview) }
	}, [mode, activeId])
	function runFormat(action: Command) {
		const view = doc && editorRefs.current[doc.id]?.view
		if (view) { action(view); view.focus() }
	}
	return <div className="app">
		<input ref={inputRef} type="file" hidden onChange={(event) => {
			const file = event.target.files?.[0]
			event.target.value = ''
			if (file) void perform(async () => { workspace.accept(await documentsApi.import(file)) })
		}} />
		<div className="app-body">
			{settings.sidebarOpen ? <Sidebar width={settings.sidebarWidth} docs={docs} activeId={activeId}
				onNew={newFile} onOpen={() => setLibrary('files')} onSave={() => { if (doc) void workspace.save(doc.id) }}
				onSaveAs={() => { if (doc) void perform(() => workspace.copy(doc.id)) }}
				onImport={() => inputRef.current?.click()} onTrash={() => setLibrary('trash')}
				onDownload={() => { if (doc) download(doc.text, doc.docName) }}
				canExportHtml={isMarkdown} onExportHtml={() => { void perform(exportHtml) }}
				onActivate={(id) => workspace.activate(id)} onCloseDocument={closeDocument} onRename={renameDocument}
				onOpenSettings={() => setShowSettings(true)} onToggle={() => onSettings({ sidebarOpen: false })}
				onResize={(sidebarWidth) => onSettings({ sidebarWidth })}
				email={auth.user.email} onLogout={onLogout}
			/> : <div className="sidebar-rail"><IconButton icon={LuPanelLeft} title={t('sidebar.toggle')} onClick={() => onSettings({ sidebarOpen: true })} /></div>}
			<main className="app-main" aria-busy={busy}>
				{error && <div className="cloud-notice cloud-error" role="alert">{error}<button onClick={() => setError('')}>{t('common.close')}</button></div>}
				{doc ? <>
					<div className="cloud-notice" role="status"><span>{doc.docName} · {t(`cloud.status.${doc.status}`)} · v{doc.version}</span>
						{doc.status === 'error' && <button onClick={() => { void workspace.save(doc.id) }}>{t('cloud.retry')}</button>}
					</div>
					{doc.status === 'error' && doc.error && <div className="cloud-notice cloud-error" role="alert">{doc.error}</div>}
					{doc.status === 'conflict' && <div className="cloud-notice conflict" role="alert"><span>{t('cloud.conflict')}</span>
						<button onClick={() => { if (window.confirm(t('cloud.confirmReload'))) void perform(() => workspace.reload(doc.id)) }}>{t('cloud.loadServer')}</button>
						<button onClick={() => { void perform(() => workspace.copy(doc.id)) }}>{t('cloud.saveCopy')}</button>
					</div>}
					{isMarkdown && <div className="formatrow">{showEditor && <FormatToolbar onRun={runFormat} />}<div className="formatrow-modes">
						{([{ id: 'edit', icon: LuPenLine }, { id: 'split', icon: LuColumns2 }, { id: 'preview', icon: LuEye }] as const).map((item) => <IconButton key={item.id} icon={item.icon} title={t(`mode.${item.id}`)} pressed={mode === item.id} onClick={() => workspace.patch(doc.id, { mode: item.id as ViewMode })} />)}
					</div></div>}
					<div className={`workspace${mode === 'split' ? ' split' : ''}`} style={{ '--editor-font-size': `${settings.fontSize}px` } as CSSProperties}>
						{docs.map((item) => <DocumentEditor key={item.id} doc={item} visible={item.id === activeId && showEditor} settings={settings} formatKeymap={formatKeymap} registerEditor={registerEditor} onTextChange={handleTextChange} onCursorChange={handleCursorChange} />)}
						{showPreview && <div className="preview" ref={previewRef}><ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.text}</ReactMarkdown></div>}
					</div>
					<StatusBar text={doc.text} cursor={doc.cursor} format={language.name === 'plain-text' ? t('status.plainText') : language.name} />
				</> : <div className="cloud-empty"><h1>{t('cloud.welcome')}</h1><p>{t('cloud.noOpen')}</p><button onClick={() => setLibrary('files')}>{t('cloud.allFiles')}</button><button disabled={busy} onClick={newFile}>{t('toolbar.new')}</button></div>}
			</main>
		</div>
		{showSettings && <SettingsDialog settings={settings} onChange={onSettings} onClose={() => setShowSettings(false)} />}
		{library && <FileLibrary key={library} deleted={library === 'trash'} onOpen={(id) => workspace.open(id)} onMutate={mutate} onClose={() => setLibrary(null)} />}
	</div>
}

function CloudApp({ settings, onSettings }: { settings: EditorSettings; onSettings: (patch: SettingsPatch) => void }) {
	const { t } = useTranslation()
	const [auth, setAuth] = useState<AuthResponse | null>(null)
	const [required, setRequired] = useState(false)
	const [loading, setLoading] = useState(true)
	const [signingOut, setSigningOut] = useState(false)
	const [error, setError] = useState('')
	const dirtyRef = useRef(false)
	const onDirty = useCallback((dirty: boolean) => { dirtyRef.current = dirty }, [])
	const restore = useCallback(async () => {
		setLoading(true); setError('')
		try { setAuth(await authApi.me()); setRequired(false) }
		catch (failure) {
			if (failure instanceof ApiError && failure.status === 401) setRequired(true)
			else setError(failure instanceof Error ? failure.message : String(failure))
		} finally { setLoading(false) }
	}, [])
	// Initial session discovery is synchronization with the server, not derived UI state.
	// eslint-disable-next-line react/set-state-in-effect
	useEffect(() => { void restore() }, [restore])
	useEffect(() => {
		const expire = () => setRequired(true)
		const renewed = (event: Event) => {
			const next = (event as CustomEvent<AuthResponse>).detail
			setAuth((previous) => previous?.user.id === next.user.id ? next : previous)
		}
		window.addEventListener('editor:unauthorized', expire)
		window.addEventListener('editor:session-refreshed', renewed)
		return () => {
			window.removeEventListener('editor:unauthorized', expire)
			window.removeEventListener('editor:session-refreshed', renewed)
		}
	}, [])
	useEffect(() => {
		if (!auth || required) return
		const timer = setTimeout(() => setRequired(true), Math.max(0, new Date(auth.expiresAt).getTime() - Date.now()))
		return () => clearTimeout(timer)
	}, [auth, required])
	async function logout() {
		if (dirtyRef.current && !window.confirm(t('auth.confirmDiscard'))) return
		// Pause the workspace before changing the session cookie.
		setRequired(true)
		setSigningOut(true)
		try { await authApi.logout(); setAuth(null); dirtyRef.current = false; window.api?.setDirty(false) }
		catch (failure) {
			if (failure instanceof ApiError && failure.status === 401) return
			setError(failure instanceof Error ? failure.message : String(failure)); setRequired(false)
		}
		finally { setSigningOut(false) }
	}
	function authenticated(next: AuthResponse) {
		if (auth && next.user.id !== auth.user.id && dirtyRef.current && !window.confirm(t('auth.confirmDiscard'))) return
		setAuth(next); setRequired(false); setError('')
	}
	return <>
		{auth && <Editor key={auth.user.id} auth={auth} settings={settings} onSettings={onSettings} enabled={!required} onDirty={onDirty} onLogout={() => { void logout() }} />}
		{!auth && !required && <div className="cloud-empty">{loading ? t('cloud.loading') : <><p role="alert">{error}</p><button onClick={() => { void restore() }}>{t('cloud.retry')}</button></>}</div>}
		{auth && error && !required && <div role="alert" className="cloud-notice cloud-error">{error}</div>}
		{required && !signingOut && <AuthDialog expired={auth !== null} onSuccess={authenticated} />}
		{signingOut && <div className="dialog-backdrop auth-backdrop" role="status">{t('cloud.loading')}</div>}
	</>
}

export default function App() {
	const [settings, setSettings] = useState<EditorSettings>(loadSettings)
	useEffect(() => {
		saveSettings(settings)
		document.documentElement.dataset.theme = settings.theme
		document.documentElement.lang = settings.language
		document.documentElement.style.setProperty('--accent', settings.accentColor)
		window.api?.setLanguage(settings.language)
	}, [settings])
	const update = useCallback((patch: SettingsPatch) => setSettings((current) => ({ ...current, ...patch })), [])
	return <I18nProvider language={settings.language}><CloudApp settings={settings} onSettings={update} /></I18nProvider>
}
