import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { I18nContext } from './context.ts'
import { translate } from './translate.ts'
import type { Language, TranslationContextValue } from '../types'

interface I18nProviderProps {
	language: Language
	children: ReactNode
}

function I18nProvider({ language, children }: I18nProviderProps) {
  const value = useMemo(
    (): TranslationContextValue => ({
      language,
      t: (key, vars) => translate(language, key, vars),
    }),
    [language],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export default I18nProvider
