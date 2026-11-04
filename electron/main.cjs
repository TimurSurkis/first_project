const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const fs = require('fs/promises')
const path = require('path')
const mammoth = require('mammoth')
const TurndownService = require('turndown')

const turndown = new TurndownService({
	headingStyle: 'atx',
	bulletListMarker: '-',
	codeBlockStyle: 'fenced',
})
turndown.addRule('dropImages', { filter: 'img', replacement: () => '' })

const MESSAGES = {
	ru: require('../locales/ru.json'),
	en: require('../locales/en.json'),
}

let language = 'ru'
let mainWindow = null
let hasUnsavedChanges = false

function t(key) {
	return MESSAGES[language]?.[key] ?? MESSAGES.en[key] ?? key
}

function textFilters() {
	return [{ name: t('dialog.textFiles'), extensions: ['txt', 'md'] }]
}

function openFilters() {
	return [
		{ name: t('dialog.textFiles'), extensions: ['txt', 'md'] },
		{ name: t('dialog.wordFiles'), extensions: ['docx'] },
		{ name: t('dialog.allFiles'), extensions: ['*'] },
	]
}

async function importDocx(filePath) {
	const { value: html } = await mammoth.convertToHtml(
		{ path: filePath },
		{ convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) },
	)
	return turndown.turndown(html)
}

function registerIpcHandlers() {
	ipcMain.handle('file:open', async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog(
			mainWindow,
			{
				properties: ['openFile'],
				filters: openFilters(),
			},
		)
		if (canceled) return null

		const filePath = filePaths[0]
		const extension = path.extname(filePath).toLowerCase()

		if (extension === '.doc') {
			await dialog.showMessageBox(mainWindow, {
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
			} catch (error) {
				await dialog.showMessageBox(mainWindow, {
					type: 'error',
					message: t('error.importFailed'),
					detail: error.message,
				})
				return null
			}
		}

		const content = await fs.readFile(filePath, 'utf8')
		return { filePath, content }
	})

	ipcMain.handle(
		'file:save',
		async (_event, { content, filePath, defaultName }) => {
			let target = filePath

			if (!target) {
				const { canceled, filePath: chosenPath } =
					await dialog.showSaveDialog(mainWindow, {
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

	ipcMain.handle('file:rename', async (_event, { filePath, newName }) => {
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
		} catch (error) {
			return { error: error.message }
		}
	})

	ipcMain.on('doc:dirty', (_event, dirty) => {
		hasUnsavedChanges = dirty
	})

	ipcMain.on('app:set-language', (_event, nextLanguage) => {
		if (!MESSAGES[nextLanguage] || nextLanguage === language) return
		language = nextLanguage
		Menu.setApplicationMenu(buildMenu())
	})
}

function buildMenu() {
	const sendCommand = (command) => () =>
		mainWindow.webContents.send('menu:command', command)

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
				{
					label: t('menu.settings'),
					accelerator: 'CmdOrCtrl+,',
					click: sendCommand('settings'),
				},
				{ type: 'separator' },
				{ role: 'quit', label: t('menu.quit') },
			],
		},
		{ role: 'editMenu' },
	])
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 700,
		minWidth: 600,
		minHeight: 400,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
		},
	})

	mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

	mainWindow.on('close', (event) => {
		if (!hasUnsavedChanges) return

		const choice = dialog.showMessageBoxSync(mainWindow, {
			type: 'warning',
			buttons: [t('dialog.cancel'), t('dialog.closeWithoutSaving')],
			defaultId: 0,
			cancelId: 0,
			message: t('dialog.unsavedTitle'),
			detail: t('dialog.unsavedDetail'),
		})
		if (choice === 0) event.preventDefault()
	})

	mainWindow.on('closed', () => {
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
