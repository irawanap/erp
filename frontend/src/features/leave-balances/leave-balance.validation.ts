import { z } from 'zod'

export const leaveBalanceSchema = z.object({
  employeeId: z.uuidv4('Pilih karyawan.'),
  leaveTypeId: z.uuidv4('Pilih jenis cuti.'),
  periodYear: z.number('Masukkan tahun yang valid.').int().min(1900).max(2200),
  entitlement: z.number('Masukkan hak cuti yang valid.').min(0, 'Hak cuti minimal 0.').max(9999.99).multipleOf(0.5, 'Gunakan kelipatan 0,5 hari.'),
}).strict()
