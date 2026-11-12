export type Language = 'ru' | 'en'

export interface OpenedFile {
	filePath: string
	content: string
	imported?: false
}

export interface ImportedFile {
	filePath: null
	name: string
	content: string
	imported: true
}

export type OpenFileResult = OpenedFile | ImportedFile | null

export interface SaveFilePayload {
	content: string
	filePath: string | null
	defaultName: string
}

export interface FilePathResult {
	filePath: string
}

export type SaveFileResult = FilePathResult | null

export interface RenameFilePayload {
	filePath: string
	newName: string
}

export type RenameFileResult =
	| { filePath: string; error?: never }
	| { error: string; filePath?: never }

export type MenuCommand =
	| 'new'
	| 'open'
	| 'save'
	| 'save-as'
	| 'close-tab'
	| 'next-tab'
	| 'prev-tab'

export type Unsubscribe = () => void

export interface ElectronAPI {
	openFile: () => Promise<OpenFileResult>
	saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult>
	renameFile: (payload: RenameFilePayload) => Promise<RenameFileResult>
	setDirty: (dirty: boolean) => void
	setLanguage: (language: Language) => void
	onMenuCommand: (callback: (command: MenuCommand) => void) => Unsubscribe
}

/** IPC payloads declared in both main and preload processes. */
export interface InvokeChannelMap {
	'file:open': { args: []; result: OpenFileResult }
	'file:save': { args: [payload: SaveFilePayload]; result: SaveFileResult }
	'file:rename': {
		args: [payload: RenameFilePayload]
		result: RenameFileResult
	}
}

export interface SendChannelMap {
	'doc:dirty': [dirty: boolean]
	'app:set-language': [language: Language]
}

export interface EventChannelMap {
	'menu:command': [command: MenuCommand]
}
