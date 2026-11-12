import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import mammoth from 'mammoth'
import TurndownService from 'turndown'
import type {
	Language,
	MenuCommand,
	OpenFileResult,
	RenameFilePayload,
	RenameFileResult,
	SaveFilePayload,
	SaveFileResult,
	InvokeChannelMap,
	SendChannelMap,
} from '../shared/electron-api.js'

const turndown = new TurndownService({
	headingStyle: 'atx',
	bulletListMarker: '-',
	codeBlockStyle: 'fenced',
})
turndown.addRule('dropImages', { filter: 'img', replacement: () => '' })

const appRoot = path.resolve(__dirname, '../..')
const MESSAGES = {
	ru: require(path.join(appRoot, 'locales/ru.json')) as Record<string, string>,
	en: require(path.join(appRoot, 'locales/en.json')) as Record<string, string>,
} satisfies Record<Language, Record<string, string>>

let language: Language = 'ru'
let mainWindow: BrowserWindow | null = null
let hasUnsavedChanges = false

function t(key: string): string {
	return MESSAGES[language][key] ?? MESSAGES.en[key] ?? key
}

function textFilters(): Electron.FileFilter[] {
	return [{ name: t('dialog.textFiles'), extensions: ['txt', 'md'] }]
}

function openFilters(): Electron.FileFilter[] {
	return [
		{ name: t('dialog.textFiles'), extensions: ['txt', 'md'] },
		{ name: t('dialog.wordFiles'), extensions: ['docx'] },
		{ name: t('dialog.allFiles'), extensions: ['*'] },
	]
}

async function importDocx(filePath: string): Promise<string> {
	const { value: html } = await mammoth.convertToHtml(
		{ path: filePath },
		{ convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) },
	)
	return turndown.turndown(html)
}

function getMainWindow(): BrowserWindow {
	if (!mainWindow) throw new Error('Main window is not available')
	return mainWindow
}

function handleInvoke<K extends keyof InvokeChannelMap>(
	channel: K,
	handler: (
		event: IpcMainInvokeEvent,
		...args: InvokeChannelMap[K]['args']
	) => InvokeChannelMap[K]['result'] | Promise<InvokeChannelMap[K]['result']>,
): void {
	ipcMain.handle(channel, handler)
}

function handleSend<K extends keyof SendChannelMap>(
	channel: K,
	handler: (event: IpcMainEvent, ...args: SendChannelMap[K]) => void,
): void {
	ipcMain.on(channel, handler)
}

function registerIpcHandlers(): void {
	handleInvoke('file:open', async (): Promise<OpenFileResult> => {
		const { canceled, filePaths } = await dialog.showOpenDialog(
			getMainWindow(),
			{
				properties: ['openFile'],
				filters: openFilters(),
			},
		)
		if (canceled) return null

		const filePath = filePaths[0]
		if (!filePath) return null
		const extension = path.extname(filePath).toLowerCase()

		if (extension === '.doc') {
			await dialog.showMessageBox(getMainWindow(), {
				type: 'info',
				message: t('error.docNotSupported'),
			})
			return null
		}

		if (extension === '.docx') {
			try {
				const content = await importDocx(filePath)
				const name = path.basename(filePath, extension) + '.md'
				return { filePath: null, name, content, imported: true }
			} catch (error: unknown) {
				await dialog.showMessageBox(getMainWindow(), {
					type: 'error',
					message: t('error.importFailed'),
					detail: error instanceof Error ? error.message : String(error),
				})
				return null
			}
		}

		const content = await fs.readFile(filePath, 'utf8')
		return { filePath, content }
	})

	handleInvoke(
		'file:save',
		async (_event, { content, filePath, defaultName }: SaveFilePayload): Promise<SaveFileResult> => {
			let target = filePath

			if (!target) {
				const { canceled, filePath: chosenPath } =
					await dialog.showSaveDialog(getMainWindow(), {
						defaultPath: defaultName,
						filters: textFilters(),
					})
				if (canceled || !chosenPath) return null
				target = chosenPath
			}

			await fs.writeFile(target, content, 'utf8')
			return { filePath: target }
		},
	)

	handleInvoke(
		'file:rename',
		async (_event, { filePath, newName }: RenameFilePayload): Promise<RenameFileResult> => {
			const target = path.join(path.dirname(filePath), newName)
			if (target === filePath) return { filePath }

			const exists = await fs.access(target).then(
				() => true,
				() => false,
			)
			if (exists) return { error: 'exists' }

			try {
				await fs.rename(filePath, target)
				return { filePath: target }
			} catch (error: unknown) {
				return { error: error instanceof Error ? error.message : String(error) }
			}
		},
	)

	handleSend('doc:dirty', (_event, dirty: boolean) => {
		if (typeof dirty === 'boolean') hasUnsavedChanges = dirty
	})

	handleSend('app:set-language', (_event, nextLanguage: Language) => {
		if (nextLanguage !== 'ru' && nextLanguage !== 'en') return
		if (nextLanguage === language) return
		language = nextLanguage
		Menu.setApplicationMenu(buildMenu())
	})
}

function buildMenu(): Electron.Menu {
	const sendCommand = (command: MenuCommand) => () =>
		mainWindow?.webContents.send('menu:command', command)

	return Menu.buildFromTemplate([
		{
			label: t('menu.file'),
			submenu: [
				{
					label: t('menu.new'),
					accelerator: 'CmdOrCtrl+N',
					click: sendCommand('new'),
				},
				{
					label: t('menu.open'),
					accelerator: 'CmdOrCtrl+O',
					click: sendCommand('open'),
				},
				{ type: 'separator' },
				{
					label: t('menu.save'),
					accelerator: 'CmdOrCtrl+S',
					click: sendCommand('save'),
				},
				{
					label: t('menu.saveAs'),
					accelerator: 'CmdOrCtrl+Shift+S',
					click: sendCommand('save-as'),
				},
				{ type: 'separator' },
				{
					label: t('menu.closeTab'),
					accelerator: 'CmdOrCtrl+W',
					click: sendCommand('close-tab'),
				},
				{
					label: t('menu.nextTab'),
					accelerator: 'CmdOrCtrl+Tab',
					click: sendCommand('next-tab'),
				},
				{
					label: t('menu.prevTab'),
					accelerator: 'CmdOrCtrl+Shift+Tab',
					click: sendCommand('prev-tab'),
				},
				{ type: 'separator' },
				{ role: 'quit', label: t('menu.quit') },
			],
		},
		{ role: 'editMenu' },
	])
}

function createWindow(): void {
	const window = new BrowserWindow({
		width: 1000,
		height: 700,
		minWidth: 600,
		minHeight: 400,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
		},
	})
	mainWindow = window

	void window.loadFile(path.join(appRoot, 'dist', 'index.html'))

	window.on('close', (event) => {
		if (!hasUnsavedChanges) return

		const choice = dialog.showMessageBoxSync(window, {
			type: 'warning',
			buttons: [t('dialog.cancel'), t('dialog.closeWithoutSaving')],
			defaultId: 0,
			cancelId: 0,
			message: t('dialog.unsavedTitle'),
			detail: t('dialog.unsavedDetail'),
		})
		if (choice === 0) event.preventDefault()
	})

	window.on('closed', () => {
		mainWindow = null
	})

	Menu.setApplicationMenu(buildMenu())
}

app.disableHardwareAcceleration()

app.whenReady().then(() => {
	registerIpcHandlers()
	createWindow()

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
