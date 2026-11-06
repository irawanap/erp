import { z } from 'zod'

export const departmentSchema = z.object({
    code: z.string()
        .trim()
        .toUpperCase()
        .min(1, 'Kode departemen wajib diisi.')
        .max(20, 'Kode departemen maksimal 20 karakter.'),
    name: z.string()
        .trim()
        .min(1, 'Nama departemen wajib diisi.')
        .max(100, 'Nama departemen maksimal 100 karakter.'),
}).strict()

export type DepartmentForm = z.infer<typeof departmentSchema>
