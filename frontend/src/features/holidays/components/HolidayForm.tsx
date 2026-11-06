import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Notice } from '@/components/common/Notice'
import { holidaySchema } from '../holiday.validation'
import type { HolidayFormValues } from '../holiday.validation'

export function HolidayForm({ initialValues, pending, error, onSubmit, onCancel }: {
  initialValues?: HolidayFormValues
  pending: boolean
  error: string
  onSubmit: (values: HolidayFormValues) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm<HolidayFormValues>({ resolver: zodResolver(holidaySchema), defaultValues: initialValues ?? { holidayDate: '', name: '', isActive: true } })
  const saving = pending || form.formState.isSubmitting

  return <form className="holiday-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
    {error && <div className="holiday-wide"><Notice>{error}</Notice></div>}
    <div className="form-field"><label htmlFor="holiday-date">Tanggal hari libur</label><input id="holiday-date" className="text-input" type="date" disabled={saving} aria-invalid={!!form.formState.errors.holidayDate} aria-describedby="holiday-date-error" {...form.register('holidayDate')} /><p id="holiday-date-error" className="field-error">{form.formState.errors.holidayDate?.message}</p></div>
    <div className="form-field"><label htmlFor="holiday-name">Nama hari libur</label><input id="holiday-name" className="text-input" maxLength={150} disabled={saving} aria-invalid={!!form.formState.errors.name} aria-describedby="holiday-name-error" {...form.register('name')} /><p id="holiday-name-error" className="field-error">{form.formState.errors.name?.message}</p></div>
    <label className="holiday-option"><input type="checkbox" disabled={saving} {...form.register('isActive')} /><span><strong>Hari libur aktif</strong><small>Hanya hari libur aktif yang dikecualikan dari perhitungan durasi cuti.</small></span></label>
    <div className="holiday-actions"><button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>Batal</button><button className="button button-primary" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>
}
