import type {
	AccentColor,
	EditorSettings,
	FontSize,
	TabSize,
	Theme,
} from './types'
import type { TranslationKey } from './types'

const STORAGE_KEY = 'editor-settings'

export const DEFAULT_SETTINGS: EditorSettings = {
  language: 'ru',
  lineWrapping: false,
  fontSize: 16,
  tabSize: 4,
  theme: 'light',
  accentColor: '#2580FF',
  sidebarOpen: true,
  sidebarWidth: 220,
}

export const SIDEBAR_WIDTH = { default: 220, min: 160, max: 480 } as const

export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32] as const satisfies readonly FontSize[]
export const TAB_SIZES = [2, 4, 8] as const satisfies readonly TabSize[]
export const THEMES = [
	{ value: 'light', labelKey: 'theme.light' },
	{ value: 'dark', labelKey: 'theme.dark' },
] as const satisfies readonly { value: Theme; labelKey: TranslationKey }[]
export const ACCENT_COLORS = [
  { value: '#2580FF', labelKey: 'accent.blue' },
  { value: '#008E75', labelKey: 'accent.green' },
  { value: '#F19700', labelKey: 'accent.orange' },
	{ value: '#5A6A80', labelKey: 'accent.slate' },
] as const satisfies readonly { value: AccentColor; labelKey: TranslationKey }[]

export function loadSettings(): EditorSettings {
	try {
		const saved = JSON.parse(
			localStorage.getItem(STORAGE_KEY) ?? '{}',
		) as Partial<EditorSettings>
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: EditorSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
