import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Notice } from '@/components/common/Notice'
import type { LeaveType } from '@/features/leave-types/leave-type.types'
import { leaveRequestSchema } from '../leave-request.validation'
import type { LeaveRequestInput } from '../leave-request.types'

interface LeaveRequestFormProps {
    types: LeaveType[]
    initialValues?: LeaveRequestInput
    pending: boolean
    error: string
    onSubmit: (values: LeaveRequestInput) => Promise<void>
    onCancel: () => void
}

export function LeaveRequestForm({
    types,
    initialValues,
    pending,
    error,
    onSubmit,
    onCancel,
}: LeaveRequestFormProps) {
    const form = useForm<LeaveRequestInput>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: initialValues ?? {
            leaveTypeId: '',
            startDate: '',
            endDate: '',
            reason: '',
        },
    })

    const busy = pending || form.formState.isSubmitting
    const errors = form.formState.errors

    return (
        <form
            className="request-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
        >
        {error && (
            <div className="request-wide">
            <Notice>{error}</Notice>
            </div>
        )}

        <div className="form-field request-wide">
            <label htmlFor="request-type">Jenis cuti</label>

            <select
                id="request-type"
                className="text-input"
                disabled={busy}
                aria-invalid={!!errors.leaveTypeId}
                aria-describedby="request-type-error"
                {...form.register('leaveTypeId')}
            >
            <option value="">Pilih jenis cuti</option>

            {types.map(type => (
                <option key={type.id} value={type.id}>
                    {type.name}
                    {type.requires_balance ? ' — menggunakan saldo' : ''}
                </option>
            ))}
            </select>

            <p id="request-type-error" className="field-error">
                {errors.leaveTypeId?.message}
            </p>
        </div>

        <div className="form-field">
            <label htmlFor="request-start">Tanggal mulai</label>

            <input
                id="request-start"
                className="text-input"
                type="date"
                disabled={busy}
                aria-invalid={!!errors.startDate}
                aria-describedby="request-start-error"
                {...form.register('startDate')}
            />

            <p id="request-start-error" className="field-error">
                {errors.startDate?.message}
            </p>
        </div>

        <div className="form-field">
            <label htmlFor="request-end">Tanggal selesai</label>

            <input
                id="request-end"
                className="text-input"
                type="date"
                disabled={busy}
                aria-invalid={!!errors.endDate}
                aria-describedby="request-end-error"
                {...form.register('endDate')}
            />

            <p id="request-end-error" className="field-error">
                {errors.endDate?.message}
            </p>
        </div>

        <div className="form-field request-wide">
            <label htmlFor="request-reason">Alasan cuti</label>

            <textarea
                id="request-reason"
                className="text-input request-reason"
                rows={4}
                maxLength={2000}
                disabled={busy}
                aria-invalid={!!errors.reason}
                aria-describedby="request-reason-error"
                {...form.register('reason')}
            />

            <p id="request-reason-error" className="field-error">
                {errors.reason?.message}
            </p>
        </div>

        <p className="field-hint request-wide">
            Durasi hari kerja dihitung backend setelah draft disimpan.
            Draft belum dikirim kepada atasan.
        </p>

        <div className="request-actions">
            <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={onCancel}
            >
            Batal
            </button>

            <button
                className="button button-primary"
                disabled={busy || types.length === 0}
            >
            {busy ? 'Menyimpan…' : 'Simpan draft'}
            </button>
        </div>
        </form>
    )
}
