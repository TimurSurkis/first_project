import { useRef } from 'react'
import { LuFilePlus, LuFolderOpen, LuSave, LuSaveAll, LuSettings } from 'react-icons/lu'
import IconButton from './IconButton.jsx'
import TabBar from './TabBar.jsx'
import { useTranslation } from './i18n/context.js'
import { SIDEBAR_WIDTH } from './settings.js'

function clampWidth(width) {
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
  onOpenSettings,
  onResize,
}) {
  const { t } = useTranslation()
  const panelRef = useRef(null)

  function handleResizePointerDown(event) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelRef.current.offsetWidth
    let nextWidth = startWidth

    const handleMove = (moveEvent) => {
      nextWidth = clampWidth(startWidth + moveEvent.clientX - startX)
      panelRef.current.style.width = `${nextWidth}px`
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      onResize(nextWidth)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
  }

  function handleResizeReset() {
    panelRef.current.style.width = `${SIDEBAR_WIDTH.default}px`
    onResize(SIDEBAR_WIDTH.default)
  }

  return (
    <aside ref={panelRef} className="sidebar" style={{ width }}>
      <div className="sidebar-section sidebar-actions">
        <IconButton icon={LuFilePlus} label={t('toolbar.new')} onClick={onNew} />
        <IconButton icon={LuFolderOpen} label={t('toolbar.open')} onClick={onOpen} />
        <IconButton icon={LuSave} label={t('toolbar.save')} onClick={onSave} />
        <IconButton icon={LuSaveAll} label={t('toolbar.saveAs')} onClick={onSaveAs} />
      </div>

      <div className="sidebar-list">
        <div className="sidebar-heading">{t('tabs.list')}</div>
        <TabBar
          docs={docs}
          activeId={activeId}
          onActivate={onActivate}
          onClose={onCloseDocument}
        />
      </div>

      <div className="sidebar-footer">
        <IconButton icon={LuSettings} label={t('toolbar.settings')} onClick={onOpenSettings} />
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
