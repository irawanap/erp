import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Notice } from '@/components/common/Notice'
import { messageOf, retryAfter } from '@/lib/api'
import { useRetryCountdown } from '@/features/auth/use-retry-countdown'
import type { CredentialsProof } from '@/features/auth/auth.types'

export function SecurityDialog({ title, description, passwordChange, onConfirm, onClose }: {
  title: string
  description: string
  passwordChange: boolean
  onConfirm: (proof: CredentialsProof, newPassword?: string) => Promise<void>
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [factor, setFactor] = useState('none')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const { remaining, setRemaining } = useRetryCountdown()
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!password) { setError('Masukkan password saat ini.'); return }
    if (passwordChange && (newPassword.length < 15 || new TextEncoder().encode(newPassword).length > 72)) {
      setError('Password baru minimal 15 karakter dan maksimal 72 byte.'); return
    }
    if (passwordChange && (newPassword !== confirmation || newPassword === password)) {
      setError(newPassword === password ? 'Password baru harus berbeda dari password lama.' : 'Konfirmasi password belum sesuai.'); return
    }
    if (factor === 'otp' && !/^\d{6}$/.test(code.trim())) { setError('Masukkan enam digit authenticator.'); return }
    if (factor === 'recovery' && !/^[a-f0-9]{32}$/i.test(code.trim())) { setError('Recovery code terdiri dari 32 karakter.'); return }
    setPending(true)
    try {
      await onConfirm({ currentPassword: password,
        ...(factor === 'otp' ? { otp: code.trim() } : {}),
        ...(factor === 'recovery' ? { recoveryCode: code.trim().toLowerCase() } : {}),
      }, passwordChange ? newPassword : undefined)
    } catch (cause) { setError(messageOf(cause)); setRemaining(retryAfter(cause)); setCode('') }
    finally { setPending(false) }
  }

  return <dialog className="security-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); if (!pending) onClose() }} aria-labelledby="security-dialog-title">
    <div className="dialog-header"><span className="dialog-icon">{passwordChange ? <KeyRound size={23} /> : <ShieldCheck size={23} />}</span><button className="icon-button" onClick={onClose} disabled={pending} aria-label="Tutup dialog"><X size={21} /></button></div>
    <h2 id="security-dialog-title">{title}</h2><p className="dialog-description">{description}</p>
    {error && <Notice>{error}{remaining > 0 && ` Tunggu ${remaining} detik.`}</Notice>}
    <form className="auth-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="security-password">Password saat ini</label><PasswordInput id="security-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={pending} required /></div>
      {passwordChange && <><div className="form-field"><label htmlFor="new-password">Password baru</label><PasswordInput id="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="Minimal 15 karakter" disabled={pending} required /></div><div className="form-field"><label htmlFor="new-password-confirm">Konfirmasi password baru</label><PasswordInput id="new-password-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={pending} required /></div></>}
      <div className="form-field"><label htmlFor="security-factor">Autentikasi tambahan</label><select id="security-factor" className="text-input" value={factor} onChange={(event) => { setFactor(event.target.value); setCode('') }} disabled={pending}><option value="none">Akun belum menggunakan MFA</option><option value="otp">Kode authenticator</option><option value="recovery">Recovery code</option></select>
        <p className="field-hint">Jika MFA aktif, gunakan kode baru yang belum pernah dipakai.</p></div>
      {factor !== 'none' && <div className="form-field"><label htmlFor="security-code">{factor === 'otp' ? 'Kode authenticator' : 'Recovery code'}</label><input id="security-code" className={`text-input ${factor === 'otp' ? 'otp-input' : 'code-input'}`} value={code} onChange={(event) => setCode(event.target.value)} autoComplete={factor === 'otp' ? 'one-time-code' : 'off'} inputMode={factor === 'otp' ? 'numeric' : 'text'} maxLength={factor === 'otp' ? 6 : 32} disabled={pending} required /></div>}
      <div className="dialog-actions"><button type="button" className="button button-outline" onClick={onClose} disabled={pending}>Batal</button><button className="button button-primary" disabled={pending || remaining > 0}>{pending ? <LoaderCircle className="spin" size={17} /> : null}{passwordChange ? 'Simpan password' : 'Verifikasi & lanjutkan'}</button></div>
    </form>
  </dialog>
}
