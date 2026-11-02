const STORAGE_KEY = 'editor-settings'

export const DEFAULT_SETTINGS = {
  lineWrapping: false,
  fontSize: 16,
  tabSize: 4,
}

export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32]
export const TAB_SIZES = [2, 4, 8]

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
