import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import request from 'supertest'
import { readConfig } from '../src/config.js'
import { createApp } from '../src/app.js'
import { contentSchema, nameSchema } from '../src/validation.js'
import { hashPassword, hashToken, verifyPassword } from '../src/services/passwords.js'
import { convertImport } from '../src/services/import.js'

const config = readConfig({ NODE_ENV: 'test', DB_PASSWORD: 'test-only' })

test('password hashes are salted and verified without storing plaintext', async () => {
	const password = 'a-safe-test-password'
	const first = await hashPassword(password)
	assert.notEqual(first, await hashPassword(password))
	assert.equal(await verifyPassword(password, first), true)
	assert.equal(await verifyPassword('wrong-password', first), false)
	assert.equal(first.includes(password), false)
	assert.equal(hashToken('token').length, 64)
})

test('production requires HTTPS and an exact origin', () => {
	assert.throws(() => readConfig({ NODE_ENV: 'production', DB_PASSWORD: 'x', APP_ORIGIN: 'http://example.com' }))
	assert.throws(() => readConfig({ DB_PASSWORD: 'x', APP_ORIGIN: 'https://example.com/path' }))
})

test('API rejects cross-origin, unmarked and invalid JSON requests', async () => {
	const app = createApp(config)
	await request(app).get('/api/health').expect(200).expect('Cache-Control', 'no-store')
	await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').set('X-Editor-Request', '1').send({}).expect(403)
	await request(app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).send({}).expect(403)
	await request(app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).set('X-Editor-Request', '1').send({ email: 'invalid' }).expect(400)
	await request(app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).set('X-Editor-Request', '1').set('Content-Type', 'application/json').send('{').expect(400)
	await request(app).get('/api/unknown').expect(404).expect('Content-Type', /json/)
	await request(app).get('/api/documents').expect(401)
})

test('filenames and document sizes are validated, including UTF-8 byte limits', () => {
	assert.equal(nameSchema.parse(' Заметка.md '), 'Заметка.md')
	for (const name of ['../file', '..', '.', 'a\0b', '', 'a'.repeat(256)]) assert.equal(nameSchema.safeParse(name).success, false)
	assert.equal(contentSchema.safeParse('😀'.repeat(600000)).success, false)
})

test('server converts DOCX to Markdown and rejects malformed DOCX or binary text', async () => {
	const fixture = await readFile(new URL('./fixtures/minimal.docx.b64', import.meta.url), 'utf8')
	const result = await convertImport('Пример.docx', Buffer.from(fixture.trim(), 'base64'))
	assert.equal(result.name, 'Пример.md')
	assert.equal(result.content, '**Hello DOCX**')
	const oversized = Buffer.from(fixture.trim(), 'base64')
	const central = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
	oversized.writeUInt32LE(21 * 1024 * 1024, central + 24)
	await assert.rejects(convertImport('oversized.docx', oversized), /safe import limits/)
	await assert.rejects(convertImport('bad.docx', Buffer.from('not a ZIP file')))
	await assert.rejects(convertImport('binary.txt', Buffer.from([0xff, 0x00])))
})
