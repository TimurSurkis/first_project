import { createContext, useContext } from 'react'
import { translate } from './translate.js'

export const I18nContext = createContext({
  language: 'ru',
  t: (key, vars) => translate('ru', key, vars),
})

export function useTranslation() {
  return useContext(I18nContext)
}
