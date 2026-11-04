import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
	LuColumns2,
	LuEye,
	LuPanelLeft,
	LuPanelLeftClose,
	LuPenLine,
} from 'react-icons/lu'
import IconButton from './IconButton.jsx'
import StatusBar from './StatusBar.jsx'
import FormatToolbar from './FormatToolbar.jsx'
import SettingsDialog from './SettingsDialog.jsx'
import EditableTitle from './EditableTitle.jsx'
import Sidebar from './Sidebar.jsx'
import DocumentEditor from './DocumentEditor.jsx'
import I18nProvider from './i18n/I18nProvider.jsx'
import { useTranslation } from './i18n/context.js'
import { createMarkdownKeymap } from './markdownCommands.js'
import { findLanguage } from './languages.js'
import { loadSettings, saveSettings } from './settings.js'
import './App.css'

const api = window.api

let nextDocumentId = 1

function createDocument(fields) {
	return {
		id: nextDocumentId++,
		text: '',
		savedText: '',
		filePath: null,
		mode: 'edit',
		cursor: { line: 1, col: 1 },
		...fields,
	}
}

function getBaseName(filePath) {
	return filePath.split(/[\\/]/).pop()
}

function isMarkdownFile(name) {
	return /\.md$/i.test(name)
}

function normalizeFileName(input, t) {
	const name = input.trim()
	if (!name) return null
	if (/[\\/:*?"<>|]/.test(name)) {
		window.alert(t('alert.invalidName'))
		return null
	}
	return /\.[^./\\]+$/.test(name) ? name : `${name}.txt`
}

function nextUntitledName(docs, t) {
	const base = t('doc.untitled')
	const names = new Set(docs.map((item) => item.docName))
	if (!names.has(`${base}.txt`)) return `${base}.txt`

	let index = 2
	while (names.has(`${base} ${index}.txt`)) index++
	return `${base} ${index}.txt`
}

function syncScroll(from, to) {
	const fromMax = from.scrollHeight - from.clientHeight
	const toMax = to.scrollHeight - to.clientHeight
	if (fromMax <= 0 || toMax <= 0) return

	const target = (from.scrollTop / fromMax) * toMax
	if (Math.abs(to.scrollTop - target) > 1) to.scrollTop = target
}

function Editor({ settings, setSettings }) {
	const { t } = useTranslation()
	const [tabs, setTabs] = useState(() => {
		const first = createDocument({ docName: nextUntitledName([], t) })
		return { docs: [first], activeId: first.id }
	})
	const [showSettings, setShowSettings] = useState(false)

	const editorRefs = useRef({})
	const previewRef = useRef(null)

	const { docs, activeId } = tabs
	const doc = docs.find((item) => item.id === activeId)

	const isDirty = doc.text !== doc.savedText
	const isMarkdown = isMarkdownFile(doc.docName)
	const currentMode = isMarkdown ? doc.mode : 'edit'
	const showEditor = currentMode !== 'preview'
	const showPreview = currentMode !== 'edit'
	const isSplit = currentMode === 'split'

	const modes = [
		{ id: 'edit', label: t('mode.edit'), icon: LuPenLine },
		{ id: 'split', label: t('mode.split'), icon: LuColumns2 },
		{ id: 'preview', label: t('mode.preview'), icon: LuEye },
	]

	const formatKeymap = useMemo(() => createMarkdownKeymap(t), [t])
	const docLanguage = findLanguage(doc.docName)
	const formatLabel =
		docLanguage.name === 'plain-text'
			? t('status.plainText')
			: docLanguage.name

	const updateDocument = useCallback((id, patch) => {
		setTabs((current) => ({
			...current,
			docs: current.docs.map((item) =>
				item.id === id ? { ...item, ...patch } : item,
			),
		}))
	}, [])

	const handleTextChange = useCallback(
		(id, text) => updateDocument(id, { text }),
		[updateDocument],
	)
	const handleCursorChange = useCallback(
		(id, cursor) => updateDocument(id, { cursor }),
		[updateDocument],
	)
	const registerEditor = useCallback((id, node) => {
		editorRefs.current[id] = node
	}, [])

	function runFormat(command) {
		const view = editorRefs.current[doc.id]?.view
		if (!view) return
		command(view)
		view.focus()
	}

	function setMode(mode) {
		updateDocument(doc.id, { mode })
	}

	function newFile() {
		setTabs((current) => {
			const next = createDocument({
				docName: nextUntitledName(current.docs, t),
			})
			return { docs: [...current.docs, next], activeId: next.id }
		})
	}

	function activateDocument(id) {
		setTabs((current) => ({ ...current, activeId: id }))
	}

	function cycleDocument(step) {
		setTabs((current) => {
			const index = current.docs.findIndex(
				(item) => item.id === current.activeId,
			)
			const next =
				current.docs[
					(index + step + current.docs.length) % current.docs.length
				]
			return { ...current, activeId: next.id }
		})
	}

	function closeDocument(id) {
		const target = docs.find((item) => item.id === id)
		if (!target) return
		if (
			target.text !== target.savedText &&
			!window.confirm(t('confirm.closeTab', { name: target.docName }))
		) {
			return
		}

		setTabs((current) => {
			const index = current.docs.findIndex((item) => item.id === id)
			const remaining = current.docs.filter((item) => item.id !== id)
			if (remaining.length === 0) {
				const fresh = createDocument({
					docName: nextUntitledName([], t),
				})
				return { docs: [fresh], activeId: fresh.id }
			}
			if (current.activeId !== id) return { ...current, docs: remaining }
			const nextActive = remaining[Math.min(index, remaining.length - 1)]
			return { docs: remaining, activeId: nextActive.id }
		})
	}

	async function openFile() {
		const file = await api.openFile()
		if (!file) return

		if (file.imported) {
			setTabs((current) => {
				const next = createDocument({ docName: file.name, text: file.content, savedText: '' })
				return { docs: [...current.docs, next], activeId: next.id }
			})
			return
		}

		setTabs((current) => {
			const existing = current.docs.find(
				(item) => item.filePath === file.filePath,
			)
			if (existing) return { ...current, activeId: existing.id }

			const next = createDocument({
				docName: getBaseName(file.filePath),
				filePath: file.filePath,
				text: file.content,
				savedText: file.content,
			})
			return { docs: [...current.docs, next], activeId: next.id }
		})
	}

	async function saveFile(saveAs = false) {
		const { id, text: content, filePath, docName } = doc
		const result = await api.saveFile({
			content,
			filePath: saveAs ? null : filePath,
			defaultName: docName,
		})
		if (!result) return
		updateDocument(id, {
			filePath: result.filePath,
			docName: getBaseName(result.filePath),
			savedText: content,
		})
	}

	async function renameDocument(input) {
		const { id, filePath, docName } = doc
		const name = normalizeFileName(input, t)
		if (!name || name === docName) return

		if (!filePath) {
			updateDocument(id, { docName: name })
			return
		}

		const result = await api.renameFile({ filePath, newName: name })
		if (result.error) {
			window.alert(
				result.error === 'exists'
					? t('error.fileExists', { name })
					: result.error,
			)
			return
		}
		updateDocument(id, {
			filePath: result.filePath,
			docName: getBaseName(result.filePath),
		})
	}

	useEffect(() => {
		api.setDirty(docs.some((item) => item.text !== item.savedText))
	}, [docs])

	useEffect(() => {
		saveSettings(settings)
		document.documentElement.dataset.theme = settings.theme
		document.documentElement.lang = settings.language
		document.documentElement.style.setProperty(
			'--accent',
			settings.accentColor,
		)
		api.setLanguage(settings.language)
	}, [settings])

	function updateSettings(patch) {
		setSettings((current) => ({ ...current, ...patch }))
	}

	function toggleSidebar() {
		setSettings((current) => ({
			...current,
			sidebarOpen: !current.sidebarOpen,
		}))
	}

	useEffect(() => {
		const handleKeydown = (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
				event.preventDefault()
				setSettings((current) => ({
					...current,
					sidebarOpen: !current.sidebarOpen,
				}))
			}
		}

		window.addEventListener('keydown', handleKeydown)
		return () => window.removeEventListener('keydown', handleKeydown)
	}, [setSettings])

	useEffect(() => {
		return api.onMenuCommand((command) => {
			if (command === 'new') newFile()
			if (command === 'open') openFile()
			if (command === 'save') saveFile(false)
			if (command === 'save-as') saveFile(true)
			if (command === 'close-tab') closeDocument(doc.id)
			if (command === 'next-tab') cycleDocument(1)
			if (command === 'prev-tab') cycleDocument(-1)
		})
	})

	useEffect(() => {
		const editorScroller = editorRefs.current[activeId]?.view?.scrollDOM
		const preview = previewRef.current
		if (!isSplit || !editorScroller || !preview) return

		const onEditorScroll = () => syncScroll(editorScroller, preview)
		const onPreviewScroll = () => syncScroll(preview, editorScroller)

		editorScroller.addEventListener('scroll', onEditorScroll)
		preview.addEventListener('scroll', onPreviewScroll)
		return () => {
			editorScroller.removeEventListener('scroll', onEditorScroll)
			preview.removeEventListener('scroll', onPreviewScroll)
		}
	}, [isSplit, activeId])

	return (
		<div className="app">
			<div className="app-body">
				{settings.sidebarOpen && (
					<Sidebar
						width={settings.sidebarWidth}
						docs={docs}
						activeId={activeId}
						onNew={newFile}
						onOpen={openFile}
						onSave={() => saveFile(false)}
						onSaveAs={() => saveFile(true)}
						onActivate={activateDocument}
						onCloseDocument={closeDocument}
						onOpenSettings={() => setShowSettings(true)}
						onResize={(sidebarWidth) =>
							updateSettings({ sidebarWidth })
						}
					/>
				)}
				<div className="app-main">
					<header className="toolbar">
						<IconButton
							icon={
								settings.sidebarOpen
									? LuPanelLeftClose
									: LuPanelLeft
							}
							title={t('sidebar.toggle')}
							pressed={settings.sidebarOpen}
							onClick={toggleSidebar}
						/>
						{isMarkdown && (
							<div className="toolbar-group">
								{modes.map(({ id, label, icon }) => (
									<IconButton
										key={id}
										icon={icon}
										label={label}
										pressed={currentMode === id}
										onClick={() => setMode(id)}
									/>
								))}
							</div>
						)}
						<div className="toolbar-end">
							<EditableTitle
								key={doc.id}
								name={doc.docName}
								isDirty={isDirty}
								onRename={renameDocument}
							/>
						</div>
					</header>
					{isMarkdown && showEditor && (
						<FormatToolbar onRun={runFormat} />
					)}
					<div
						className={`workspace${isSplit ? ' split' : ''}`}
						style={{
							'--editor-font-size': `${settings.fontSize}px`,
						}}
					>
						{docs.map((item) => (
							<DocumentEditor
								key={item.id}
								doc={item}
								visible={item.id === activeId && showEditor}
								settings={settings}
								formatKeymap={formatKeymap}
								registerEditor={registerEditor}
								onTextChange={handleTextChange}
								onCursorChange={handleCursorChange}
							/>
						))}
						{showPreview && (
							<div className="preview" ref={previewRef}>
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{doc.text}
								</ReactMarkdown>
							</div>
						)}
					</div>
					<StatusBar
						text={doc.text}
						cursor={doc.cursor}
						format={formatLabel}
					/>
				</div>
			</div>
			{showSettings && (
				<SettingsDialog
					settings={settings}
					onChange={updateSettings}
					onClose={() => setShowSettings(false)}
				/>
			)}
		</div>
	)
}

function App() {
	const [settings, setSettings] = useState(loadSettings)

	return (
		<I18nProvider language={settings.language}>
			<Editor settings={settings} setSettings={setSettings} />
		</I18nProvider>
	)
}

export default App
