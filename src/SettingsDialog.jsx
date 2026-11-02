import { FONT_SIZES, TAB_SIZES, THEMES } from './settings.js'

function SettingsDialog({ settings, onChange, onClose }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="settings-title">Настройки редактора</h2>

        <label className="field">
          <span>Тема</span>
          <select
            value={settings.theme}
            onChange={(event) => onChange({ theme: event.target.value })}
          >
            {THEMES.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Перенос длинных строк</span>
          <input
            type="checkbox"
            checked={settings.lineWrapping}
            onChange={(event) => onChange({ lineWrapping: event.target.checked })}
          />
        </label>

        <label className="field">
          <span>Размер шрифта</span>
          <select
            value={settings.fontSize}
            onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Размер табуляции (в пробелах)</span>
          <select
            value={settings.tabSize}
            onChange={(event) => onChange({ tabSize: Number(event.target.value) })}
          >
            {TAB_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsDialog
