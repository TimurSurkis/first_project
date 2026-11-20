import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, CloudWorkspace, ApiError
before(async () => {
	server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
	;({ CloudWorkspace } = await server.ssrLoadModule('/src/cloudWorkspace.ts'))
	;({ ApiError } = await server.ssrLoadModule('/src/api/client.ts'))
})
after(async () => { await server?.close() })

const initial = () => ({ id: 1, name: 'note.md', content: 'original', version: 1, deletedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
function setup(overrides = {}) {
	const api = { get: async () => initial(), update: async (_id, version) => ({ version: version + 1 }), create: async (name, content) => ({ ...initial(), id: 2, name, content }), ...overrides }
	const workspace = new CloudWorkspace(api)
	workspace.accept(initial())
	return workspace
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }

test('serializes saves and never marks newer edits as saved by an old response', async () => {
	const wait = deferred()
	let calls = 0
	const workspace = setup({ update: async () => { calls++; return wait.promise } })
	workspace.edit(1, { text: 'first' })
	const job = workspace.save(1)
	assert.equal(workspace.save(1), job)
	workspace.edit(1, { text: 'second' })
	wait.resolve({ version: 2 })
	await job
	assert.equal(calls, 1)
	const doc = workspace.getSnapshot().docs[0]
	assert.equal(doc.savedText, 'first')
	assert.equal(doc.text, 'second')
	assert.equal(doc.status, 'dirty')
	assert.equal(doc.version, 2)
})

test('conflicts preserve local edits and block all subsequent autosaves', async () => {
	let calls = 0
	const workspace = setup({ update: async () => { calls++; throw new ApiError(409, 'VERSION_CONFLICT', 'changed') } })
	workspace.edit(1, { text: 'local' })
	await workspace.save(1)
	workspace.edit(1, { text: 'more local' })
	await workspace.save(1)
	assert.equal(calls, 1)
	assert.equal(workspace.getSnapshot().docs[0].status, 'conflict')
	assert.equal(workspace.getSnapshot().docs[0].text, 'more local')
})

test('lost save responses are reconciled before retry without duplicate writes', async () => {
	let remote = initial(), calls = 0
	const workspace = setup({ get: async () => remote, update: async (_id, version, name, content) => {
		calls++; remote = { ...remote, version: version + 1, name, content }
		throw new ApiError(0, 'NETWORK', 'response lost')
	} })
	workspace.edit(1, { text: 'committed' })
	await workspace.save(1)
	assert.equal(workspace.getSnapshot().docs[0].status, 'error')
	await workspace.save(1)
	assert.equal(calls, 1)
	assert.equal(workspace.getSnapshot().docs[0].status, 'saved')
	assert.equal(workspace.getSnapshot().docs[0].version, 2)
})

test('refresh never discards edits made while the GET request was pending', async () => {
	const wait = deferred()
	const workspace = setup({ get: () => wait.promise })
	const refresh = workspace.refresh()
	workspace.edit(1, { text: 'typed while loading' })
	wait.resolve({ ...initial(), version: 2, content: 'remote' })
	await refresh
	assert.equal(workspace.getSnapshot().docs[0].text, 'typed while loading')
	assert.equal(workspace.getSnapshot().docs[0].status, 'conflict')
})

test('trash detected on refresh preserves text and never triggers a save', async () => {
	const workspace = setup({ get: async () => ({ ...initial(), deletedAt: new Date().toISOString(), version: 2 }) })
	await workspace.refresh()
	assert.equal(workspace.getSnapshot().docs[0].status, 'conflict')
	assert.equal(workspace.getSnapshot().docs[0].text, 'original')
})

test('closing the last tab does not create or delete any cloud document', () => {
	const workspace = setup()
	workspace.close(1)
	assert.deepEqual(workspace.getSnapshot(), { docs: [], activeId: null })
})

test('paused sessions cannot save; rename is dirty and is saved with the text', async () => {
	let payload
	const workspace = setup({ update: async (...args) => { payload = args; return { version: 2 } } })
	workspace.edit(1, { docName: 'renamed.md' })
	workspace.paused = true
	await workspace.save(1)
	assert.equal(payload, undefined)
	workspace.paused = false
	await workspace.save(1)
	assert.deepEqual(payload, [1, 1, 'renamed.md', 'original'])
	assert.equal(workspace.getSnapshot().docs[0].savedName, 'renamed.md')
})

test('a stale refresh response cannot roll back a more recently acknowledged save', async () => {
	const wait = deferred()
	const workspace = setup({ get: () => wait.promise })
	const refresh = workspace.refresh()
	workspace.edit(1, { text: 'newly saved' })
	await workspace.save(1)
	wait.resolve(initial())
	await refresh
	assert.equal(workspace.getSnapshot().docs[0].text, 'newly saved')
	assert.equal(workspace.getSnapshot().docs[0].version, 2)
})

test('copying a conflicting document preserves its local text independently', async () => {
	const workspace = setup({ update: async () => { throw new ApiError(409, 'VERSION_CONFLICT', 'changed') } })
	workspace.edit(1, { text: 'keep this' })
	await workspace.save(1)
	await workspace.copy(1)
	assert.equal(workspace.getSnapshot().docs[0].text, 'keep this')
	assert.equal(workspace.getSnapshot().docs[0].status, 'conflict')
	assert.equal(workspace.getSnapshot().docs[1].text, 'keep this')
	assert.equal(workspace.getSnapshot().docs[1].status, 'saved')
})
