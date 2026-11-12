import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let createHtmlExport

before(async () => {
	server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
	const module = await server.ssrLoadModule('/src/exportHtml.tsx')
	createHtmlExport = module.createHtmlExport
})

after(async () => {
	await server?.close()
})

test('creates a standalone UTF-8 document with embedded light styles', () => {
	const result = createHtmlExport('# Привет\n\nТекст & символы', 'Заметка.MD', 'ru')
	assert.equal(result.defaultName, 'Заметка.html')
	assert.ok(result.content.startsWith('<!DOCTYPE html>\n<html lang="ru">'))
	assert.match(result.content, /<meta charSet="utf-8"\/>/i)
	assert.match(result.content, /name="viewport"/)
	assert.match(result.content, /<title>Заметка<\/title>/)
	assert.match(result.content, /<style>[\s\S]*color-scheme: light;[\s\S]*<\/style>/)
	assert.match(result.content, /<h1>Привет<\/h1>/)
	assert.match(result.content, /Текст &amp; символы/)
	assert.ok(result.content.endsWith('</body></html>'))
})

test('renders Markdown and GFM tables, checklists, strikethrough and fenced code', () => {
	const markdown = [
		'# Heading', '', '**bold** *italic* ~~deleted~~ `inline`', '',
		'- item', '', '1. numbered', '', '> quote', '',
		'- [x] done', '- [ ] pending', '',
		'| Left | Right |', '| --- | --- |', '| one | two |', '',
		'```js', 'const value = "<tag>"', '```',
	].join('\n')
	const { content } = createHtmlExport(markdown, 'test.md', 'en')
	for (const tag of ['h1', 'strong', 'em', 'del', 'ul', 'ol', 'blockquote', 'table', 'th', 'td']) {
		assert.ok(content.includes(`<${tag}>`), `missing ${tag}`)
	}
	assert.match(content, /type="checkbox"[^>]*disabled=""[^>]*checked=""/)
	assert.match(content, /<pre><code class="language-js">/)
	assert.match(content, /&lt;tag&gt;/)
})

test('escapes the title and raw HTML, and rejects unsafe link protocols', () => {
	const { content } = createHtmlExport(
		'<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)',
		'</title><script>alert(1)</script>.md',
		'en',
	)
	assert.match(content, /<title>&lt;\/title&gt;&lt;script&gt;/)
	assert.doesNotMatch(content, /<script\b/i)
	assert.doesNotMatch(content, /(?:href|src)="javascript:/i)
	assert.match(content, /&lt;script&gt;/)
})

test('preserves relative links and image addresses without embedding assets', () => {
	const { content } = createHtmlExport(
		'[Guide](docs/guide.md)\n\n![Photo](images/photo.png)', 'links.md', 'en',
	)
	assert.match(content, /href="docs\/guide.md"/)
	assert.match(content, /<img src="images\/photo.png" alt="Photo"/)
	assert.doesNotMatch(content, /data:image/)
})

test('exports an empty or unsaved document without changing the source model', () => {
	const doc = { docName: 'draft.md', text: '# Unsaved edit', savedText: 'Original', filePath: null }
	const snapshot = { ...doc }
	assert.match(createHtmlExport(doc.text, doc.docName, 'en').content, /<h1>Unsaved edit<\/h1>/)
	assert.deepEqual(doc, snapshot)
	assert.match(createHtmlExport('', 'empty.md', 'en').content, /<main><\/main>/)
})
