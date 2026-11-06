import { z } from 'zod'

export const holidaySchema = z.object({
  holidayDate: z.iso.date('Masukkan tanggal hari libur yang valid.'),
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(150, 'Nama maksimal 150 karakter.'),
  isActive: z.boolean(),
}).strict()

export type HolidayFormValues = z.infer<typeof holidaySchema>
