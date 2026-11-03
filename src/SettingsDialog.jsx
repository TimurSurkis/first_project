import {
	LuIndentIncrease,
	LuPalette,
	LuSettings,
	LuSunMoon,
	LuType,
	LuWrapText,
	LuX,
} from 'react-icons/lu'
import IconButton from './IconButton.jsx'
import Dropdown from './Dropdown.jsx'
import { ACCENT_COLORS, FONT_SIZES, TAB_SIZES, THEMES } from './settings.js'
import { useEffect } from 'react'

const ACCENT_OPTIONS = ACCENT_COLORS.map((color) => ({
	value: color.value,
	label: color.label,
	color: color.value,
}))
const FONT_SIZE_OPTIONS = FONT_SIZES.map((size) => ({ value: size, label: `${size} px` }))
const TAB_SIZE_OPTIONS = TAB_SIZES.map((size) => ({ value: size, label: String(size) }))

function SettingsDialog({ settings, onChange, onClose }) {
	useEffect(() => {
		const handleKeydown = (e) => {
			if (e.key === 'Escape') onClose()
		}

		window.addEventListener('keydown', handleKeydown)
		return () => window.removeEventListener('keydown', handleKeydown)
	}, [onClose])

	return (
		<div className="dialog-backdrop" onClick={onClose}>
			<div
				className="dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="settings-title"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="dialog-header">
					<h2 id="settings-title">
						<LuSettings aria-hidden="true" />
						Настройки редактора
					</h2>
					<IconButton icon={LuX} title="Закрыть" onClick={onClose} />
				</div>

				<div className="field">
					<span className="field-label">
						<LuSunMoon aria-hidden="true" />
						Тема
					</span>
					<Dropdown
						options={THEMES}
						value={settings.theme}
						onChange={(theme) => onChange({ theme })}
					/>
				</div>

				<div className="field">
					<span className="field-label">
						<LuPalette aria-hidden="true" />
						Цвет акцента
					</span>
					<Dropdown
						options={ACCENT_OPTIONS}
						value={settings.accentColor}
						onChange={(accentColor) => onChange({ accentColor })}
					/>
				</div>

				<label className="field">
					<span className="field-label">
						<LuWrapText aria-hidden="true" />
						Перенос длинных строк
					</span>
					<input
						type="checkbox"
						checked={settings.lineWrapping}
						onChange={(event) =>
							onChange({ lineWrapping: event.target.checked })
						}
					/>
				</label>

				<div className="field">
					<span className="field-label">
						<LuType aria-hidden="true" />
						Размер шрифта
					</span>
					<Dropdown
						options={FONT_SIZE_OPTIONS}
						value={settings.fontSize}
						onChange={(fontSize) => onChange({ fontSize })}
					/>
				</div>

				<div className="field">
					<span className="field-label">
						<LuIndentIncrease aria-hidden="true" />
						Размер табуляции (в пробелах)
					</span>
					<Dropdown
						options={TAB_SIZE_OPTIONS}
						value={settings.tabSize}
						onChange={(tabSize) => onChange({ tabSize })}
					/>
				</div>
			</div>
		</div>
	)
}

export default SettingsDialog
