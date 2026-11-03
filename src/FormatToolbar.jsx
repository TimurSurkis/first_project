import { LuHeading } from 'react-icons/lu'
import Dropdown from './Dropdown.jsx'
import IconButton from './IconButton.jsx'
import { formatCommands, headingLevels, setHeading } from './markdownCommands.js'

const GROUPS = ['inline', 'block', 'insert']
const HEADING_OPTIONS = headingLevels.map((level) => ({ value: level, label: `H${level}` }))

function FormatToolbar({ onRun }) {
  return (
    <div className="formatbar">
      <div className="toolbar-group">
        <LuHeading className="formatbar-icon" aria-hidden="true" />
        <Dropdown
          options={HEADING_OPTIONS}
          value={null}
          placeholder="Заголовок"
          width={120}
          onChange={(level) => onRun((view) => setHeading(view, level))}
        />
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
