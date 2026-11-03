import { LanguageDescription } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'

const CODE_LANGUAGES = [
  {
    name: 'JavaScript',
    extensions: ['js', 'mjs', 'cjs', 'jsx'],
    support: () => javascript({ jsx: true }),
  },
  {
    name: 'TypeScript',
    extensions: ['ts', 'tsx'],
    support: () => javascript({ typescript: true, jsx: true }),
  },
  { name: 'Python', extensions: ['py'], support: () => python() },
  { name: 'HTML', extensions: ['html', 'htm'], support: () => html() },
  { name: 'CSS', extensions: ['css'], support: () => css() },
  { name: 'JSON', extensions: ['json'], support: () => json() },
]

const CODE_LANGUAGE_DESCRIPTIONS = CODE_LANGUAGES.map((language) =>
  LanguageDescription.of({
    name: language.name,
    alias: language.extensions,
    extensions: language.extensions,
    load: async () => language.support(),
  }),
)

const MARKDOWN = {
  name: 'Markdown',
  extensions: ['md', 'markdown'],
  support: () => markdown({ codeLanguages: CODE_LANGUAGE_DESCRIPTIONS }),
}

const PLAIN_TEXT = {
  name: 'plain-text',
  extensions: [],
  support: () => [],
}

const LANGUAGES = [MARKDOWN, ...CODE_LANGUAGES]

export function findLanguage(filePath) {
  if (!filePath) return MARKDOWN

  const extension = filePath.includes('.') ? filePath.split('.').pop().toLowerCase() : ''
  return LANGUAGES.find((language) => language.extensions.includes(extension)) ?? PLAIN_TEXT
}
