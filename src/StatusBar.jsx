import { LuFileCode, LuTextCursorInput } from 'react-icons/lu'
import { useTranslation } from './i18n/context.js'

function countWords(text) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function StatusBar({ text, cursor, format }) {
  const { t } = useTranslation()

  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        <span className="statusbar-item">
          <LuTextCursorInput aria-hidden="true" />
          {t('status.cursor', { line: cursor.line, col: cursor.col })}
        </span>
      </div>
      <div className="statusbar-group">
        <span>{t('status.words', { count: countWords(text) })}</span>
        <span>{t('status.chars', { count: text.length })}</span>
        <span>{t('status.lines', { count: text.split('\n').length })}</span>
      </div>
      <div className="statusbar-group">
        <span className="statusbar-item">
          <LuFileCode aria-hidden="true" />
          {format}
        </span>
        <span>UTF-8</span>
      </div>
    </footer>
  )
}

export default StatusBar
