import ru from '../../locales/ru.json'
import en from '../../locales/en.json'
import type { Language, TranslationKey, TranslationVariables } from '../types'

export const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
] as const satisfies readonly { value: Language; label: string }[]

const MESSAGES = { ru, en }

export function translate(
	language: Language,
	key: TranslationKey,
	vars?: TranslationVariables,
): string {
	const template = MESSAGES[language]?.[key] ?? MESSAGES.en[key] ?? key
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = vars?.[name]
		return value === undefined ? match : String(value)
	})
}
