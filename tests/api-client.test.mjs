import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, client
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const auth = (csrfToken, id = 1) => ({ user: { id, email: 'test@example.com' }, csrfToken, expiresAt: new Date(Date.now() + 86400000).toISOString() })
before(async () => {
	server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
	client = await server.ssrLoadModule('/src/api/client.ts')
})
after(async () => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; await server?.close() })

test('same-account session renewal refreshes CSRF and retries a rejected write exactly once', async () => {
	globalThis.window = new EventTarget()
	const renewed = []
	window.addEventListener('editor:session-refreshed', (event) => renewed.push(event.detail))
	globalThis.fetch = async () => Response.json(auth('old-token'))
	await client.authApi.login('login', 'test@example.com', 'test-password')
	const calls = []
	globalThis.fetch = async (url, options) => {
		calls.push([url, options.headers.get('X-CSRF-Token'), options.headers.get('X-Editor-User')])
		if (url === '/api/auth/me') return Response.json(auth('new-token'))
		if (options.headers.get('X-CSRF-Token') === 'old-token') return Response.json({ error: { code: 'CSRF', message: 'changed' } }, { status: 403 })
		return Response.json({ version: 2 })
	}
	assert.deepEqual(await client.documentsApi.update(1, 1, 'note.md', 'text'), { version: 2 })
	assert.deepEqual(calls.map((call) => call[0]), ['/api/documents/1', '/api/auth/me', '/api/documents/1'])
	assert.equal(calls[2][1], 'new-token')
	assert.equal(calls[2][2], '1')
	assert.equal(renewed.length, 1)
})

test('a different account never receives a retried write from the old workspace', async () => {
	globalThis.window = new EventTarget()
	let expired = 0, writes = 0
	window.addEventListener('editor:unauthorized', () => expired++)
	globalThis.fetch = async () => Response.json(auth('original-account-token', 1))
	await client.authApi.login('login', 'test@example.com', 'test-password')
	globalThis.fetch = async (url) => {
		if (url === '/api/auth/me') return Response.json(auth('other-account-token', 2))
		writes++
		return Response.json({ error: { code: 'CSRF', message: 'changed' } }, { status: 403 })
	}
	await assert.rejects(client.documentsApi.update(1, 1, 'note.md', 'private'), /changed/)
	assert.equal(writes, 1)
	assert.equal(expired, 1)
})

test('late unauthorized responses from an old session do not invalidate a newer login', async () => {
	globalThis.window = new EventTarget()
	let expired = 0, finish
	window.addEventListener('editor:unauthorized', () => expired++)
	globalThis.fetch = async () => Response.json(auth('before-login'))
	await client.authApi.login('login', 'test@example.com', 'test-password')
	globalThis.fetch = () => new Promise((resolve) => { finish = resolve })
	const oldRequest = client.documentsApi.get(1)
	globalThis.fetch = async () => Response.json(auth('after-login'))
	await client.authApi.login('login', 'test@example.com', 'test-password')
	finish(Response.json({ error: { code: 'UNAUTHORIZED', message: 'expired' } }, { status: 401 }))
	await assert.rejects(oldRequest, /expired/)
	assert.equal(expired, 0)
})
