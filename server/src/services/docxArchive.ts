import { fromBuffer } from 'yauzl'
import type { Readable } from 'node:stream'
import { HttpError } from '../errors.js'

/** Validate actual inflated sizes before Mammoth/JSZip materialize XML in memory. */
export function validateDocxArchive(buffer: Buffer): Promise<void> {
	return new Promise((resolve, reject) => {
		fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
			if (error || !zip) { reject(new HttpError(400, 'IMPORT_FAILED', 'Invalid DOCX archive')); return }
			let count = 0, declared = 0, inflated = 0, finished = false
			let stream: Readable | null = null
			const timer = setTimeout(() => finish('DOCX validation timed out'), 10000)
			timer.unref()
			function finish(message?: string) {
				if (finished) return
				finished = true
				clearTimeout(timer)
				stream?.destroy()
				zip.close()
				if (message) reject(new HttpError(400, 'IMPORT_FAILED', message))
				else resolve()
			}
			zip.on('error', () => finish('Invalid DOCX archive'))
			zip.on('end', () => finish())
			zip.on('entry', (entry) => {
				if (finished) return
				declared += entry.uncompressedSize
				if (++count > 1000 || declared > 20 * 1024 * 1024 || entry.isEncrypted()) {
					finish('DOCX archive exceeds safe import limits'); return
				}
				if (entry.fileName.endsWith('/')) { zip.readEntry(); return }
				zip.openReadStream(entry, (readError, source) => {
					if (finished) { source?.destroy(); return }
					if (readError || !source) { finish('Cannot read DOCX archive'); return }
					stream = source
					source.on('data', (chunk: Buffer) => {
						inflated += chunk.length
						if (inflated > 20 * 1024 * 1024) finish('DOCX archive exceeds safe import limits')
					})
					source.on('error', () => finish('Invalid DOCX archive entry'))
					source.on('end', () => { stream = null; if (!finished) zip.readEntry() })
				})
			})
			zip.readEntry()
		})
	})
}
