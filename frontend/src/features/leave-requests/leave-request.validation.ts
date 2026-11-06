import { z } from "zod";

export const leaveRequestSchema = z.object({
    leaveTypeId: z.uuidv4('Pilih jenis cuti.'),

    startDate: z.iso.date('Masukkan tanggal mulai yang valid.'),

    endDate: z.iso.date('Masukkan tanggal selesai yang valid.'),

    reason: z.string()
        .trim()
        .min(1, 'Alasan cuti wajib diisi.')
        .max(2000, 'Alasan maksimal 2.000 karakter.'),
}).strict().refine(
    values => values.endDate >= values.startDate,
    {
        path: ['endDate'],
        message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
    },
)
