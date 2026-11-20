import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentSummary } from '../shared/api'
import { documentsApi } from './api/client'
import { useTranslation } from './i18n/context'

interface Props {
	deleted: boolean
	onOpen: (id: number) => Promise<void>
	onMutate: (item: DocumentSummary, action: 'trash' | 'restore' | 'delete') => Promise<void>
	onClose: () => void
}

export default function FileLibrary({ deleted, onOpen, onMutate, onClose }: Props) {
	const { t } = useTranslation()
	const [items, setItems] = useState<DocumentSummary[]>([])
	const [next, setNext] = useState<number | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const generation = useRef(0)
	const load = useCallback(async (offset = 0) => {
		const current = ++generation.current
		setBusy(true); setError('')
		try {
			const page = await documentsApi.list(deleted, offset)
			if (current !== generation.current) return
			setItems((existing) => offset ? [...existing, ...page.items.filter((item) => !existing.some((old) => old.id === item.id))] : page.items)
			setNext(page.nextOffset)
		} catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : String(failure)) }
		finally { if (current === generation.current) setBusy(false) }
	}, [deleted])
	useEffect(() => {
		// Initial loading synchronizes this dialog with the remote document list.
		// eslint-disable-next-line react/set-state-in-effect
		void load()
		const focus = () => { void load() }
		window.addEventListener('focus', focus)
		// This ref is a request counter, not a DOM node; invalidate late responses on unmount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		return () => { generation.current++; window.removeEventListener('focus', focus) }
	}, [load])
	async function perform(work: () => Promise<void>, close = false) {
		setBusy(true); setError('')
		try { await work(); if (close) onClose(); else await load() }
		catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
		finally { setBusy(false) }
	}
	return <div className="dialog-backdrop">
		<section className="dialog file-library" role="dialog" aria-modal="true" aria-labelledby="library-title">
			<div className="dialog-header"><h2 id="library-title">{t(deleted ? 'cloud.trash' : 'cloud.allFiles')}</h2><button onClick={onClose}>{t('common.close')}</button></div>
			{error && <p className="cloud-error" role="alert">{error}</p>}
			<div className="cloud-file-list">{items.map((item) => <div className="cloud-file" key={item.id}>
				<span title={item.name}>{item.name}</span>
				{!deleted && <button disabled={busy} onClick={() => { void perform(() => onOpen(item.id), true) }}>{t('toolbar.open')}</button>}
				{deleted && <button disabled={busy} onClick={() => { void perform(() => onMutate(item, 'restore')) }}>{t('cloud.restore')}</button>}
				<button disabled={busy} onClick={() => { void perform(() => onMutate(item, deleted ? 'delete' : 'trash')) }}>{t(deleted ? 'cloud.deleteForever' : 'cloud.toTrash')}</button>
			</div>)}</div>
			{!busy && items.length === 0 && <p>{t('cloud.empty')}</p>}
			{busy && <p role="status">{t('cloud.loading')}</p>}
			<div className="cloud-actions"><button disabled={busy} onClick={() => { void load() }}>{t('cloud.refresh')}</button>{next !== null && <button disabled={busy} onClick={() => { void load(next) }}>{t('cloud.more')}</button>}</div>
		</section>
	</div>
}
