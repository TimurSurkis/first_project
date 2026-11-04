import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuHeading } from 'react-icons/lu'
import Dropdown from './Dropdown.jsx'
import IconButton from './IconButton.jsx'
import { useTranslation } from './i18n/context.js'
import { createFormatCommands, headingLevels, setHeading } from './markdownCommands.js'

const GROUPS = ['inline', 'block', 'insert']
const HEADING_OPTIONS = headingLevels.map((level) => ({ value: level, label: `H${level}` }))
const EDGE_GAP = 8

function FormatToolbar({ onRun, left, top }) {
  const { t } = useTranslation()
  const commands = useMemo(() => createFormatCommands(t), [t])
  const ref = useRef(null)
  const [x, setX] = useState(left)

  useLayoutEffect(() => {
    const element = ref.current
    const container = element?.offsetParent
    if (!element || !container) {
      setX(left)
      return
    }

    const half = element.offsetWidth / 2
    const min = half + EDGE_GAP
    const max = Math.max(min, container.clientWidth - half - EDGE_GAP)
    setX(Math.min(Math.max(left, min), max))
  }, [left, top])

  return (
    <div
      ref={ref}
      className="formatbar-floating"
      style={{ left: x, top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="toolbar-group">
        <LuHeading className="formatbar-icon" aria-hidden="true" />
        <Dropdown
          options={HEADING_OPTIONS}
          value={null}
          placeholder={t('format.heading')}
          width={120}
          onChange={(level) => onRun((view) => setHeading(view, level))}
        />
      </div>
      {GROUPS.map((group) => (
        <div className="toolbar-group" key={group}>
          {commands
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
