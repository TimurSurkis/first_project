import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import type { IpcMainEvent } from 'electron'
import path from 'node:path'
import type { Language, MenuCommand } from '../shared/electron-api.js'

const appRoot = path.resolve(__dirname, '../..')
const messages = {
	ru: require(path.join(appRoot, 'locales/ru.json')) as Record<string, string>,
	en: require(path.join(appRoot, 'locales/en.json')) as Record<string, string>,
}
const editorUrl = new URL(process.env.EDITOR_URL ?? 'http://localhost:3000')
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(editorUrl.hostname)
if (editorUrl.username || editorUrl.password || (editorUrl.protocol !== 'https:' && !(editorUrl.protocol === 'http:' && loopback))) {
	throw new Error('EDITOR_URL must use HTTPS (HTTP is allowed only on loopback for development)')
}

let language: Language = 'ru'
let mainWindow: BrowserWindow | null = null
let hasUnsavedChanges = false
let canExportHtml = false
let allowClose = false

function t(key: string) { return messages[language][key] ?? messages.en[key] ?? key }
function trustedUrl(url: string) {
	try { return new URL(url).origin === editorUrl.origin } catch { return false }
}
function trustedSender(event: IpcMainEvent) {
	return mainWindow !== null && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && trustedUrl(event.senderFrame.url)
}

ipcMain.on('doc:dirty', (event, dirty: unknown) => {
	if (trustedSender(event) && typeof dirty === 'boolean') hasUnsavedChanges = dirty
})
ipcMain.on('doc:can-export-html', (event, enabled: unknown) => {
	if (!trustedSender(event) || typeof enabled !== 'boolean') return
	canExportHtml = enabled
	const item = Menu.getApplicationMenu()?.getMenuItemById('export-html')
	if (item) item.enabled = enabled
})
ipcMain.on('app:set-language', (event, next: unknown) => {
	if (!trustedSender(event) || (next !== 'ru' && next !== 'en') || next === language) return
	language = next
	Menu.setApplicationMenu(buildMenu())
})

function buildMenu() {
	const send = (command: MenuCommand) => () => {
		if (mainWindow && trustedUrl(mainWindow.webContents.getURL())) mainWindow.webContents.send('menu:command', command)
	}
	return Menu.buildFromTemplate([
		{ label: t('menu.file'), submenu: [
			{ label: t('menu.new'), accelerator: 'CmdOrCtrl+N', click: send('new') },
			{ label: t('cloud.allFiles'), accelerator: 'CmdOrCtrl+O', click: send('open') },
			{ type: 'separator' },
			{ label: t('menu.save'), accelerator: 'CmdOrCtrl+S', click: send('save') },
			{ label: t('cloud.saveCopy'), accelerator: 'CmdOrCtrl+Shift+S', click: send('save-as') },
			{ id: 'export-html', label: t('menu.exportHtml'), enabled: canExportHtml, click: send('export-html') },
			{ type: 'separator' },
			{ label: t('menu.closeTab'), accelerator: 'CmdOrCtrl+W', click: send('close-tab') },
			{ label: t('menu.nextTab'), accelerator: 'CmdOrCtrl+Tab', click: send('next-tab') },
			{ label: t('menu.prevTab'), accelerator: 'CmdOrCtrl+Shift+Tab', click: send('prev-tab') },
			{ type: 'separator' },
			{ role: 'quit', label: t('menu.quit') },
		] },
		{ role: 'editMenu' },
	])
}

async function loadEditor(window: BrowserWindow) {
	try { await window.loadURL(editorUrl.href) }
	catch {
		if (window.isDestroyed()) return
		const { response } = await dialog.showMessageBox(window, {
			type: 'error', message: t('cloud.serverUnavailable'), detail: editorUrl.origin,
			buttons: [t('cloud.retry'), t('dialog.cancel')], defaultId: 0, cancelId: 1,
		})
		if (response === 0 && !window.isDestroyed()) void loadEditor(window)
	}
}

function createWindow() {
	const window = new BrowserWindow({ width: 1100, height: 750, minWidth: 600, minHeight: 400,
		webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
	})
	mainWindow = window
	hasUnsavedChanges = false
	allowClose = false
	window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
	window.webContents.on('will-navigate', (event, url) => { if (!trustedUrl(url)) event.preventDefault() })
	window.webContents.on('will-redirect', (event, url) => { if (!trustedUrl(url)) event.preventDefault() })
	window.webContents.on('will-attach-webview', (event) => event.preventDefault())
	window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
	window.webContents.session.setPermissionCheckHandler(() => false)
	window.webContents.on('will-prevent-unload', (event) => {
		// Electron's close dialog already obtained explicit permission to discard.
		if (allowClose) event.preventDefault()
	})
	window.on('close', (event) => {
		if (!hasUnsavedChanges) return
		const choice = dialog.showMessageBoxSync(window, {
			type: 'warning', buttons: [t('dialog.cancel'), t('dialog.closeWithoutSaving')], defaultId: 0, cancelId: 0,
			message: t('dialog.unsavedTitle'), detail: t('dialog.unsavedDetail'),
		})
		if (choice === 0) event.preventDefault()
		else allowClose = true
	})
	window.on('closed', () => { mainWindow = null })
	Menu.setApplicationMenu(buildMenu())
	void loadEditor(window)
}

app.disableHardwareAcceleration()
app.whenReady().then(() => {
	createWindow()
	app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
