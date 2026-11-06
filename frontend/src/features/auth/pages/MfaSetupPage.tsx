import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Copy, Download, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Notice } from '@/components/common/Notice'
import { useAuth } from '../use-auth'
import { setupMfa, confirmMfa } from '../auth.api'
import { messageOf, retryAfter } from '@/lib/api'
import { useRetryCountdown } from '../use-retry-countdown'

export function MfaSetupPage() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const { remaining, setRemaining } = useRetryCountdown()

  if (auth.loading) return <div className="page-loading"><LoaderCircle className="spin" size={25} /><span>Memeriksa session…</span></div>
  if (!auth.user && !recoveryCodes.length) return <Navigate to="/login" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!secret && !password) { setError('Masukkan password saat ini.'); return }
    if (secret && !/^\d{6}$/.test(code)) { setError('Masukkan enam digit dari authenticator.'); return }
    setPending(true)
    try {
      if (!secret) {
        const enrollment = await setupMfa({ currentPassword: password })
        setSecret(enrollment.secret)
        setPassword('')
      } else {
        const codes = await confirmMfa(code)
        setRecoveryCodes(codes)
        setSecret('')
        setCode('')
        auth.clearSession()
      }
    } catch (cause) { setError(messageOf(cause)); setRemaining(retryAfter(cause)) }
    finally { setPending(false) }
  }

  async function copySecret() {
    try { await navigator.clipboard.writeText(secret); setCopied(true) }
    catch { setError('Clipboard tidak tersedia. Salin kode secara manual.') }
  }

  function downloadCodes() {
    const text = ['EMP People — Recovery codes', 'Setiap kode hanya dapat digunakan sekali. Simpan secara pribadi.', '', ...recoveryCodes].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'emp-people-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <AuthLayout>
    {!recoveryCodes.length && <Link className="back-link" to="/"><ArrowLeft size={16} /> Kembali ke workspace</Link>}
    <span className="auth-heading-icon"><ShieldCheck size={25} /></span>
    <span className="section-label">LINDUNGI AKUN ANDA</span>
    <h2 className="auth-title">{recoveryCodes.length ? 'Akun lebih terlindungi.' : 'Aktifkan autentikasi dua langkah'}</h2>
    <p className="auth-description">{recoveryCodes.length ? 'Simpan kode pemulihan sebelum melanjutkan. Kode ini hanya ditampilkan sekali.' : 'Tambahkan satu lapisan keamanan sebelum mengelola workspace perusahaan.'}</p>
    {error && <Notice>{error}{remaining > 0 && ` Coba lagi dalam ${remaining} detik.`}</Notice>}
    {recoveryCodes.length > 0 ? <div className="recovery-section">
      <Notice kind="success">MFA aktif. Seluruh session sebelumnya sudah diakhiri.</Notice>
      <div className="recovery-grid">{recoveryCodes.map((value, index) => <div key={value}><span>{String(index + 1).padStart(2, '0')}</span><code>{value}</code></div>)}</div>
      <button className="button button-outline button-full" onClick={downloadCodes}><Download size={17} /> Unduh recovery codes</button>
      <label className="checkbox-label"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> Saya sudah menyimpan kode ini di tempat aman.</label>
      <p className="field-hint">Untuk login berikutnya, gunakan OTP periode baru atau satu recovery code. Kode konfirmasi tadi tidak dapat dipakai ulang.</p>
      <Link to="/login" className={`button button-primary button-full ${!saved ? 'disabled-link' : ''}`} aria-disabled={!saved} tabIndex={saved ? 0 : -1} onClick={(event) => { if (!saved) event.preventDefault() }}>Kembali ke login <ArrowRight size={17} /></Link>
    </div> : <form className="auth-form" onSubmit={submit}>
      <div className="setup-progress"><span className={!secret ? 'active' : 'complete'}>{secret ? <Check size={13} /> : '1'}</span><i /><span className={secret ? 'active' : ''}>2</span><small>{secret ? 'Hubungkan authenticator' : 'Verifikasi password'}</small></div>
      {!secret ? <div className="form-field"><label htmlFor="mfa-password">Password saat ini</label><PasswordInput id="mfa-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Masukkan password Anda" disabled={pending} required />
        <p className="field-hint">Verifikasi diperlukan sebelum menyiapkan authenticator.</p></div>
        : <>
          <div className="setup-instructions"><strong>Tambahkan akun secara manual</strong><p>Buka Google Authenticator, Microsoft Authenticator, atau aplikasi sejenis. Pilih tambah akun dengan kunci penyiapan, lalu masukkan kode berikut sebagai tipe berbasis waktu.</p></div>
          <div className="secret-box"><KeyRound size={18} /><code>{secret}</code><button type="button" className="icon-button" aria-label="Salin kunci penyiapan" onClick={copySecret}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
          <p className="field-hint">Kunci ini bersifat pribadi. Jangan dibagikan. Selesaikan penyiapan dalam 10 menit pada tab ini.</p>
          <div className="form-field"><label htmlFor="confirm-otp">Kode authenticator</label><input id="confirm-otp" className="text-input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" disabled={pending} required /></div>
        </>}
      <button className="button button-primary button-full" disabled={pending || remaining > 0}>{pending ? <LoaderCircle size={18} className="spin" /> : secret ? 'Konfirmasi & aktifkan MFA' : 'Lanjutkan'}<ArrowRight size={17} /></button>
    </form>}
  </AuthLayout>
}
