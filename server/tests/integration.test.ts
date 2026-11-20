import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import request from 'supertest'
import { readConfig } from '../src/config.js'
import { createDatabase } from '../src/database.js'
import { initModels, Session, User } from '../src/models.js'
import { migrate } from '../src/migrate.js'
import { createApp } from '../src/app.js'

test('MySQL integration: sessions, ownership, version conflicts and trash', { skip: !process.env.TEST_DB_NAME }, async (suite) => {
	const name = process.env.TEST_DB_NAME!
	assert.match(name, /_test$/, 'Use a dedicated database ending in _test')
	const config = readConfig({ ...process.env, NODE_ENV: 'test', DB_NAME: name })
	const database = createDatabase(config)
	initModels(database)
	const owners: number[] = []
	try {
		await database.authenticate()
		await migrate(database)
		await migrate(database) // Already applied migrations must not run again.
		const app = createApp(config)
		const alice = request.agent(app)
		const bob = request.agent(app)
		const email = `${randomUUID()}@example.com`
		const password = 'integration-password-123'
		const origin = { Origin: config.APP_ORIGIN, 'X-Editor-Request': '1' }
		const started = Date.now()
		const registration = await alice.post('/api/auth/register').set(origin).send({ email, password }).expect(201)
		owners.push(registration.body.user.id)
		const csrf = registration.body.csrfToken
		const headers = { ...origin, 'X-CSRF-Token': csrf }
		const other = await bob.post('/api/auth/register').set(origin).send({ email: `${randomUUID()}@example.com`, password }).expect(201)
		owners.push(other.body.user.id)
		const otherHeaders = { ...origin, 'X-CSRF-Token': other.body.csrfToken }

		await suite.test('session is fixed at 24 hours, uses HttpOnly and does not roll on access', async () => {
			const duration = new Date(registration.body.expiresAt).getTime() - started
			assert.ok(duration >= 86400000 && duration < 86410000)
			assert.match(registration.headers['set-cookie'][0], /HttpOnly/)
			assert.match(registration.headers['set-cookie'][0], /SameSite=Strict/)
			const me = await alice.get('/api/auth/me').expect(200)
			assert.equal(me.body.expiresAt, registration.body.expiresAt)
			assert.equal(me.headers['set-cookie'], undefined)
			const stored = await Session.findOne({ where: { userId: registration.body.user.id } })
			assert.ok(stored)
			assert.equal(registration.headers['set-cookie'][0].includes(stored.tokenHash), false)
		})
		await suite.test('authentication and CSRF checks reject invalid requests', async () => {
			await request(app).post('/api/auth/login').set(origin).send({ email, password: 'wrong-but-long-enough' }).expect(401)
			await request(app).post('/api/auth/register').set(origin).send({ email, password }).expect(409)
			await alice.post('/api/documents').set(origin).send({ name: 'blocked.md' }).expect(403)
			await alice.post('/api/documents').set({ ...headers, 'X-CSRF-Token': 'a'.repeat(64) }).send({ name: 'blocked.md' }).expect(403)
		})
		const created = await alice.post('/api/documents').set(headers).send({ name: 'Заметка.md', content: '# Привет 😀' }).expect(201)
		const id = created.body.id
		await suite.test('lists only metadata and never exposes another user’s documents', async () => {
			await alice.get('/api/documents').set('X-Editor-User', String(other.body.user.id)).expect(401)
			const list = await alice.get('/api/documents').expect(200)
			assert.equal(list.body.items[0].content, undefined)
			assert.equal((await bob.get('/api/documents').expect(200)).body.items.length, 0)
			await bob.get(`/api/documents/${id}`).expect(404)
			await bob.patch(`/api/documents/${id}`).set(otherHeaders).send({ version: 1, content: 'attack' }).expect(404)
			await bob.post(`/api/documents/${id}/trash`).set(otherHeaders).send({ version: 1 }).expect(404)
			await alice.patch(`/api/documents/${id}`).set(headers).send({ version: 1, ownerId: owners[1] }).expect(400)
		})
		await suite.test('exactly one concurrent writer wins and content survives', async () => {
			const results = await Promise.all(['first', 'second'].map((content) => alice.patch(`/api/documents/${id}`).set(headers).send({ version: 1, content })))
			assert.deepEqual(results.map((result) => result.status).sort(), [200, 409])
			const current = await alice.get(`/api/documents/${id}`).expect(200)
			assert.equal(current.body.version, 2)
			assert.ok(['first', 'second'].includes(current.body.content))
		})
		await suite.test('trash/restore bump versions and stale autosaves cannot restore deleted files', async () => {
			await alice.delete(`/api/documents/${id}`).set(headers).send({ version: 2 }).expect(409)
			await alice.post(`/api/documents/${id}/trash`).set(headers).send({ version: 2 }).expect(200)
			assert.equal((await alice.get('/api/documents').expect(200)).body.items.length, 0)
			assert.equal((await alice.get('/api/documents?deleted=true').expect(200)).body.items[0].id, id)
			await alice.patch(`/api/documents/${id}`).set(headers).send({ version: 2, content: 'stale' }).expect(409)
			await alice.patch(`/api/documents/${id}`).set(headers).send({ version: 3, content: 'still blocked' }).expect(409)
			await alice.post(`/api/documents/${id}/restore`).set(headers).send({ version: 3 }).expect(200)
			const restored = await alice.get(`/api/documents/${id}`).expect(200)
			assert.equal(restored.body.version, 4)
			assert.equal(restored.body.deletedAt, null)
			await alice.post(`/api/documents/${id}/trash`).set(headers).send({ version: 4 }).expect(200)
			await alice.delete(`/api/documents/${id}`).set(headers).send({ version: 5 }).expect(200)
			await alice.get(`/api/documents/${id}`).expect(404)
		})
		await suite.test('imports UTF-8 and rejects legacy DOC and invalid names', async () => {
			const imported = await alice.post('/api/documents/import').set(headers).attach('file', Buffer.from('# Текст 😀'), 'Текст.md').expect(201)
			assert.equal(imported.body.name, 'Текст.md')
			assert.equal(imported.body.content, '# Текст 😀')
			await alice.post('/api/documents/import').set(headers).attach('file', Buffer.from('legacy'), 'file.doc').expect(400)
			await alice.post('/api/documents').set(headers).send({ name: '../bad.md' }).expect(400)
		})
		await suite.test('expired sessions are rejected and logout revokes them', async () => {
			await Session.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { userId: owners[0] } })
			await alice.get('/api/auth/me').expect(401)
			await alice.post('/api/documents').set(headers).send({ name: 'expired.md' }).expect(401)
			const signedIn = await alice.post('/api/auth/login').set(origin).send({ email, password }).expect(200)
			await alice.post('/api/auth/logout').set({ ...origin, 'X-CSRF-Token': signedIn.body.csrfToken }).expect(204)
			await alice.get('/api/auth/me').expect(401)
		})
	} finally {
		for (const id of owners) await User.destroy({ where: { id } })
		await database.close()
	}
})
