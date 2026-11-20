import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { ElectronAPI, MenuCommand } from '../shared/electron-api.js'

const api = {
	setDirty: (dirty: boolean) => ipcRenderer.send('doc:dirty', dirty),
	setLanguage: (language) => ipcRenderer.send('app:set-language', language),
	setCanExportHtml: (enabled: boolean) => ipcRenderer.send('doc:can-export-html', enabled),
	onMenuCommand: (callback: (command: MenuCommand) => void) => {
		const listener = (_event: IpcRendererEvent, command: MenuCommand) => callback(command)
		ipcRenderer.on('menu:command', listener)
		return () => { ipcRenderer.removeListener('menu:command', listener) }
	},
} satisfies ElectronAPI

contextBridge.exposeInMainWorld('api', api)
