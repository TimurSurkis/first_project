import { z } from 'zod'

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
export const nameSchema = z.string().trim().min(1).max(255)
	.refine((value) => !/[\\/:*?"<>|]/.test(value) && ![...value].some((char) => char.charCodeAt(0) < 32) && value !== '.' && value !== '..', 'Invalid filename')
export const contentSchema = z.string().refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_DOCUMENT_BYTES, 'Document exceeds 2 MiB')
export const versionSchema = z.number().int().positive().max(4294967294)
export const idSchema = z.coerce.number().int().positive().max(4294967295)
export const credentialsSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(254),
	password: z.string().min(10).max(128),
}).strict()
