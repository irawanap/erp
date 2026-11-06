import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ChevronDown, LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Notice } from '@/components/common/Notice'
import { loginSchema } from '../auth.validation'
import type { LoginForm } from '../auth.validation'
import { login } from '../auth.api'
import { useAuth } from '../use-auth'
import { messageOf, retryAfter } from '@/lib/api'
import { useRetryCountdown } from '../use-retry-countdown'

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const { remaining, setRemaining } = useRetryCountdown()
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', factor: 'none', code: '' } })
  const factor = useWatch({ control: form.control, name: 'factor' })
  const submitting = form.formState.isSubmitting
  const destination = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
    && !location.state.from.startsWith('//') && !location.state.from.startsWith('/login') ? location.state.from : '/'

  if (auth.user) return <Navigate to={destination} replace />

  async function submit(values: LoginForm) {
    setError('')
    try {
      const user = await login({ email: values.email, password: values.password,
        ...(values.factor === 'otp' ? { otp: values.code.trim() } : {}),
        ...(values.factor === 'recovery' ? { recoveryCode: values.code.trim().toLowerCase() } : {}),
      })
      form.reset()
      await auth.acceptUser(user)
    } catch (cause) {
      setError(messageOf(cause))
      setRemaining(retryAfter(cause))
      form.setValue('code', '')
    }
  }

  function changeFactor(value: LoginForm['factor']) {
    form.setValue('factor', value)
    form.setValue('code', '')
    form.clearErrors('code')
  }

  return <AuthLayout>
    <span className="section-label">SELAMAT DATANG KEMBALI</span>
    <h2 className="auth-title">Masuk ke workspace</h2>
    <p className="auth-description">Kelola hari kerja Anda, mulai dari sini.</p>
    {auth.notice && <Notice kind="success">{auth.notice}</Notice>}
    {auth.unavailable && <Notice kind="info">Backend belum dapat dihubungi. Pastikan layanan API berjalan sebelum masuk.</Notice>}
    {error && <Notice>{error}{remaining > 0 && <span className="notice-detail">Coba kembali dalam {remaining} detik.</span>}</Notice>}
    <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div className="form-field">
        <label htmlFor="email">Email perusahaan</label>
        <div className="input-wrap"><Mail size={17} className="input-icon" aria-hidden="true" />
          <input id="email" type="email" className="text-input has-icon" placeholder="nama@perusahaan.com"
            autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={submitting}
            aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} {...form.register('email')} />
        </div>
        {form.formState.errors.email && <p className="field-error" id="email-error">{form.formState.errors.email.message}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" placeholder="Masukkan password Anda" autoComplete="current-password"
          disabled={submitting} aria-invalid={!!form.formState.errors.password}
          aria-describedby={form.formState.errors.password ? 'password-error' : undefined} {...form.register('password')} />
        {form.formState.errors.password && <p className="field-error" id="password-error">{form.formState.errors.password.message}</p>}
      </div>
      <div className={`mfa-option ${factor !== 'none' ? 'is-open' : ''}`}>
        <button type="button" className="mfa-toggle" aria-expanded={factor !== 'none'} disabled={submitting}
          onClick={() => changeFactor(factor === 'none' ? 'otp' : 'none')}>
          <span><ShieldCheck size={17} /> Akun Anda menggunakan MFA?</span><ChevronDown size={16} />
        </button>
        {factor !== 'none' && <div className="mfa-fields">
          <div className="segmented-control" aria-label="Metode autentikasi">
            <button type="button" className={factor === 'otp' ? 'selected' : ''} aria-pressed={factor === 'otp'} onClick={() => changeFactor('otp')} disabled={submitting}>Authenticator</button>
            <button type="button" className={factor === 'recovery' ? 'selected' : ''} aria-pressed={factor === 'recovery'} onClick={() => changeFactor('recovery')} disabled={submitting}>Recovery code</button>
          </div>
          <label className="sr-only" htmlFor="mfa-code">{factor === 'otp' ? 'Kode authenticator' : 'Recovery code'}</label>
          <input id="mfa-code" className={`text-input ${factor === 'otp' ? 'otp-input' : 'code-input'}`}
            placeholder={factor === 'otp' ? '000000' : 'Kode pemulihan 32 karakter'}
            inputMode={factor === 'otp' ? 'numeric' : 'text'} autoComplete={factor === 'otp' ? 'one-time-code' : 'off'}
            autoCapitalize="none" spellCheck={false} maxLength={factor === 'otp' ? 6 : 32} disabled={submitting}
            aria-invalid={!!form.formState.errors.code} aria-describedby="mfa-help" {...form.register('code')} />
          <p id="mfa-help" className="field-hint">{factor === 'otp' ? 'Gunakan kode terbaru dari aplikasi authenticator.' : 'Setiap recovery code hanya dapat digunakan sekali.'}</p>
          {form.formState.errors.code && <p className="field-error">{form.formState.errors.code.message}</p>}
        </div>}
      </div>
      <button className="button button-primary button-full" type="submit" disabled={submitting || remaining > 0}>
        {submitting ? <><LoaderCircle size={18} className="spin" /> Memeriksa akun…</> : remaining > 0 ? `Coba lagi dalam ${remaining} detik` : <>Masuk ke workspace <ArrowRight size={18} /></>}
      </button>
    </form>
    <div className="auth-help"><span>Belum memiliki akses?</span>{import.meta.env.VITE_ENABLE_REGISTRATION === 'true'
      ? <Link to="/register">Daftar akun</Link> : <span className="text-strong">Hubungi HRD perusahaan Anda.</span>}</div>
    <div className="auth-security-note"><ShieldCheck size={16} /><span>Workspace pribadi. Akses disesuaikan dengan peran Anda.</span></div>
  </AuthLayout>
}
