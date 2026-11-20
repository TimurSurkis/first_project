import { Op, literal } from 'sequelize'
import { Document } from '../models.js'
import { HttpError } from '../errors.js'
import type { CloudDocument, DocumentSummary } from '../../../shared/api.js'

export function summary(document: Document): DocumentSummary {
	return {
		id: document.id, name: document.name, version: document.version,
		deletedAt: document.deletedAt?.toISOString() ?? null,
		createdAt: document.createdAt.toISOString(), updatedAt: document.updatedAt.toISOString(),
	}
}

export function full(document: Document): CloudDocument {
	return { ...summary(document), content: document.content }
}

export async function ownedDocument(ownerId: number, id: number) {
	const document = await Document.findOne({ where: { ownerId, id } })
	if (!document) throw new HttpError(404, 'NOT_FOUND', 'Document not found')
	return document
}

export async function listDocuments(ownerId: number, deleted: boolean, offset: number, limit: number) {
	const items = await Document.findAll({
		where: { ownerId, deletedAt: deleted ? { [Op.ne]: null } : null },
		attributes: ['id', 'name', 'version', 'deletedAt', 'createdAt', 'updatedAt'],
		order: [['id', 'DESC']], offset, limit: limit + 1,
	})
	return { items: items.slice(0, limit).map(summary), nextOffset: items.length > limit ? offset + limit : null }
}

// The version/state predicate is part of the UPDATE, never a read-then-write check.
export async function mutateDocument(ownerId: number, id: number, version: number,
	action: 'update' | 'trash' | 'restore' | 'delete', patch: { name?: string; content?: string } = {}) {
	const deleted = action === 'restore' || action === 'delete'
	const where = { id, ownerId, version, deletedAt: deleted ? { [Op.ne]: null } : null }
	const affected = action === 'delete'
		? await Document.destroy({ where })
		: (await Document.update({
			...patch,
			...(action === 'trash' ? { deletedAt: new Date() } : action === 'restore' ? { deletedAt: null } : {}),
			version: literal('version + 1'),
		}, { where }))[0]
	if (!affected) {
		await ownedDocument(ownerId, id)
		throw new HttpError(409, 'VERSION_CONFLICT', 'Document changed or moved to trash in another window')
	}
	// Return the exact acknowledged version, not a later writer's content.
	return { version: version + 1 }
}
