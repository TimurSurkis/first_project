import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { requireSession } from '../middleware/auth.js'
import { Document } from '../models.js'
import { full, listDocuments, mutateDocument, ownedDocument } from '../repositories/documents.js'
import { contentSchema, idSchema, nameSchema, versionSchema } from '../validation.js'
import { convertImport } from '../services/import.js'
import { HttpError } from '../errors.js'

export function documentsRouter() {
	const router = Router()
	router.use(requireSession)
	router.get('/', async (request, response) => {
		const { deleted, offset, limit } = z.object({
			deleted: z.enum(['true', 'false']).default('false'),
			offset: z.coerce.number().int().min(0).max(1000000).default(0),
			limit: z.coerce.number().int().min(1).max(100).default(50),
		}).parse(request.query)
		response.json(await listDocuments(response.locals.session.userId, deleted === 'true', offset, limit))
	})
	router.post('/', async (request, response) => {
		const data = z.object({ name: nameSchema, content: contentSchema.default('') }).strict().parse(request.body)
		response.status(201).json(full(await Document.create({ ...data, ownerId: response.locals.session.userId })))
	})
	const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } })
	router.post('/import', upload.single('file'), async (request, response) => {
		if (!request.file) throw new HttpError(400, 'IMPORT_FAILED', 'Choose a file')
		// Browser multipart filenames are UTF-8, while Busboy's default parameter charset is latin1.
		let name = request.file.originalname
		if (![...name].some((char) => char.charCodeAt(0) > 255)) {
			try { name = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(name, 'latin1')) }
			catch { /* Already decoded filename from clients using filename*. */ }
		}
		const data = await convertImport(name, request.file.buffer)
		response.status(201).json(full(await Document.create({ ...data, ownerId: response.locals.session.userId })))
	})
	router.get('/:id', async (request, response) => {
		response.json(full(await ownedDocument(response.locals.session.userId, idSchema.parse(request.params.id))))
	})
	router.patch('/:id', async (request, response) => {
		const { version, ...patch } = z.object({ version: versionSchema, name: nameSchema.optional(), content: contentSchema.optional() })
			.strict().refine((data) => data.name !== undefined || data.content !== undefined).parse(request.body)
		response.json(await mutateDocument(response.locals.session.userId, idSchema.parse(request.params.id), version, 'update', patch))
	})
	for (const action of ['trash', 'restore', 'delete'] as const) {
		const handler = async (request: import('express').Request, response: import('express').Response) => {
			const { version } = z.object({ version: versionSchema }).strict().parse(request.body)
			response.json(await mutateDocument(response.locals.session.userId, idSchema.parse(request.params.id), version, action))
		}
		if (action === 'delete') router.delete('/:id', handler)
		else router.post(`/:id/${action}`, handler)
	}
	return router
}
