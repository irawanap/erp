import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Notice } from '@/components/common/Notice'
import type { Employee } from '@/features/employees/employee.types'
import type { LeaveType } from '@/features/leave-types/leave-type.types'
import { leaveBalanceSchema } from '../leave-balance.validation'
import type { LeaveBalance, LeaveBalanceInput } from '../leave-balance.types'

export function LeaveBalanceForm({ balance, employees, types, year, pending, error, onSubmit, onCancel }: {
  balance: LeaveBalance | null
  employees: Employee[]
  types: LeaveType[]
  year: number
  pending: boolean
  error: string
  onSubmit: (input: LeaveBalanceInput) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm<LeaveBalanceInput>({ resolver: zodResolver(leaveBalanceSchema), defaultValues: balance
    ? { employeeId: balance.employee_id, leaveTypeId: balance.leave_type_id, periodYear: balance.period_year, entitlement: balance.entitlement }
    : { employeeId: '', leaveTypeId: '', periodYear: year, entitlement: 12 } })
  const busy = pending || form.formState.isSubmitting
  const errors = form.formState.errors

  return <form className="balance-form" onSubmit={form.handleSubmit(async input => {
    if (balance && input.entitlement < balance.used_days) { form.setError('entitlement', { message: `Hak cuti minimal ${balance.used_days} hari karena sudah digunakan.` }); return }
    await onSubmit(input)
  })} noValidate>
    {error && <div className="balance-wide"><Notice>{error}</Notice></div>}
    <div className="form-field"><label htmlFor="balance-employee">Karyawan</label>{balance ? <><input type="hidden" {...form.register('employeeId')} /><input id="balance-employee" className="text-input" value={balance.full_name} readOnly /></> : (<select id="balance-employee" className="text-input" aria-invalid={!!errors.employeeId} aria-describedby="balance-employee-error" disabled={busy} {...form.register('employeeId')}><option value="">Pilih karyawan</option>{employees.map(item => <option key={item.id} value={item.id}>{item.nik} — {item.full_name}</option>)}</select>)}<p id="balance-employee-error" className="field-error">{errors.employeeId?.message}</p></div>
    <div className="form-field"><label htmlFor="balance-type">Jenis cuti</label>{balance ? <><input type="hidden" {...form.register('leaveTypeId')} /><input id="balance-type" className="text-input" value={balance.leave_type_name} readOnly /></> : (<select id="balance-type" className="text-input" aria-invalid={!!errors.leaveTypeId} aria-describedby="balance-type-error" disabled={busy} {...form.register('leaveTypeId')}><option value="">Pilih jenis cuti</option>{types.map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active ? '' : ' (nonaktif)'}</option>)}</select>)}<p id="balance-type-error" className="field-error">{errors.leaveTypeId?.message}</p></div>
    <div className="form-field"><label htmlFor="balance-year">Tahun</label><input id="balance-year" readOnly={!!balance} className="text-input" type="number" min={1900} max={2200} step={1} disabled={busy} aria-invalid={!!errors.periodYear} aria-describedby="balance-year-error" {...form.register('periodYear', { valueAsNumber: true })} /><p id="balance-year-error" className="field-error">{errors.periodYear?.message}</p></div>
    <div className="form-field"><label htmlFor="balance-entitlement">Hak cuti (hari)</label><input id="balance-entitlement" className="text-input" type="number" min={0} max={9999.99} step={0.5} disabled={busy} aria-invalid={!!errors.entitlement} aria-describedby="balance-entitlement-error" {...form.register('entitlement', { valueAsNumber: true })} /><p id="balance-entitlement-error" className="field-error">{errors.entitlement?.message}</p></div>
    <p className="field-hint balance-wide">Simpan menetapkan total hak cuti untuk kombinasi karyawan, jenis cuti, dan tahun yang dipilih. Saldo terpakai tidak direset.</p>
    <div className="balance-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onCancel}>Batal</button><button className="button button-primary" disabled={busy || !types.length || !employees.length}>{busy ? 'Menyimpan…' : 'Simpan saldo'}</button></div>
  </form>
}
