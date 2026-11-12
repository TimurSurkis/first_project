import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const mainPath = fileURLToPath(new URL('../dist-electron/electron/main.cjs', import.meta.url))
let directory
let mainSource

before(async () => {
	// Keep temporary test files inside the approved temporary directory.
	await fs.mkdir('/tmp/opencode', { recursive: true })
	directory = await fs.mkdtemp('/tmp/opencode/html-export-')
	mainSource = await fs.readFile(mainPath, 'utf8')
})

after(async () => {
	if (directory) await fs.rm(directory, { recursive: true })
})

async function createMain(dialogOverrides = {}, fsOverrides = {}) {
	const invokes = new Map()
	const sends = new Map()
	let menu
	let saveOptions
	let confirmationOptions
	const dialog = {
		async showSaveDialog(_window, options) {
			saveOptions = options
			return dialogOverrides.save ?? { canceled: true }
		},
		async showMessageBox(_window, options) {
			confirmationOptions = options
			return { response: dialogOverrides.response ?? 0 }
		},
	}
	const electron = {
		app: { disableHardwareAcceleration() {}, whenReady: () => Promise.resolve(), on() {} },
		BrowserWindow: class {
			webContents = { send() {} }
			loadFile() { return Promise.resolve() }
			on() {}
		},
		dialog,
		ipcMain: {
			handle(channel, handler) { invokes.set(channel, handler) },
			on(channel, handler) { sends.set(channel, handler) },
		},
		Menu: {
			buildFromTemplate(template) {
				return {
					getMenuItemById(id) {
						return template.flatMap((item) => item.submenu ?? []).find((item) => item.id === id)
					},
				}
			},
			setApplicationMenu(value) { menu = value },
			getApplicationMenu() { return menu },
		},
	}
	vm.runInNewContext(mainSource, {
		exports: {},
		__dirname: path.dirname(mainPath),
		Error,
		require(id) {
			if (id === 'electron') return electron
			if (id === 'node:fs') return { promises: { ...fs, ...fsOverrides } }
			if (id === 'mammoth') return {}
			if (id === 'turndown') return class { addRule() {} }
			return require(id)
		},
	})
	await Promise.resolve()
	return {
		exportHtml: (payload) => invokes.get('file:export-html')({}, payload),
		send: (channel, value) => sends.get(channel)({}, value),
		get saveOptions() { return saveOptions },
		get confirmationOptions() { return confirmationOptions },
		get exportMenuItem() { return menu.getMenuItemById('export-html') },
	}
}

test('writes UTF-8 HTML through a dedicated dialog and requests native overwrite confirmation', async () => {
	const filePath = path.join(directory, 'Заметка.html')
	const main = await createMain({ save: { canceled: false, filePath } })
	const result = await main.exportHtml({ content: '<h1>Привет</h1>', defaultName: 'Заметка.html' })
	assert.equal(result.filePath, filePath)
	assert.equal(await fs.readFile(filePath, 'utf8'), '<h1>Привет</h1>')
	assert.equal(main.saveOptions.defaultPath, 'Заметка.html')
	assert.equal(main.saveOptions.filters[0].extensions[0], 'html')
	assert.ok(main.saveOptions.properties.includes('showOverwriteConfirmation'))
})

test('cancelling the dialog does not write a file', async () => {
	let writes = 0
	const main = await createMain({}, { async writeFile() { writes++ } })
	assert.equal(await main.exportHtml({ content: '', defaultName: 'test.html' }), null)
	assert.equal(writes, 0)
})

test('appends .html and never overwrites a chosen Markdown source', async () => {
	const filePath = path.join(directory, 'source.md')
	await fs.writeFile(filePath, '# Original', 'utf8')
	const main = await createMain({ save: { canceled: false, filePath } })
	const result = await main.exportHtml({ content: '<h1>Export</h1>', defaultName: 'source.html' })
	assert.equal(result.filePath, `${filePath}.html`)
	assert.equal(await fs.readFile(filePath, 'utf8'), '# Original')
	assert.equal(await fs.readFile(result.filePath, 'utf8'), '<h1>Export</h1>')
})

test('checks the actual destination when appending an extension, and allows cancelling replacement', async () => {
	const filePath = path.join(directory, 'existing')
	await fs.writeFile(`${filePath}.html`, 'original', 'utf8')
	const main = await createMain({ save: { canceled: false, filePath }, response: 0 })
	assert.equal(await main.exportHtml({ content: 'replacement', defaultName: 'existing.html' }), null)
	assert.equal(main.confirmationOptions.detail, `${filePath}.html`)
	assert.equal(main.confirmationOptions.cancelId, 0)
	assert.equal(await fs.readFile(`${filePath}.html`, 'utf8'), 'original')
})

test('replaces the normalized destination only after confirmation', async () => {
	const filePath = path.join(directory, 'replace')
	await fs.writeFile(`${filePath}.html`, 'original', 'utf8')
	const main = await createMain({ save: { canceled: false, filePath }, response: 1 })
	await main.exportHtml({ content: 'replacement', defaultName: 'replace.html' })
	assert.equal(await fs.readFile(`${filePath}.html`, 'utf8'), 'replacement')
})

test('returns write failures and rejects malformed IPC data', async () => {
	const main = await createMain({ save: { canceled: false, filePath: path.join(directory, 'error.html') } }, {
		async writeFile() { throw new Error('Permission denied') },
	})
	assert.equal((await main.exportHtml({ content: '', defaultName: 'error.html' })).error, 'Permission denied')
	assert.equal(typeof (await main.exportHtml(null)).error, 'string')
	assert.equal(typeof (await main.exportHtml({ content: 42, defaultName: 'error.html' })).error, 'string')
})

test('keeps menu availability in sync with the active document and language changes', async () => {
	const main = await createMain()
	assert.equal(main.exportMenuItem.enabled, false)
	main.send('doc:can-export-html', true)
	assert.equal(main.exportMenuItem.enabled, true)
	main.send('app:set-language', 'en')
	assert.equal(main.exportMenuItem.enabled, true)
	assert.equal(main.exportMenuItem.label, 'Export to HTML…')
	main.send('doc:can-export-html', false)
	assert.equal(main.exportMenuItem.enabled, false)
})
