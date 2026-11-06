import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Notice } from '@/components/common/Notice'
import { leaveTypeSchema } from '../leave-type.validation'
import type { LeaveTypeFormValues } from '../leave-type.validation'

export function LeaveTypeForm({ initialValues, pending, error, onSubmit, onCancel }: {
  initialValues?: LeaveTypeFormValues
  pending: boolean
  error: string
  onSubmit: (values: LeaveTypeFormValues) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm<LeaveTypeFormValues>({ resolver: zodResolver(leaveTypeSchema), defaultValues: initialValues ?? { code: '', name: '', requiresBalance: true, isActive: true } })
  const saving = pending || form.formState.isSubmitting

  return <form className="leave-type-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
    {error && <div className="leave-type-wide"><Notice>{error}</Notice></div>}
    <div className="form-field"><label htmlFor="leave-type-code">Kode jenis cuti</label><input id="leave-type-code" className="text-input" maxLength={30} disabled={saving} aria-invalid={!!form.formState.errors.code} aria-describedby="leave-type-code-error" {...form.register('code')} /><p id="leave-type-code-error" className="field-error">{form.formState.errors.code?.message}</p></div>
    <div className="form-field"><label htmlFor="leave-type-name">Nama jenis cuti</label><input id="leave-type-name" className="text-input" maxLength={100} disabled={saving} aria-invalid={!!form.formState.errors.name} aria-describedby="leave-type-name-error" {...form.register('name')} /><p id="leave-type-name-error" className="field-error">{form.formState.errors.name?.message}</p></div>
    <label className="leave-type-option"><input type="checkbox" disabled={saving} {...form.register('requiresBalance')} /><span><strong>Menggunakan saldo</strong><small>Pengajuan memerlukan saldo dan memotong saldo saat disetujui.</small></span></label>
    <label className="leave-type-option"><input type="checkbox" disabled={saving} {...form.register('isActive')} /><span><strong>Jenis cuti aktif</strong><small>Jenis cuti nonaktif tidak tersedia untuk pengajuan baru.</small></span></label>
    <div className="leave-type-actions"><button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>Batal</button><button className="button button-primary" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>
}
