import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthResponse } from '../shared/api'
import { authApi } from './api/client'
import { useTranslation } from './i18n/context'

interface Props { expired: boolean; onSuccess: (auth: AuthResponse) => void }

export default function AuthDialog({ expired, onSuccess }: Props) {
	const { t } = useTranslation()
	const [action, setAction] = useState<'login' | 'register'>('login')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	async function submit(event: FormEvent) {
		event.preventDefault()
		setBusy(true); setError('')
		try { onSuccess(await authApi.login(action, email, password)) }
		catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
		finally { setBusy(false) }
	}
	return <div className="dialog-backdrop auth-backdrop">
		<form className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onSubmit={(event) => { void submit(event) }}>
			<h2 id="auth-title">{t(action === 'login' ? 'auth.login' : 'auth.register')}</h2>
			{expired && <p>{t('auth.expired')}</p>}
			<label>Email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoFocus /></label>
			<label>{t('auth.password')}<input type="password" autoComplete={action === 'login' ? 'current-password' : 'new-password'} required minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
			<p>{t('auth.duration')}</p>
			{error && <p className="cloud-error" role="alert">{error}</p>}
			<button type="submit" disabled={busy}>{t(busy ? 'cloud.loading' : action === 'login' ? 'auth.login' : 'auth.register')}</button>
			<button type="button" disabled={busy} onClick={() => { setAction(action === 'login' ? 'register' : 'login'); setError('') }}>{t(action === 'login' ? 'auth.toRegister' : 'auth.toLogin')}</button>
		</form>
	</div>
}
