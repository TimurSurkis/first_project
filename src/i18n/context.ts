import { createContext, useContext } from 'react'
import { translate } from './translate.ts'
import type { TranslationContextValue } from '../types'

export const I18nContext = createContext<TranslationContextValue>({
  language: 'ru',
  t: (key, vars) => translate('ru', key, vars),
})

export function useTranslation(): TranslationContextValue {
  return useContext(I18nContext)
}
