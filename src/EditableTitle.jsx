import { useEffect, useRef, useState } from 'react'
import { LuFileText, LuPencil } from 'react-icons/lu'
import { useTranslation } from './i18n/context.js'

function EditableTitle({ name, isDirty, onRename }) {
	const { t } = useTranslation()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(name)
	const inputRef = useRef(null)

	useEffect(() => {
		if (editing) inputRef.current?.select()
	}, [editing])

	function startEditing() {
		setDraft(name)
		setEditing(true)
	}

	function commit() {
		setEditing(false)
		const next = draft.trim()
		if (next && next !== name) onRename(next)
	}

	function handleKeyDown(event) {
		if (event.key === 'Enter') commit()
		if (event.key === 'Escape') setEditing(false)
	}

	if (editing) {
		return (
			<input
				ref={inputRef}
				className="title-input"
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={handleKeyDown}
				autoFocus
			/>
		)
	}

	return (
		<button
			type="button"
			className="title"
			title={t('title.rename')}
			onClick={startEditing}
		>
			<LuFileText aria-hidden="true" />
			<span>
				{name}
				{isDirty ? ' *' : ''}
			</span>
			<LuPencil className="title-edit" aria-hidden="true" />
		</button>
	)
}

export default EditableTitle
