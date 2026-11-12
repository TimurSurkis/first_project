import { useMemo } from 'react'
import type { Command } from '@codemirror/view'
import { LuHeading } from 'react-icons/lu'
import Dropdown from './Dropdown.tsx'
import IconButton from './IconButton.tsx'
import { useTranslation } from './i18n/context.ts'
import { createFormatCommands, headingLevels, setHeading } from './markdownCommands.ts'

const GROUPS = ['inline', 'block', 'insert']
const HEADING_OPTIONS = headingLevels.map((level) => ({ value: level, label: `H${level}` }))

interface FormatToolbarProps {
	onRun: (command: Command) => void
}

function FormatToolbar({ onRun }: FormatToolbarProps) {
  const { t } = useTranslation()
  const commands = useMemo(() => createFormatCommands(t), [t])

  return (
    <div className="formatbar">
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
