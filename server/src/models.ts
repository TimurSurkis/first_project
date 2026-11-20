import { DataTypes, Model } from 'sequelize'
import type { Sequelize, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
	declare id: CreationOptional<number>
	declare email: string
	declare passwordHash: string
	declare createdAt: CreationOptional<Date>
	declare updatedAt: CreationOptional<Date>
}

export class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
	declare id: string
	declare userId: number
	declare tokenHash: string
	declare csrfToken: string
	declare expiresAt: Date
	declare createdAt: CreationOptional<Date>
}

export class Document extends Model<InferAttributes<Document>, InferCreationAttributes<Document>> {
	declare id: CreationOptional<number>
	declare ownerId: number
	declare name: string
	declare content: string
	declare version: CreationOptional<number>
	declare deletedAt: CreationOptional<Date | null>
	declare createdAt: CreationOptional<Date>
	declare updatedAt: CreationOptional<Date>
}

export function initModels(database: Sequelize) {
	User.init({
		id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
		email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
		passwordHash: { type: DataTypes.STRING(255), allowNull: false },
		createdAt: DataTypes.DATE(3),
		updatedAt: DataTypes.DATE(3),
	}, { sequelize: database, tableName: 'users' })
	Session.init({
		id: { type: DataTypes.UUID, primaryKey: true },
		userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
		tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
		csrfToken: { type: DataTypes.STRING(64), allowNull: false },
		expiresAt: { type: DataTypes.DATE(3), allowNull: false },
		createdAt: DataTypes.DATE(3),
	}, { sequelize: database, tableName: 'sessions', updatedAt: false })
	Document.init({
		id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
		ownerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
		name: { type: DataTypes.STRING(255), allowNull: false },
		content: { type: DataTypes.TEXT('long'), allowNull: false },
		version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
		deletedAt: { type: DataTypes.DATE(3), allowNull: true, defaultValue: null },
		createdAt: DataTypes.DATE(3),
		updatedAt: DataTypes.DATE(3),
	}, { sequelize: database, tableName: 'documents' })
	User.hasMany(Document, { foreignKey: 'ownerId', onDelete: 'CASCADE' })
	Document.belongsTo(User, { foreignKey: 'ownerId' })
	User.hasMany(Session, { foreignKey: 'userId', onDelete: 'CASCADE' })
	Session.belongsTo(User, { foreignKey: 'userId' })
}
