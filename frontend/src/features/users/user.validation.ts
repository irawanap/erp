import { z } from 'zod'

export const userSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Masukkan email yang valid.').max(255)),
  role: z.enum(['Employee', 'Supervisor', 'HRD/Admin']),
}).strict()
export const createUserSchema = userSchema.extend({
  password: z.string().min(15, 'Password minimal 15 karakter.').refine(
    value => new TextEncoder().encode(value).length <= 72, 'Password maksimal 72 byte.',
  ),
})
