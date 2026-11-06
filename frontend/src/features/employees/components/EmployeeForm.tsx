import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Notice } from '@/components/common/Notice'
import type { Department } from '@/features/departments/department.types'
import { useSupervisorOptions } from '../employee.queries'
import { messageOf } from '@/lib/api'
import { employeeSchema } from '../employee.validation'
import type { EmployeeFormValues } from '../employee.validation'

interface EmployeeFormProps {
    initialValues?: EmployeeFormValues
    departments: Department[]
    pending: boolean
    error: string
    onSubmit: (values: EmployeeFormValues) => Promise<void>
    onCancel: () => void
}

export function EmployeeForm({
    initialValues,
    departments,
    pending,
    error,
    onSubmit,
    onCancel,
}: EmployeeFormProps) {
    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeSchema),
        defaultValues: initialValues ?? {
            nik: '',
            fullName: '',
            departmentId: '',
            position: '',
            supervisorId: '',
            joinDate: '',
            employmentStatus: 'Active',
        },
    })

    const supervisors = useSupervisorOptions(true)
    const saving = pending || form.formState.isSubmitting

    const fields = [
        { name: 'nik', label: 'NIK', type: 'text', maxLength: 30 },
        {
            name: 'fullName',
            label: 'Nama lengkap',
            type: 'text',
            maxLength: 150,
        },
        { name: 'position', label: 'Jabatan', type: 'text', maxLength: 100 },
        { name: 'joinDate', label: 'Tanggal bergabung', type: 'date' },
    ] as const

    return (
        <form
            className="employee-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
        >
        {error && (
            <div className="employee-form-notice">
            <Notice>{error}</Notice>
            </div>
        )}

        {fields.map((field) => {
            const fieldError = form.formState.errors[field.name]

            return (
            <div className="form-field" key={field.name}>
                <label htmlFor={`employee-${field.name}`}>
                    {field.label}
                </label>

                <input
                    id={`employee-${field.name}`}
                    className="text-input"
                    type={field.type}
                    maxLength={
                        'maxLength' in field ? field.maxLength : undefined
                    }
                    disabled={saving}
                    aria-invalid={!!fieldError}
                    aria-describedby={
                        fieldError ? `employee-${field.name}-error` : undefined
                    }
                    {...form.register(field.name)}
                />

                {fieldError && (
                    <p
                        id={`employee-${field.name}-error`}
                        className="field-error"
                    >
                        {fieldError.message}
                    </p>
                )}
            </div>
            )
        })}

        <div className="form-field">
            <label htmlFor="employee-department">Departemen</label>

            <select
                id="employee-department"
                className="text-input"
                disabled={saving}
                aria-invalid={!!form.formState.errors.departmentId}
                aria-describedby="employee-department-error"
                {...form.register('departmentId')}
            >
            <option value="">Pilih departemen</option>

            {departments.map((department) => (
                <option key={department.id} value={department.id}>
                    {department.code} — {department.name}
                </option>
            ))}
            </select>

            <p id="employee-department-error" className="field-error">
                {form.formState.errors.departmentId?.message}
            </p>
        </div>

        <div className="form-field">
            <label htmlFor="employee-status">Status kerja</label>

            <select
                id="employee-status"
                className="text-input"
                disabled={saving}
                {...form.register('employmentStatus')}
            >
            <option value="Active">Aktif</option>
            <option value="Inactive">Tidak aktif</option>
            <option value="Resigned">Resign</option>
            </select>
        </div>

        <div className="form-field employee-form-wide">
            <label htmlFor="employee-supervisor">Atasan langsung</label>
            <select
                id="employee-supervisor"
                className="text-input"
                disabled={saving || !supervisors.isSuccess}
                aria-invalid={!!form.formState.errors.supervisorId}
                aria-describedby="employee-supervisor-help employee-supervisor-error"
                {...form.register('supervisorId')}
            >
                <option value="">Tanpa atasan</option>
                {initialValues?.supervisorId && !supervisors.data?.some(item => item.id === initialValues.supervisorId) && <option value={initialValues.supervisorId}>Atasan saat ini (tidak tersedia untuk penugasan baru)</option>}
                {supervisors.data?.map(item => <option key={item.id} value={item.id}>{item.nik} — {item.full_name}</option>)}
            </select>
            <p id="employee-supervisor-help" className="field-hint">Pilihan berisi karyawan aktif dengan akun Supervisor aktif. Backend memeriksa kembali penugasan.</p>
            {supervisors.isPending && <p role="status">Memuat pilihan atasan…</p>}
            {supervisors.isError && <><Notice>{messageOf(supervisors.error)}</Notice><button type="button" className="button button-outline" onClick={() => supervisors.refetch()}>Muat ulang atasan</button></>}

            <p id="employee-supervisor-error" className="field-error">
                {form.formState.errors.supervisorId?.message}
            </p>
        </div>

        <div className="employee-form-actions">
            <button
                type="button"
                className="button button-outline"
                disabled={saving}
                onClick={onCancel}
            >
            Batal
            </button>

            <button
                type="submit"
                className="button button-primary"
                disabled={saving || departments.length === 0 || !supervisors.isSuccess}
            >
                {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
        </div>
        </form>
    )
}