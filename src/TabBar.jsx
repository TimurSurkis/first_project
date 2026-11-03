import { useEffect, useRef } from 'react'
import { LuX } from 'react-icons/lu'
import { useTranslation } from './i18n/context.js'

function TabBar({ docs, activeId, onActivate, onClose }) {
  const { t } = useTranslation()
  const activeRef = useRef(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  return (
    <div className="tabbar" role="tablist" aria-orientation="vertical" aria-label={t('tabs.list')}>
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
            onClick={() => onActivate(doc.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onActivate(doc.id)
              }
            }}
          >
            <span className="tab-label">
              {doc.docName}
              {dirty ? ' *' : ''}
            </span>
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
    </div>
  )
}

export default TabBar
