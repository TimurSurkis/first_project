import { DataTypes } from 'sequelize'
import type { QueryInterface } from 'sequelize'

export async function up({ context: query }: { context: QueryInterface }) {
	const id = { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false }
	const timestamp = { type: DataTypes.DATE(3), allowNull: false }
	const options = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' }
	await query.createTable('users', {
		id,
		email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
		passwordHash: { type: DataTypes.STRING(255), allowNull: false },
		createdAt: timestamp,
		updatedAt: timestamp,
	}, options)
	await query.createTable('sessions', {
		id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
		userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
		tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
		csrfToken: { type: DataTypes.STRING(64), allowNull: false },
		expiresAt: timestamp,
		createdAt: timestamp,
	}, options)
	await query.addIndex('sessions', ['expiresAt'])
	await query.createTable('documents', {
		id,
		ownerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
		name: { type: DataTypes.STRING(255), allowNull: false },
		content: { type: DataTypes.TEXT('long'), allowNull: false },
		version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
		deletedAt: { type: DataTypes.DATE(3), allowNull: true },
		createdAt: timestamp,
		updatedAt: timestamp,
	}, options)
	await query.addIndex('documents', ['ownerId', 'deletedAt', 'id'])
}
