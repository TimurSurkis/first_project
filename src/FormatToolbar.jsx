import { formatCommands, headingLevels, setHeading } from './markdownCommands.js'

function FormatToolbar({ onRun }) {
  function handleHeadingChange(event) {
    const level = Number(event.target.value)
    if (level) onRun((view) => setHeading(view, level))
  }

  return (
    <div className="formatbar">
      <select value="" onChange={handleHeadingChange} title="Заголовок">
        <option value="">Заголовок</option>
        {headingLevels.map((level) => (
          <option key={level} value={level}>
            H{level}
          </option>
        ))}
      </select>
      {formatCommands.map((command) => (
        <button
          key={command.label}
          type="button"
          title={command.title}
          onClick={() => onRun(command.run)}
        >
          {command.label}
        </button>
      ))}
    </div>
  )
}

export default FormatToolbar
