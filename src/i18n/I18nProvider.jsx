import { useMemo } from 'react'
import { I18nContext } from './context.js'
import { translate } from './translate.js'

function I18nProvider({ language, children }) {
  const value = useMemo(
    () => ({ language, t: (key, vars) => translate(language, key, vars) }),
    [language],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export default I18nProvider
