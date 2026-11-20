import { Sequelize } from 'sequelize'
import type { Config } from './config.js'

export function createDatabase(config: Config) {
	return new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASSWORD, {
		dialect: 'mysql',
		host: config.DB_HOST,
		port: config.DB_PORT,
		logging: false,
		timezone: '+00:00',
		dialectOptions: { charset: 'utf8mb4' },
		define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
		pool: { max: 10, min: 0, acquire: 10000 },
	})
}
