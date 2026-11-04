import { useEffect, useRef, useState } from 'react'
import { LuPlus, LuX } from 'react-icons/lu'
import IconButton from './IconButton.jsx'
import { useTranslation } from './i18n/context.js'

function TabBar({ docs, activeId, onActivate, onClose, onNew, onRename }) {
  const { t } = useTranslation()
  const activeRef = useRef(null)
  const renamingRef = useRef(null)
  const [renamingId, setRenamingId] = useState(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  function startRename(doc) {
    renamingRef.current = doc.id
    setDraft(doc.docName)
    setRenamingId(doc.id)
  }

  function commitRename() {
    const id = renamingRef.current
    if (id === null) return
    renamingRef.current = null
    setRenamingId(null)
    onRename(id, draft)
  }

  function cancelRename() {
    renamingRef.current = null
    setRenamingId(null)
  }

  return (
    <div
      className="tabbar"
      role="tablist"
      aria-label={t('tabs.list')}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) onNew()
      }}
    >
      {docs.map((doc) => {
        const active = doc.id === activeId
        const dirty = doc.text !== doc.savedText
        return (
          <div
            key={doc.id}
            ref={active ? activeRef : undefined}
            className={`tab${active ? ' active' : ''}`}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            title={t('title.rename')}
            onClick={() => onActivate(doc.id)}
            onDoubleClick={() => startRename(doc)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onActivate(doc.id)
              }
            }}
          >
            {renamingId === doc.id ? (
              <input
                className="tab-input"
                value={draft}
                autoFocus
                onFocus={(event) => event.target.select()}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitRename}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') commitRename()
                  if (event.key === 'Escape') cancelRename()
                }}
              />
            ) : (
              <span className="tab-label">
                {doc.docName}
                {dirty ? ' *' : ''}
              </span>
            )}
            <button
              type="button"
              className="tab-close"
              title={t('tabs.close')}
              aria-label={t('tabs.close')}
              onClick={(event) => {
                event.stopPropagation()
                onClose(doc.id)
              }}
            >
              <LuX aria-hidden="true" />
            </button>
          </div>
        )
      })}
      <IconButton icon={LuPlus} title={t('tabs.new')} onClick={onNew} />
    </div>
  )
}

export default TabBar
