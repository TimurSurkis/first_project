import path from 'node:path'
import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { HttpError } from '../errors.js'
import { contentSchema, nameSchema } from '../validation.js'
import { validateDocxArchive } from './docxArchive.js'

export async function convertImport(originalName: string, buffer: Buffer) {
	let name = path.basename(originalName.replaceAll('\\', '/'))
	const extension = path.extname(name).toLowerCase()
	if (extension === '.doc') throw new HttpError(400, 'DOC_UNSUPPORTED', 'Save the file as DOCX before importing')
	let content: string
	if (extension === '.docx') {
		await validateDocxArchive(buffer)
		try {
			const { value } = await mammoth.convertToHtml({ buffer }, {
				convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
			})
			const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
			converter.addRule('dropImages', { filter: 'img', replacement: () => '' })
			content = converter.turndown(value)
			name = name.slice(0, -extension.length) + '.md'
		} catch {
			throw new HttpError(400, 'IMPORT_FAILED', 'Cannot convert this DOCX file')
		}
	} else {
		try { content = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
		catch { throw new HttpError(400, 'IMPORT_FAILED', 'Only UTF-8 text and DOCX files are supported') }
		if (content.includes('\0')) throw new HttpError(400, 'IMPORT_FAILED', 'Binary files are not supported')
	}
	return { name: nameSchema.parse(name), content: contentSchema.parse(content) }
}
