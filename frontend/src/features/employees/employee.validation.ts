import { z } from "zod";

export const employeeSchema = z.object({
    nik: z.string()
        .trim()
        .toUpperCase()
        .min(1, 'NIK wajib diisi.')
        .max(30, 'NIK maksimal 30 karakter.'),

    fullName: z.string()
        .trim()
        .min(1, 'Nama lengkap wajib diisi.')
        .max(150, 'Nama maksimal 150 karakter.'),

    departmentId: z.uuidv4('Pilih departemen.'),

    position: z.string()
        .trim()
        .min(1, 'Jabatan wajib diisi.')
        .max(100, 'Jabatan maksimal 100 karakter.'),

    supervisorId: z.union([
        z.literal(''),
        z.uuidv4('ID atasan harus berupa UUID v4.'),
    ]),

    joinDate: z.iso.date('Masukkan tanggal bergabung yang valid.'),

    employmentStatus: z.enum(['Active', 'Inactive', 'Resigned']),
}).strict()

export type EmployeeFormValues = z.infer<typeof employeeSchema>
