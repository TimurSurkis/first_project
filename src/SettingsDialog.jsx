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
import { ACCENT_COLORS, FONT_SIZES, TAB_SIZES, THEMES } from './settings.js'
import { useEffect } from 'react'

function SettingsDialog({ settings, onChange, onClose }) {
	useEffect(() => {
		const handleKeydown = (e) => {
			if (e.key === 'Escape') onClose()
		}

		window.addEventListener('keydown', handleKeydown)
		return () => window.removeEventListener('keydown', handleKeydown)
	}, [])

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

				<label className="field">
					<span className="field-label">
						<LuSunMoon aria-hidden="true" />
						Тема
					</span>
					<select
						value={settings.theme}
						onChange={(event) =>
							onChange({ theme: event.target.value })
						}
					>
						{THEMES.map((theme) => (
							<option key={theme.value} value={theme.value}>
								{theme.label}
							</option>
						))}
					</select>
				</label>

				<label className="field">
					<span className="field-label">
						<LuPalette aria-hidden="true" />
						Цвет акцента
					</span>
					<select
						value={settings.accentColor}
						onChange={(event) =>
							onChange({ accentColor: event.target.value })
						}
					>
						{ACCENT_COLORS.map((color) => (
							<option key={color.value} value={color.value}>
								{color.label}
							</option>
						))}
					</select>
				</label>

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

				<label className="field">
					<span className="field-label">
						<LuType aria-hidden="true" />
						Размер шрифта
					</span>
					<select
						value={settings.fontSize}
						onChange={(event) =>
							onChange({ fontSize: Number(event.target.value) })
						}
					>
						{FONT_SIZES.map((size) => (
							<option key={size} value={size}>
								{size} px
							</option>
						))}
					</select>
				</label>

				<label className="field">
					<span className="field-label">
						<LuIndentIncrease aria-hidden="true" />
						Размер табуляции (в пробелах)
					</span>
					<select
						value={settings.tabSize}
						onChange={(event) =>
							onChange({ tabSize: Number(event.target.value) })
						}
					>
						{TAB_SIZES.map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</select>
				</label>
			</div>
		</div>
	)
}

export default SettingsDialog
