import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	HOST: z.string().default('127.0.0.1'),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	APP_ORIGIN: z.string().url().default('http://localhost:5173'),
	DB_HOST: z.string().default('127.0.0.1'),
	DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
	DB_NAME: z.string().min(1).default('text_editor'),
	DB_USER: z.string().min(1).default('text_editor'),
	DB_PASSWORD: z.string().min(1),
})

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
	const value = schema.parse(env)
	const url = new URL(value.APP_ORIGIN)
	if (url.origin !== value.APP_ORIGIN || url.username || url.password) {
		throw new Error('APP_ORIGIN must be an exact HTTP(S) origin without a path')
	}
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid APP_ORIGIN protocol')
	if (value.NODE_ENV === 'production' && url.protocol !== 'https:') {
		throw new Error('Production requires an HTTPS APP_ORIGIN')
	}
	return value
}

export type Config = ReturnType<typeof readConfig>
