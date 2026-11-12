import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { EditorSelection, EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { getDefaultExtensions } from '@uiw/react-codemirror'
import { createServer } from 'vite'

let server
let createMarkdownKeymap
const translate = (key) => key === 'format.textPlaceholder' ? 'text' : key

before(async () => {
	server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
	const module = await server.ssrLoadModule('/src/markdownCommands.ts')
	createMarkdownKeymap = module.createMarkdownKeymap
})

after(async () => {
	await server?.close()
})

function editor(doc, selection) {
	let state = EditorState.create({
		doc,
		selection,
		// Match react-codemirror: defaults precede the application's extensions.
		extensions: [getDefaultExtensions(), markdown(), createMarkdownKeymap(translate)],
	})
	const view = {
		get state() { return state },
		dispatch(transaction) { state = transaction.state ?? state.update(transaction).state },
	}
	return {
		get state() { return state },
		press(key) {
			for (const binding of state.facet(keymap).flat()) {
				if (binding.key === key && binding.run?.(view)) return true
			}
			return false
		},
	}
}

test('Mod-i formats only the selected word on the first press, ahead of selectParentSyntax', () => {
	const view = editor('before word after', EditorSelection.range(7, 11))
	assert.equal(view.press('Mod-i'), true)
	assert.equal(view.state.doc.toString(), 'before *word* after')
	assert.equal(view.state.selection.main.from, 8)
	assert.equal(view.state.selection.main.to, 12)
})

test('a second Mod-i removes italic without extending the selection to the entire line', () => {
	const view = editor('before word after', EditorSelection.range(11, 7))
	view.press('Mod-i')
	view.press('Mod-i')
	assert.equal(view.state.doc.toString(), 'before word after')
	assert.equal(view.state.selection.main.from, 7)
	assert.equal(view.state.selection.main.to, 11)
})

test('Mod-i at a cursor inserts the italic placeholder without selecting the line', () => {
	const view = editor('before  after', EditorSelection.cursor(7))
	view.press('Mod-i')
	assert.equal(view.state.doc.toString(), 'before *text* after')
	assert.equal(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to), 'text')
})

test('other Markdown shortcuts also take priority over the default keymap', () => {
	for (const [key, expected] of [
		['Mod-b', 'before **word** after'],
		['Mod-Shift-x', 'before ~~word~~ after'],
		['Mod-e', 'before `word` after'],
		['Mod-k', 'before [word](https://) after'],
	]) {
		const view = editor('before word after', EditorSelection.range(7, 11))
		assert.equal(view.press(key), true)
		assert.equal(view.state.doc.toString(), expected, key)
	}
})
