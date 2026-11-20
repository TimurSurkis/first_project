export interface PublicUser {
	id: number
	email: string
}

export interface AuthResponse {
	user: PublicUser
	csrfToken: string
	expiresAt: string
}

export interface DocumentSummary {
	id: number
	name: string
	version: number
	deletedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface CloudDocument extends DocumentSummary {
	content: string
}

export interface DocumentPage {
	items: DocumentSummary[]
	nextOffset: number | null
}

export interface ApiErrorBody {
	error: { code: string; message: string }
}
