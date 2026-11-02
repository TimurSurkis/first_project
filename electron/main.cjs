const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const TEXT_FILTERS = [
	{ name: 'Текстовые файлы', extensions: ['txt', 'md'] },
	{ name: 'Все файлы', extensions: ['*'] },
];

let mainWindow = null;
let hasUnsavedChanges = false;

function registerIpcHandlers() {
	ipcMain.handle('file:open', async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog(
			mainWindow,
			{
				properties: ['openFile'],
				filters: TEXT_FILTERS,
			},
		);
		if (canceled) return null;

		const filePath = filePaths[0];
		const content = await fs.readFile(filePath, 'utf8');
		return { filePath, content };
	});

	ipcMain.handle('file:save', async (_event, { content, filePath }) => {
		let target = filePath;

		if (!target) {
			const { canceled, filePath: chosenPath } =
				await dialog.showSaveDialog(mainWindow, {
					defaultPath: 'Без названия.txt',
					filters: TEXT_FILTERS,
				});
			if (canceled || !chosenPath) return null;
			target = chosenPath;
		}

		await fs.writeFile(target, content, 'utf8');
		return { filePath: target };
	});

	ipcMain.on('doc:dirty', (_event, dirty) => {
		hasUnsavedChanges = dirty;
	});
}

function buildMenu() {
	const sendCommand = (command) => () =>
		mainWindow.webContents.send('menu:command', command);

	return Menu.buildFromTemplate([
		{
			label: 'Файл',
			submenu: [
				{
					label: 'Новый',
					accelerator: 'CmdOrCtrl+N',
					click: sendCommand('new'),
				},
				{
					label: 'Открыть...',
					accelerator: 'CmdOrCtrl+O',
					click: sendCommand('open'),
				},
				{ type: 'separator' },
				{
					label: 'Сохранить',
					accelerator: 'CmdOrCtrl+S',
					click: sendCommand('save'),
				},
				{
					label: 'Сохранить как...',
					accelerator: 'CmdOrCtrl+Shift+S',
					click: sendCommand('save-as'),
				},
				{ type: 'separator' },
				{ role: 'quit' },
			],
		},
		{
			label: 'Вид',
			submenu: [
				{
					label: 'Переключить тему',
					accelerator: 'CmdOrCtrl+Shift+T',
					click: sendCommand('toggle-theme'),
				},
			],
		},
		{ role: 'editMenu' },
	]);
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 700,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
		},
	});

	mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

	mainWindow.on('close', (event) => {
		if (!hasUnsavedChanges) return;

		const choice = dialog.showMessageBoxSync(mainWindow, {
			type: 'warning',
			buttons: ['Отмена', 'Закрыть без сохранения'],
			defaultId: 0,
			cancelId: 0,
			message: 'Есть несохранённые изменения',
			detail: 'Закрыть окно без сохранения?',
		});
		if (choice === 0) event.preventDefault();
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	Menu.setApplicationMenu(buildMenu());
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
	registerIpcHandlers();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
