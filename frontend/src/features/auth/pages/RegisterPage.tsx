import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, LoaderCircle, Mail } from 'lucide-react'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Notice } from '@/components/common/Notice'
import { registrationSchema } from '../auth.validation'
import type { RegistrationForm } from '../auth.validation'
import { register } from '../auth.api'
import { messageOf, retryAfter } from '@/lib/api'
import { useAuth } from '../use-auth'
import { useRetryCountdown } from '../use-retry-countdown'

export function RegisterPage() {
  const auth = useAuth()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { remaining, setRemaining } = useRetryCountdown()
  const form = useForm<RegistrationForm>({ resolver: zodResolver(registrationSchema), defaultValues: { email: '', password: '', confirmPassword: '' } })
  if (auth.user) return <Navigate to="/" replace />

  async function submit(values: RegistrationForm) {
    setError('')
    try {
      setMessage(await register({ email: values.email, password: values.password }))
      form.reset()
    } catch (cause) { setError(messageOf(cause)); setRemaining(retryAfter(cause)) }
  }

  return <AuthLayout>
    <Link className="back-link" to="/login"><ArrowLeft size={16} /> Kembali ke login</Link>
    <span className="section-label">MULAI TERHUBUNG</span>
    <h2 className="auth-title">Buat akun Anda</h2>
    <p className="auth-description">Akun baru memiliki akses Employee. Pengaitan data karyawan dilakukan oleh HRD.</p>
    {import.meta.env.VITE_ENABLE_REGISTRATION !== 'true' ? <Notice kind="info">Pembuatan akun dikelola HRD perusahaan Anda. Silakan hubungi HRD untuk mendapatkan akses.</Notice>
      : message ? <><Notice kind="success">{message}</Notice><Link className="button button-primary button-full" to="/login">Lanjut ke login <ArrowRight size={17} /></Link></>
        : <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
          {error && <Notice>{error}{remaining > 0 && ` Tunggu ${remaining} detik.`}</Notice>}
          <div className="form-field"><label htmlFor="register-email">Email perusahaan</label>
            <div className="input-wrap"><Mail className="input-icon" size={17} /><input id="register-email" type="email" autoComplete="username" className="text-input has-icon" placeholder="nama@perusahaan.com" {...form.register('email')} /></div>
            {form.formState.errors.email && <p className="field-error">{form.formState.errors.email.message}</p>}
          </div>
          <div className="form-field"><label htmlFor="register-password">Password</label>
            <PasswordInput id="register-password" autoComplete="new-password" placeholder="Minimal 15 karakter" {...form.register('password')} />
            {form.formState.errors.password && <p className="field-error">{form.formState.errors.password.message}</p>}
          </div>
          <div className="form-field"><label htmlFor="confirm-password">Konfirmasi password</label>
            <PasswordInput id="confirm-password" autoComplete="new-password" placeholder="Ketik ulang password" {...form.register('confirmPassword')} />
            {form.formState.errors.confirmPassword && <p className="field-error">{form.formState.errors.confirmPassword.message}</p>}
          </div>
          <button className="button button-primary button-full" disabled={form.formState.isSubmitting || remaining > 0}>
            {form.formState.isSubmitting ? <LoaderCircle className="spin" size={18} /> : 'Buat akun'}<ArrowRight size={17} />
          </button>
        </form>}
  </AuthLayout>
}
