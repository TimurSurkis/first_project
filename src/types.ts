import type { Extension } from '@codemirror/state'
import type { Command } from '@codemirror/view'
import type { IconType } from 'react-icons'
import type en from '../locales/en.json'
import type { Language } from '../shared/electron-api'

export type { Language } from '../shared/electron-api'
export type Theme = 'light' | 'dark'
export type ViewMode = 'edit' | 'split' | 'preview'
export type DocumentId = number
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export type FontSize = 12 | 14 | 16 | 18 | 20 | 22 | 24 | 28 | 32
export type TabSize = 2 | 4 | 8
export type AccentColor = '#2580FF' | '#008E75' | '#F19700' | '#5A6A80'

export interface EditorSettings {
  language: Language
  lineWrapping: boolean
  fontSize: FontSize
  tabSize: TabSize
  theme: Theme
  accentColor: AccentColor
  sidebarOpen: boolean
  sidebarWidth: number
}

/** Строка и столбец нумеруются с единицы. */
export interface CursorPosition {
  line: number
  col: number
}

/** Модель вкладки, не DOM Document. dirty вычисляется из text и savedText. */
export interface EditorDocument {
  id: DocumentId
  docName: string
  text: string
  savedText: string
  filePath: string | null
  mode: ViewMode
  cursor: CursorPosition
}

export interface TabsState {
  docs: EditorDocument[]
  activeId: DocumentId
}

export type DocumentPatch = Partial<Omit<EditorDocument, 'id'>>
export type SettingsPatch = Partial<EditorSettings>
export type NewDocumentFields = Pick<EditorDocument, 'docName'> & DocumentPatch

export interface EditorLanguage {
  name: string
  extensions: readonly string[]
  support: () => Extension
}

export type FormatCommandId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'list'
  | 'ordered'
  | 'quote'
  | 'checklist'
  | 'link'
  | 'codeblock'
  | 'table'

export interface FormatCommand {
  id: FormatCommandId
  group: 'inline' | 'block' | 'insert'
  icon: IconType
  title: string
  key?: string
  run: Command
}

/** Общая модель вариантов собственных Dropdown (строковых и числовых). */
export interface DropdownOption<T extends string | number = string> {
  value: T
  label: string
  color?: string
}

export type TranslationKey = keyof typeof en
export type TranslationVariables = Readonly<Record<string, string | number>>
export type Translate = (key: TranslationKey, vars?: TranslationVariables) => string

export interface TranslationContextValue {
  language: Language
  t: Translate
}
