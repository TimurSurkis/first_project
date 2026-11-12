import {
	LuIndentIncrease,
	LuLanguages,
	LuPalette,
	LuSettings,
	LuSunMoon,
	LuType,
	LuWrapText,
	LuX,
} from 'react-icons/lu'
import IconButton from './IconButton.tsx'
import Dropdown from './Dropdown.tsx'
import { useTranslation } from './i18n/context.ts'
import { LANGUAGES } from './i18n/translate.ts'
import { ACCENT_COLORS, FONT_SIZES, TAB_SIZES, THEMES } from './settings.ts'
import { useEffect, useMemo } from 'react'
import type { EditorSettings, SettingsPatch } from './types'

const FONT_SIZE_OPTIONS = FONT_SIZES.map((size) => ({ value: size, label: `${size} px` }))
const TAB_SIZE_OPTIONS = TAB_SIZES.map((size) => ({ value: size, label: String(size) }))

interface SettingsDialogProps {
	settings: EditorSettings
	onChange: (patch: SettingsPatch) => void
	onClose: () => void
}

function SettingsDialog({ settings, onChange, onClose }: SettingsDialogProps) {
	const { t } = useTranslation()

	const themeOptions = useMemo(
		() => THEMES.map((theme) => ({ value: theme.value, label: t(theme.labelKey) })),
		[t],
	)
	const accentOptions = useMemo(
		() =>
			ACCENT_COLORS.map((color) => ({
				value: color.value,
				label: t(color.labelKey),
				color: color.value,
			})),
		[t],
	)

	useEffect(() => {
		const handleKeydown = (e: KeyboardEvent) => {
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
						{t('settings.title')}
					</h2>
					<IconButton icon={LuX} title={t('common.close')} onClick={onClose} />
				</div>

				<div className="field">
					<span className="field-label">
						<LuLanguages aria-hidden="true" />
						{t('settings.language')}
					</span>
					<Dropdown
						options={LANGUAGES}
						value={settings.language}
						onChange={(language) => onChange({ language })}
					/>
				</div>

				<div className="field">
					<span className="field-label">
						<LuSunMoon aria-hidden="true" />
						{t('settings.theme')}
					</span>
					<Dropdown
						options={themeOptions}
						value={settings.theme}
						onChange={(theme) => onChange({ theme })}
					/>
				</div>

				<div className="field">
					<span className="field-label">
						<LuPalette aria-hidden="true" />
						{t('settings.accent')}
					</span>
					<Dropdown
						options={accentOptions}
						value={settings.accentColor}
						onChange={(accentColor) => onChange({ accentColor })}
					/>
				</div>

				<label className="field">
					<span className="field-label">
						<LuWrapText aria-hidden="true" />
						{t('settings.wrap')}
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
						{t('settings.fontSize')}
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
						{t('settings.tabSize')}
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
