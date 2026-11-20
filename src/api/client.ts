import type { ApiErrorBody, AuthResponse, CloudDocument, DocumentPage } from '../../shared/api'

let csrfToken: string | null = null
let userId: number | null = null

export class ApiError extends Error {
	constructor(public status: number, public code: string, message: string) { super(message) }
}

export async function request<T>(path: string, options: RequestInit = {}, notify = true, retrySession = true): Promise<T> {
	const requestToken = csrfToken
	const requestUser = userId
	const headers = new Headers(options.headers)
	headers.set('X-Editor-Request', '1')
	if (userId !== null && !/^\/auth\/(?:login|register|me)$/.test(path)) headers.set('X-Editor-User', String(userId))
	if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
	if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
	let response: Response
	try { response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' }) }
	catch { throw new ApiError(0, 'NETWORK', 'Cannot connect to the server') }
	if (!response.ok) {
		const body = await response.json().catch(() => null) as ApiErrorBody | null
		// Another window may have renewed the cookie for this same account. The
		// rejected request did not mutate anything; refresh CSRF and retry once.
		if (response.status === 403 && body?.error?.code === 'CSRF' && retrySession && notify && path.startsWith('/documents') && requestUser === userId) {
			if (requestToken !== csrfToken) return request<T>(path, options, notify, false)
			try {
				const fresh = await request<AuthResponse>('/auth/me', {}, false, false)
				if (fresh.user.id === requestUser && requestUser === userId && requestToken === csrfToken) {
					csrfToken = fresh.csrfToken
					window.dispatchEvent(new CustomEvent('editor:session-refreshed', { detail: fresh }))
					return request<T>(path, options, notify, false)
				}
			} catch { /* Expired or changed account: keep local drafts and request login below. */ }
		}
		// A late response from an expired session must not invalidate a newer login.
		if ((response.status === 401 || (response.status === 403 && body?.error?.code === 'CSRF')) && notify && requestToken === csrfToken) {
			window.dispatchEvent(new Event('editor:unauthorized'))
		}
		throw new ApiError(response.status, body?.error?.code ?? 'INTERNAL', body?.error?.message ?? `HTTP ${response.status}`)
	}
	return response.status === 204 ? undefined as T : await response.json() as T
}

export const authApi = {
	async me() {
		const result = await request<AuthResponse>('/auth/me', {}, false)
		csrfToken = result.csrfToken
		userId = result.user.id
		return result
	},
	async login(action: 'login' | 'register', email: string, password: string) {
		const result = await request<AuthResponse>(`/auth/${action}`, { method: 'POST', body: JSON.stringify({ email, password }) }, false)
		csrfToken = result.csrfToken
		userId = result.user.id
		return result
	},
	async logout() {
		await request<void>('/auth/logout', { method: 'POST' })
		csrfToken = null
		userId = null
	},
}

export const documentsApi = {
	list: (deleted = false, offset = 0) => request<DocumentPage>(`/documents?deleted=${deleted}&offset=${offset}`),
	get: (id: number) => request<CloudDocument>(`/documents/${id}`),
	create: (name: string, content = '') => request<CloudDocument>('/documents', { method: 'POST', body: JSON.stringify({ name, content }) }),
	update: (id: number, version: number, name: string, content: string) => request<{ version: number }>(`/documents/${id}`, {
		method: 'PATCH', body: JSON.stringify({ version, name, content }),
	}),
	mutate: (id: number, version: number, action: 'trash' | 'restore' | 'delete') => request<{ version: number }>(
		`/documents/${id}${action === 'delete' ? '' : `/${action}`}`, {
			method: action === 'delete' ? 'DELETE' : 'POST', body: JSON.stringify({ version }),
		}),
	import: (file: File) => {
		const data = new FormData()
		data.append('file', file)
		return request<CloudDocument>('/documents/import', { method: 'POST', body: data })
	},
}

export type DocumentsApi = typeof documentsApi
