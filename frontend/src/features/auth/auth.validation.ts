import { z } from 'zod'

const email = z.string().trim().toLowerCase().pipe(z.email('Masukkan alamat email yang valid.'))

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Masukkan password Anda.'),
  factor: z.enum(['none', 'otp', 'recovery']),
  code: z.string(),
}).superRefine((value, context) => {
  if (value.factor === 'otp' && !/^\d{6}$/.test(value.code.trim())) {
    context.addIssue({ code: 'custom', path: ['code'], message: 'Kode authenticator terdiri dari 6 digit.' })
  }
  if (value.factor === 'recovery' && !/^[a-f0-9]{32}$/i.test(value.code.trim())) {
    context.addIssue({ code: 'custom', path: ['code'], message: 'Masukkan recovery code 32 karakter.' })
  }
})

export type LoginForm = z.infer<typeof loginSchema>

export const registrationSchema = z.object({
  email,
  password: z.string().min(15, 'Gunakan minimal 15 karakter.').refine(
    (value) => new TextEncoder().encode(value).length <= 72, 'Password maksimal 72 byte.',
  ),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'], message: 'Konfirmasi password belum sesuai.',
})
export type RegistrationForm = z.infer<typeof registrationSchema>
