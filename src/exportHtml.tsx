import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ExportHtmlPayload, Language } from '../shared/electron-api'

const styles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff; color: #1f1f1f;
    font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  main { max-width: 900px; margin: 0 auto; padding: 32px 24px; overflow-wrap: anywhere; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.5em 0 .6em; }
  h1, h2 { padding-bottom: .3em; border-bottom: 1px solid #e3e3e6; }
  a { color: #1765cc; }
  img { max-width: 100%; height: auto; }
  blockquote { margin: 1em 0; padding: 0 1em; border-left: 4px solid #d4d4d8; color: #626772; }
  code, pre { background: #f3f3f5; border-radius: 6px; font-family: ui-monospace, monospace; }
  code { padding: .15em .35em; }
  pre { padding: 16px; overflow-x: auto; overflow-wrap: normal; }
  pre code { padding: 0; }
  table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
  th, td { padding: 8px 12px; border: 1px solid #d4d4d8; }
  th { background: #f6f6f7; }
  ul, ol { padding-left: 2em; }
  .contains-task-list { list-style: none; padding-left: 1em; }
  .task-list-item input { margin-right: .5em; }
  hr { border: 0; border-top: 1px solid #e3e3e6; margin: 2em 0; }
  @media (max-width: 600px) { main { padding: 16px; } }
`

/** Render from the current text, independently of the preview DOM or editor theme. */
export function createHtmlExport(
	text: string,
	docName: string,
	language: Language,
): ExportHtmlPayload {
	const title = docName.replace(/\.md$/i, '')
	const html = renderToStaticMarkup(
		<html lang={language}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title}</title>
				<style>{styles}</style>
			</head>
			<body>
				<main>
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
				</main>
			</body>
		</html>,
	)
	return { content: `<!DOCTYPE html>\n${html}`, defaultName: `${title}.html` }
}
