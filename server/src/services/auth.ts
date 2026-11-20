import { randomBytes, randomUUID } from 'node:crypto'
import { Op, UniqueConstraintError } from 'sequelize'
import { Session, User } from '../models.js'
import { HttpError } from '../errors.js'
import { hashPassword, hashToken, verifyPassword } from './passwords.js'

export const SESSION_MS = 24 * 60 * 60 * 1000

export async function createSession(user: User) {
	const token = randomBytes(32).toString('hex')
	const session = await Session.create({
		id: randomUUID(), userId: user.id, tokenHash: hashToken(token),
		csrfToken: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + SESSION_MS),
	})
	return { token, session }
}

export async function register(email: string, password: string) {
	try {
		return await User.create({ email, passwordHash: await hashPassword(password) })
	} catch (error) {
		if (error instanceof UniqueConstraintError) throw new HttpError(409, 'EMAIL_EXISTS', 'Email is already registered')
		throw error
	}
}

// A real dummy hash keeps unknown-user login checks on the same expensive path.
let dummyHash: Promise<string> | undefined
export async function login(email: string, password: string) {
	const user = await User.findOne({ where: { email } })
	dummyHash ??= hashPassword(randomBytes(32).toString('hex'))
	const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash)
	if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
	return user
}

export async function findSession(token: unknown) {
	if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
	return Session.findOne({ where: { tokenHash: hashToken(token), expiresAt: { [Op.gt]: new Date() } } })
}
