import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
	ElectronAPI,
	ExportHtmlPayload,
	EventChannelMap,
	InvokeChannelMap,
	MenuCommand,
	RenameFilePayload,
	SaveFilePayload,
	SendChannelMap,
	Unsubscribe,
} from '../shared/electron-api.js'

const api = {
	openFile: () =>
		ipcRenderer.invoke('file:open') as Promise<
			InvokeChannelMap['file:open']['result']
		>,
	saveFile: (payload: SaveFilePayload) =>
		ipcRenderer.invoke('file:save', payload) as Promise<
			InvokeChannelMap['file:save']['result']
		>,
	exportHtml: (payload: ExportHtmlPayload) =>
		ipcRenderer.invoke('file:export-html', payload) as Promise<
			InvokeChannelMap['file:export-html']['result']
		>,
	renameFile: (payload: RenameFilePayload) =>
		ipcRenderer.invoke('file:rename', payload) as Promise<
			InvokeChannelMap['file:rename']['result']
		>,
	setDirty: (...args: SendChannelMap['doc:dirty']): void =>
		ipcRenderer.send('doc:dirty', ...args),
	setLanguage: (...args: SendChannelMap['app:set-language']): void =>
		ipcRenderer.send('app:set-language', ...args),
	setCanExportHtml: (...args: SendChannelMap['doc:can-export-html']): void =>
		ipcRenderer.send('doc:can-export-html', ...args),
	onMenuCommand: (callback: (command: MenuCommand) => void): Unsubscribe => {
		const listener = (
			_event: IpcRendererEvent,
			...args: EventChannelMap['menu:command']
		): void => callback(args[0])
		ipcRenderer.on('menu:command', listener)
		return () => ipcRenderer.removeListener('menu:command', listener)
	},
} satisfies ElectronAPI

contextBridge.exposeInMainWorld('api', api)
