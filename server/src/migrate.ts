import { Umzug, SequelizeStorage } from 'umzug'
import { readConfig } from './config.js'
import { createDatabase } from './database.js'
import { up } from '../migrations/001-initial.js'

export async function migrate(database: ReturnType<typeof createDatabase>) {
	const runner = new Umzug({
		migrations: [{ name: '001-initial', up }],
		context: database.getQueryInterface(),
		storage: new SequelizeStorage({ sequelize: database }),
		logger: console,
	})
	await runner.up()
}

// The separate entry point avoids migrations running during application imports.
if (process.argv[1]?.match(/(?:^|\/)migrate\.(?:ts|js)$/)) {
	const database = createDatabase(readConfig())
	try {
		await database.authenticate()
		await migrate(database)
	} finally {
		await database.close()
	}
}
