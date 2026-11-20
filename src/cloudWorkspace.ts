import { ApiError } from './api/client'
import type { DocumentsApi } from './api/client'
import type { CloudDocument, DocumentSummary } from '../shared/api'
import type { DocumentId, EditorDocument, TabsState } from './types'

export function isDirty(doc: EditorDocument) {
	return doc.text !== doc.savedText || doc.docName !== doc.savedName
}

function fromServer(doc: CloudDocument): EditorDocument {
	return {
		id: doc.id, docName: doc.name, savedName: doc.name, text: doc.content, savedText: doc.content,
		version: doc.version, status: 'saved', error: null, mode: 'edit', cursor: { line: 1, col: 1 },
	}
}

interface Attempt { version: number; name: string; content: string }

/** One workspace per account; each document has at most one in-flight save. */
export class CloudWorkspace {
	private state: TabsState = { docs: [], activeId: null }
	private listeners = new Set<() => void>()
	private pending = new Map<number, Promise<void>>()
	private uncertain = new Map<number, Attempt>()
	private disposed = false
	paused = false

	constructor(private api: DocumentsApi) {}
	connect() { this.disposed = false }
	getSnapshot = () => this.state
	subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
	dispose() { this.disposed = true; this.listeners.clear() }
	private emit(state: TabsState) {
		if (this.disposed) return
		this.state = state
		for (const listener of this.listeners) listener()
	}
	patch(id: DocumentId, patch: Partial<EditorDocument>) {
		this.emit({ ...this.state, docs: this.state.docs.map((doc) => doc.id === id ? { ...doc, ...patch } : doc) })
	}
	edit(id: number, patch: { text?: string; docName?: string }) {
		const doc = this.state.docs.find((item) => item.id === id)
		if (!doc) return
		this.patch(id, { ...patch, status: ['conflict', 'error', 'saving'].includes(doc.status) ? doc.status : isDirty({ ...doc, ...patch }) ? 'dirty' : 'saved' })
	}
	activate(id: number) { this.emit({ ...this.state, activeId: id }) }
	cycle(step: number) {
		const { docs, activeId } = this.state
		const doc = docs[(docs.findIndex((item) => item.id === activeId) + step + docs.length) % docs.length]
		if (doc) this.activate(doc.id)
	}
	close(id: number) {
		if (this.pending.has(id)) return false
		const docs = this.state.docs.filter((doc) => doc.id !== id)
		this.uncertain.delete(id)
		this.emit({ docs, activeId: this.state.activeId === id ? docs.at(-1)?.id ?? null : this.state.activeId })
		return true
	}
	accept(document: CloudDocument) {
		if (this.disposed) return
		if (this.state.docs.some((doc) => doc.id === document.id)) { this.activate(document.id); return }
		this.emit({ docs: [...this.state.docs, fromServer(document)], activeId: document.id })
	}
	async open(id: number) {
		if (this.state.docs.some((doc) => doc.id === id)) { this.activate(id); return }
		const doc = await this.api.get(id)
		if (doc.deletedAt) throw new ApiError(409, 'VERSION_CONFLICT', 'Document is in trash')
		this.accept(doc)
	}
	async create(name: string, content = '') {
		if (this.paused || this.disposed) return
		this.accept(await this.api.create(name, content))
	}
	async copy(id: number) {
		const doc = this.state.docs.find((item) => item.id === id)
		if (doc) await this.create(doc.docName, doc.text)
	}
	async reload(id: number) {
		if (this.pending.has(id)) return
		const fresh = await this.api.get(id)
		if (fresh.deletedAt) throw new ApiError(409, 'VERSION_CONFLICT', 'Document is in trash; restore it first')
		this.uncertain.delete(id)
		this.patch(id, fromServer(fresh))
	}

	save(id: number): Promise<void> {
		const existing = this.pending.get(id)
		if (existing) return existing
		if (this.paused || this.disposed) return Promise.resolve()
		const job = this.performSave(id).finally(() => { this.pending.delete(id) })
		this.pending.set(id, job)
		return job
	}
	private async performSave(id: number) {
		let doc = this.state.docs.find((item) => item.id === id)
		if (!doc || doc.status === 'conflict') return
		this.patch(id, { status: 'saving', error: null })
		try {
			// A timeout can mean "committed, response lost". Read before any retry.
			const attempt = this.uncertain.get(id)
			if (attempt) {
				const remote = await this.api.get(id)
				if (remote.deletedAt) throw new ApiError(409, 'VERSION_CONFLICT', 'Document is in trash')
				if (remote.version === attempt.version + 1 && remote.name === attempt.name && remote.content === attempt.content) {
					this.patch(id, { version: remote.version, savedName: attempt.name, savedText: attempt.content })
				} else if (remote.version !== attempt.version) {
					throw new ApiError(409, 'VERSION_CONFLICT', 'Document changed in another window')
				}
				this.uncertain.delete(id)
			}
			doc = this.state.docs.find((item) => item.id === id)
			if (!doc || this.disposed) return
			if (this.paused) { this.patch(id, { status: isDirty(doc) ? 'error' : 'saved' }); return }
			if (!isDirty(doc)) { this.patch(id, { status: 'saved' }); return }
			const snapshot = { version: doc.version, name: doc.docName, content: doc.text }
			this.uncertain.set(id, snapshot)
			const result = await this.api.update(id, snapshot.version, snapshot.name, snapshot.content)
			this.uncertain.delete(id)
			const current = this.state.docs.find((item) => item.id === id)
			this.patch(id, {
				version: result.version, savedText: snapshot.content, savedName: snapshot.name,
				status: current?.text === snapshot.content && current.docName === snapshot.name ? 'saved' : 'dirty',
			})
		} catch (error) {
			const conflict = error instanceof ApiError && (error.status === 409 || error.status === 404)
			if (conflict) this.uncertain.delete(id)
			this.patch(id, { status: conflict ? 'conflict' : 'error', error: error instanceof Error ? error.message : String(error) })
		}
	}

	async refresh() {
		if (this.paused || this.disposed) return
		await Promise.all(this.state.docs.map(async (snapshot) => {
			if (this.pending.has(snapshot.id) || snapshot.status === 'conflict' || this.uncertain.has(snapshot.id)) return
			try {
				const fresh = await this.api.get(snapshot.id)
				const current = this.state.docs.find((item) => item.id === snapshot.id)
				if (!current || this.pending.has(snapshot.id) || this.uncertain.has(snapshot.id)) return
				if (current.version !== snapshot.version || fresh.version < current.version) return
				if (fresh.deletedAt || fresh.version !== current.version) {
					if (isDirty(current) || fresh.deletedAt) this.patch(snapshot.id, { status: 'conflict' })
					else this.patch(snapshot.id, { ...fromServer(fresh), mode: current.mode, cursor: current.cursor })
				}
			} catch (error) {
				if (error instanceof ApiError && error.status === 404) this.patch(snapshot.id, { status: 'conflict' })
			}
		}))
	}

	async mutate(summary: DocumentSummary, action: 'trash' | 'restore' | 'delete') {
		if (this.paused || this.disposed) return
		// Drain an already-started save before deleting; don't race an autosave.
		const doc = this.state.docs.find((item) => item.id === summary.id)
		if (doc) this.patch(doc.id, { status: 'conflict' })
		await this.pending.get(summary.id)
		const current = this.state.docs.find((item) => item.id === summary.id)
		if (current) this.patch(current.id, { status: 'conflict' })
		await this.api.mutate(summary.id, current?.version ?? summary.version, action)
		if (current) this.close(current.id)
	}
}
