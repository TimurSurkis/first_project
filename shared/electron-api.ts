export type Language = 'ru' | 'en'

export interface ExportHtmlPayload {
	content: string
	defaultName: string
}

export type MenuCommand = 'new' | 'open' | 'save' | 'save-as' | 'export-html' | 'close-tab' | 'next-tab' | 'prev-tab'
export type Unsubscribe = () => void

/** No filesystem API is exposed to the server-loaded frontend. */
export interface ElectronAPI {
	setDirty: (dirty: boolean) => void
	setLanguage: (language: Language) => void
	setCanExportHtml: (enabled: boolean) => void
	onMenuCommand: (callback: (command: MenuCommand) => void) => Unsubscribe
}
