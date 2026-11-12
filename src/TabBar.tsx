import { useEffect, useRef, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { useTranslation } from './i18n/context.ts'
import type { DocumentId, EditorDocument } from './types'

interface TabBarProps {
	docs: EditorDocument[]
	activeId: DocumentId
	onActivate: (id: DocumentId) => void
	onClose: (id: DocumentId) => void
	onRename: (id: DocumentId, name: string) => void
}

function TabBar({ docs, activeId, onActivate, onClose, onRename }: TabBarProps) {
	const { t } = useTranslation()
	const activeRef = useRef<HTMLDivElement>(null)
	const renamingRef = useRef<DocumentId | null>(null)
	const [renamingId, setRenamingId] = useState<DocumentId | null>(null)
	const [draft, setDraft] = useState('')

	useEffect(() => {
		activeRef.current?.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
		})
	}, [activeId])

	function startRename(doc: EditorDocument): void {
		renamingRef.current = doc.id
		setDraft(doc.docName)
		setRenamingId(doc.id)
	}

	function commitRename() {
		const id = renamingRef.current
		if (id === null) return
		renamingRef.current = null
		setRenamingId(null)
		onRename(id, draft)
	}

	function cancelRename() {
		renamingRef.current = null
		setRenamingId(null)
	}

	return (
		<div
			className="tabbar"
			role="tablist"
			aria-orientation="vertical"
			aria-label={t('tabs.list')}
		>
			{docs.map((doc) => {
				const active = doc.id === activeId
				const dirty = doc.text !== doc.savedText
				return (
					<div
						key={doc.id}
						ref={active ? activeRef : undefined}
						className={`tab${active ? ' active' : ''}`}
						role="tab"
						aria-selected={active}
						tabIndex={0}
						title={t('title.rename')}
						onClick={() => onActivate(doc.id)}
						onDoubleClick={() => startRename(doc)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault()
								onActivate(doc.id)
							}
						}}
					>
						{renamingId === doc.id ? (
							<input
								className="tab-input"
								value={draft}
								autoFocus
								onFocus={(event) => event.target.select()}
								onChange={(event) =>
									setDraft(event.target.value)
								}
								onBlur={commitRename}
								onClick={(event) => event.stopPropagation()}
								onDoubleClick={(event) =>
									event.stopPropagation()
								}
								onKeyDown={(event) => {
									event.stopPropagation()
									if (event.key === 'Enter') commitRename()
									if (event.key === 'Escape') cancelRename()
								}}
							/>
						) : (
							<span className="tab-label">
								{doc.docName}
								{dirty ? ' *' : ''}
							</span>
						)}
						<button
							type="button"
							className="tab-close"
							title={t('tabs.close')}
							aria-label={t('tabs.close')}
							onClick={(event) => {
								event.stopPropagation()
								onClose(doc.id)
							}}
						>
							<LuX aria-hidden="true" />
						</button>
					</div>
				)
			})}
		</div>
	)
}

export default TabBar
