import path from 'node:path'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { ZodError } from 'zod'
import { MulterError } from 'multer'
import type { Config } from './config.js'
import { authRouter } from './routes/auth.js'
import { documentsRouter } from './routes/documents.js'
import { HttpError } from './errors.js'

export function createApp(config: Config) {
	const app = express()
	app.disable('x-powered-by')
	// Only a local reverse proxy is trusted, not arbitrary X-Forwarded-* headers.
	app.set('trust proxy', 'loopback')
	app.use(helmet({
		contentSecurityPolicy: { directives: { 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'https:', 'data:'],
			'upgrade-insecure-requests': config.NODE_ENV === 'production' ? [] : null } },
		strictTransportSecurity: config.NODE_ENV === 'production',
	}))
	app.use('/api', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next() })
	app.use('/api', (request, _response, next) => {
		if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
			if (request.get('Origin') !== config.APP_ORIGIN || request.get('X-Editor-Request') !== '1') {
				throw new HttpError(403, 'ORIGIN', 'Request origin is not allowed')
			}
		}
		next()
	})
	app.use(express.json({ limit: '3mb' }))
	app.use(cookieParser())
	app.get('/api/health', (_request, response) => { response.json({ status: 'ok' }) })
	app.use('/api/auth', authRouter(config))
	app.use('/api/documents', documentsRouter())
	app.use('/api', (_request, _response) => { throw new HttpError(404, 'NOT_FOUND', 'API endpoint not found') })
	const frontend = path.resolve('dist')
	app.use(express.static(frontend, { index: false, maxAge: 0 }))
	app.get('/{*path}', (_request, response, next) => {
		response.set('Cache-Control', 'no-cache')
		response.sendFile(path.join(frontend, 'index.html'), (error) => { if (error) next(error) })
	})
	const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
		if (error instanceof HttpError) {
			response.status(error.status).json({ error: { code: error.code, message: error.message } })
		} else if (error instanceof ZodError) {
			response.status(400).json({ error: { code: 'VALIDATION', message: error.issues.map((issue) => issue.message).join('; ') } })
		} else if (error instanceof MulterError) {
			response.status(400).json({ error: { code: 'IMPORT_FAILED', message: error.message } })
		} else if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413)) {
			response.status(error.status).json({ error: { code: 'VALIDATION', message: 'Invalid or oversized request body' } })
		} else {
			console.error(error)
			response.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } })
		}
	}
	app.use(errors)
	return app
}
