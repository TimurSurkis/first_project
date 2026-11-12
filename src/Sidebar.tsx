import { useRef } from 'react'
import {
	LuFilePlus,
	LuFolderOpen,
	LuPanelLeftClose,
	LuSave,
	LuSaveAll,
	LuSettings,
} from 'react-icons/lu'
import IconButton from './IconButton.tsx'
import TabBar from './TabBar.tsx'
import { useTranslation } from './i18n/context.ts'
import { SIDEBAR_WIDTH } from './settings.ts'
import type { PointerEvent } from 'react'
import type { DocumentId, EditorDocument } from './types'

interface SidebarProps {
	width: number
	docs: EditorDocument[]
	activeId: DocumentId
	onNew: () => void
	onOpen: () => void
	onSave: () => void
	onSaveAs: () => void
	onActivate: (id: DocumentId) => void
	onCloseDocument: (id: DocumentId) => void
	onRename: (id: DocumentId, name: string) => void
	onOpenSettings: () => void
	onToggle: () => void
	onResize: (width: number) => void
}

function clampWidth(width: number): number {
	return Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width))
}

function Sidebar({
	width,
	docs,
	activeId,
	onNew,
	onOpen,
	onSave,
	onSaveAs,
	onActivate,
	onCloseDocument,
	onRename,
	onOpenSettings,
	onToggle,
	onResize,
}: SidebarProps) {
	const { t } = useTranslation()
	const panelRef = useRef<HTMLElement>(null)

	function handleResizePointerDown(event: PointerEvent<HTMLDivElement>): void {
		event.preventDefault()
		const panel = panelRef.current
		if (!panel) return
		const startX = event.clientX
		const startWidth = panel.offsetWidth
		let nextWidth = startWidth

		const handleMove = (moveEvent: globalThis.PointerEvent) => {
			nextWidth = clampWidth(startWidth + moveEvent.clientX - startX)
			panel.style.width = `${nextWidth}px`
		}
		const handleUp = () => {
			window.removeEventListener('pointermove', handleMove)
			onResize(nextWidth)
		}

		window.addEventListener('pointermove', handleMove)
		window.addEventListener('pointerup', handleUp, { once: true })
	}

	function handleResizeReset(): void {
		const panel = panelRef.current
		if (!panel) return
		panel.style.width = `${SIDEBAR_WIDTH.default}px`
		onResize(SIDEBAR_WIDTH.default)
	}

	return (
		<aside ref={panelRef} className="sidebar" style={{ width }}>
			<div className="sidebar-header">
				<IconButton
					icon={LuPanelLeftClose}
					title={t('sidebar.toggle')}
					onClick={onToggle}
				/>
			</div>

			<div className="sidebar-section sidebar-actions">
				<IconButton
					icon={LuFilePlus}
					label={t('toolbar.new')}
					onClick={onNew}
				/>
				<IconButton
					icon={LuFolderOpen}
					label={t('toolbar.open')}
					onClick={onOpen}
				/>
				<IconButton
					icon={LuSave}
					label={t('toolbar.save')}
					onClick={onSave}
				/>
				<IconButton
					icon={LuSaveAll}
					label={t('toolbar.saveAs')}
					onClick={onSaveAs}
				/>
			</div>

			<div className="sidebar-list">
				<div className="sidebar-heading">{t('tabs.list')}</div>
				<TabBar
					docs={docs}
					activeId={activeId}
					onActivate={onActivate}
					onClose={onCloseDocument}
					onRename={onRename}
				/>
			</div>

			<div className="sidebar-footer">
				<IconButton
					icon={LuSettings}
					label={t('toolbar.settings')}
					onClick={onOpenSettings}
				/>
			</div>

			<div
				className="sidebar-resizer"
				title={t('sidebar.resize')}
				onPointerDown={handleResizePointerDown}
				onDoubleClick={handleResizeReset}
			/>
		</aside>
	)
}

export default Sidebar
