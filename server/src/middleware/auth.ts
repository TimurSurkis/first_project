import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import type { Session } from '../models.js'
import { findSession } from '../services/auth.js'
import { HttpError } from '../errors.js'

declare global {
	namespace Express {
		interface Locals { session: Session }
	}
}

export const requireSession: RequestHandler = async (request, response, next) => {
	const session = await findSession(request.cookies.editor_session)
	if (!session) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in')
	const expectedUser = request.get('X-Editor-User')
	if (expectedUser !== undefined && expectedUser !== String(session.userId)) {
		throw new HttpError(401, 'SESSION_CHANGED', 'The active account changed in another window. Please sign in again.')
	}
	response.locals.session = session
	if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
		const supplied = request.get('X-CSRF-Token') ?? ''
		const expected = session.csrfToken
		if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
			throw new HttpError(403, 'CSRF', 'Invalid CSRF token')
		}
	}
	next()
}
