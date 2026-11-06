import { z } from 'zod'

export const approvalSchema = z.object({
  comment: z.string().trim().min(1, 'Komentar keputusan wajib diisi.').max(2000, 'Komentar maksimal 2.000 karakter.'),
}).strict()
