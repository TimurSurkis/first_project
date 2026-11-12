declare module 'mammoth' {
	interface MammothImage {
		src?: string
	}

	interface MammothApi {
		convertToHtml(
			input: { path: string },
			options?: {
				convertImage?: (image: MammothImage) => Promise<{ src: string }>
			},
		): Promise<{ value: string }>
		images: {
			imgElement(
				convert: (image: MammothImage) => Promise<{ src: string }>,
			): (image: MammothImage) => Promise<{ src: string }>
		}
	}

	const mammoth: MammothApi
	export default mammoth
}
