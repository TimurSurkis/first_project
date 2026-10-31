function countWords(text) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function StatusBar({ text, cursor, format }) {
  return (
    <footer className="statusbar">
      <span>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span>
        Слов: {countWords(text)} · Символов: {text.length} · Строк: {text.split('\n').length}
      </span>
      <span>
        {format} · UTF-8
      </span>
    </footer>
  )
}

export default StatusBar
