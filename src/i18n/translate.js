import ru from '../../locales/ru.json'
import en from '../../locales/en.json'

export const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

const MESSAGES = { ru, en }

export function translate(language, key, vars) {
  const template = MESSAGES[language]?.[key] ?? MESSAGES.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (match, name) => vars?.[name] ?? match)
}
