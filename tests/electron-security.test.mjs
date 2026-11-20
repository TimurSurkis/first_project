import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const mainPath = fileURLToPath(new URL('../dist-electron/electron/main.cjs', import.meta.url))

async function createMain(url = 'https://editor.example.com/') {
	const sends = new Map(), events = new Map()
	let window, menu, exposed
	const electron = {
		app: { disableHardwareAcceleration() {}, whenReady: () => Promise.resolve(), on() {} },
		BrowserWindow: class {
			webContents = {
				mainFrame: { url }, session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} },
				on: (name, callback) => events.set(name, callback), setWindowOpenHandler: (callback) => { this.popup = callback },
				getURL: () => url, send() {},
			}
			constructor(options) { this.options = options; window = this }
			async loadURL(target) { this.loaded = target }
			on() {}
		},
		ipcMain: { on: (channel, callback) => sends.set(channel, callback) },
		Menu: {
			buildFromTemplate: (template) => ({ getMenuItemById: (id) => template.flatMap((item) => item.submenu ?? []).find((item) => item.id === id) }),
			setApplicationMenu: (value) => { menu = value }, getApplicationMenu: () => menu,
		},
		contextBridge: { exposeInMainWorld: (_name, value) => { exposed = value } },
		ipcRenderer: { send() {}, on() {}, removeListener() {} },
	}
	const context = { exports: {}, __dirname: path.dirname(mainPath), process: { env: { EDITOR_URL: url }, platform: 'linux' }, URL,
		require: (id) => id === 'electron' ? electron : require(id),
	}
	vm.runInNewContext(await readFile(mainPath, 'utf8'), context)
	await Promise.resolve()
	vm.runInNewContext(await readFile(path.join(path.dirname(mainPath), 'preload.cjs'), 'utf8'), { ...context, exports: {} })
	return { window, exposed, sends, events, item: () => menu.getMenuItemById('export-html') }
}

test('Electron loads server frontend, is sandboxed and exposes no filesystem bridge', async () => {
	const { window, exposed } = await createMain()
	assert.equal(window.loaded, 'https://editor.example.com/')
	assert.equal(window.options.webPreferences.sandbox, true)
	assert.equal(window.options.webPreferences.nodeIntegration, false)
	assert.deepEqual(Object.keys(exposed).sort(), ['onMenuCommand', 'setCanExportHtml', 'setDirty', 'setLanguage'])
})

test('IPC accepts only trusted top-frame senders and blocks external navigation/popups', async () => {
	const { window, sends, events, item } = await createMain()
	const trusted = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
	sends.get('doc:can-export-html')({ ...trusted, senderFrame: { url: 'https://evil.example' } }, true)
	assert.equal(item().enabled, false)
	sends.get('doc:can-export-html')(trusted, true)
	assert.equal(item().enabled, true)
	let prevented = false
	events.get('will-navigate')({ preventDefault() { prevented = true } }, 'https://evil.example')
	assert.equal(prevented, true)
	assert.equal(window.popup().action, 'deny')
})

test('Electron rejects non-local cleartext HTTP frontend addresses', async () => {
	await assert.rejects(createMain('http://editor.example.com'), /HTTPS/)
})
