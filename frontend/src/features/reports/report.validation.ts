import { z } from 'zod'

export const reportSchema = z.object({
  startDate: z.iso.date('Masukkan tanggal mulai yang valid.'),
  endDate: z.iso.date('Masukkan tanggal selesai yang valid.'),
  departmentId: z.uuidv4('Pilih departemen yang valid.').optional(),
}).refine(value => value.startDate <= value.endDate && Date.parse(value.endDate) - Date.parse(value.startDate) < 366 * 86400000, {
  message: 'Rentang tanggal harus berurutan dan maksimal 366 hari.',
})
