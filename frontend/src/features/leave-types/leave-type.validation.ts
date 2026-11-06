import { z } from 'zod'

export const leaveTypeSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, 'Kode wajib diisi.').max(30, 'Kode maksimal 30 karakter.'),
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(100, 'Nama maksimal 100 karakter.'),
  requiresBalance: z.boolean(),
  isActive: z.boolean(),
}).strict()

export type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>
