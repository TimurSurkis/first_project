import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Config } from '../config.js'
import { credentialsSchema } from '../validation.js'
import { createSession, login, register, SESSION_MS } from '../services/auth.js'
import { requireSession } from '../middleware/auth.js'
import { User } from '../models.js'
import { HttpError } from '../errors.js'

export function authRouter(config: Config) {
	const router = Router()
	const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
		handler: (_request, response) => response.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Too many login attempts. Try again later.' } }),
	})
	const cookieOptions = { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' }
	for (const action of ['register', 'login'] as const) {
		router.post(`/${action}`, limiter, async (request, response) => {
			const { email, password } = credentialsSchema.parse(request.body)
			const user = await (action === 'register' ? register(email, password) : login(email, password))
			const { token, session } = await createSession(user)
			response.cookie('editor_session', token, { ...cookieOptions, maxAge: SESSION_MS })
			response.status(action === 'register' ? 201 : 200).json({
				user: { id: user.id, email: user.email }, csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString(),
			})
		})
	}
	router.get('/me', requireSession, async (_request, response) => {
		const session = response.locals.session
		const user = await User.findByPk(session.userId)
		if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in')
		response.json({ user: { id: user.id, email: user.email }, csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() })
	})
	router.post('/logout', requireSession, async (_request, response) => {
		await response.locals.session.destroy()
		response.clearCookie('editor_session', cookieOptions).status(204).end()
	})
	return router
}
