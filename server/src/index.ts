import { Op } from 'sequelize'
import { readConfig } from './config.js'
import { createDatabase } from './database.js'
import { initModels, Session } from './models.js'
import { createApp } from './app.js'

const config = readConfig()
const database = createDatabase(config)
initModels(database)
await database.authenticate()
const server = createApp(config).listen(config.PORT, config.HOST, () => {
	console.log(`Editor server listening on http://${config.HOST}:${config.PORT}`)
})
const cleanup = setInterval(() => {
	void Session.destroy({ where: { expiresAt: { [Op.lte]: new Date() } } }).catch(console.error)
}, 60 * 60 * 1000)
cleanup.unref()

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => {
		clearInterval(cleanup)
		server.close(() => { void database.close().then(() => process.exit(0)) })
		setTimeout(() => process.exit(1), 10000).unref()
	})
}
