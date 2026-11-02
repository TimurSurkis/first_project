import { LuFileCode, LuTextCursorInput } from 'react-icons/lu'

function countWords(text) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function StatusBar({ text, cursor, format }) {
  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        <span className="statusbar-item">
          <LuTextCursorInput aria-hidden="true" />
          Ln {cursor.line}, Col {cursor.col}
        </span>
      </div>
      <div className="statusbar-group">
        <span>Слов: {countWords(text)}</span>
        <span>Символов: {text.length}</span>
        <span>Строк: {text.split('\n').length}</span>
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
