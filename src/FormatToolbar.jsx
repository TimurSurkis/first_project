import { LuHeading } from 'react-icons/lu'
import IconButton from './IconButton.jsx'
import { formatCommands, headingLevels, setHeading } from './markdownCommands.js'

const GROUPS = ['inline', 'block', 'insert']

function FormatToolbar({ onRun }) {
  function handleHeadingChange(event) {
    const level = Number(event.target.value)
    if (level) onRun((view) => setHeading(view, level))
  }

  return (
    <div className="formatbar">
      <div className="toolbar-group">
        <LuHeading className="formatbar-icon" aria-hidden="true" />
        <select value="" onChange={handleHeadingChange} title="Заголовок">
          <option value="">Заголовок</option>
          {headingLevels.map((level) => (
            <option key={level} value={level}>
              H{level}
            </option>
          ))}
        </select>
      </div>
      {GROUPS.map((group) => (
        <div className="toolbar-group" key={group}>
          {formatCommands
            .filter((command) => command.group === group)
            .map((command) => (
              <IconButton
                key={command.id}
                icon={command.icon}
                title={command.title}
                onClick={() => onRun(command.run)}
              />
            ))}
        </div>
      ))}
    </div>
  )
}

export default FormatToolbar
