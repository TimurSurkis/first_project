export function download(content: string, name: string, type = 'text/plain;charset=utf-8') {
	const url = URL.createObjectURL(new Blob([content], { type }))
	const link = document.createElement('a')
	link.href = url
	link.download = name
	document.body.append(link)
	link.click()
	link.remove()
	// Keep the URL alive until the download has been handed to the browser.
	setTimeout(() => URL.revokeObjectURL(url), 60000)
}
