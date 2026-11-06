import { useState } from 'react'
import type { FormEvent } from 'react'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import { HolidayForm } from '../components/HolidayForm'
import { HolidayTable } from '../components/HolidayTable'
import { useHolidays, useSaveHoliday } from '../holiday.queries'
import type { Holiday, HolidayInput } from '../holiday.types'
import type { HolidayFormValues } from '../holiday.validation'

type SaveAction = { id: string; input: Partial<HolidayInput> } | { id?: undefined; input: HolidayInput }

function inputOf(item: Holiday): HolidayInput {
  return { holidayDate: item.holiday_date, name: item.name, isActive: item.is_active }
}

export function HolidaysPage() {
  const auth = useAuth()
  const canEdit = auth.user?.role === 'HRD/Admin'
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [yearInput, setYearInput] = useState('')
  const [year, setYear] = useState<number | undefined>(undefined)
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Holiday | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verification, setVerification] = useState<SaveAction | null>(null)
  const items = useHolidays({ page, limit: 10, search, year, isActive: isActive || undefined })
  const mutation = useSaveHoliday()
  const busy = mutation.isPending || !!verification

  function openForm(item: Holiday | null) {
    setSelected(item); setFormOpen(true); setError(''); setSuccess('')
  }

  function closeForm() {
    setFormOpen(false); setSelected(null); setError('')
  }

  async function save(action: SaveAction) {
    if (!canEdit) return
    await mutation.mutateAsync(action)
    closeForm()
    setSuccess(action.id ? 'Hari libur berhasil diperbarui.' : 'Hari libur berhasil ditambahkan.')
  }

  async function submit(values: HolidayFormValues) {
    setError(''); setSuccess('')
    let action: SaveAction = { input: values }
    if (selected) {
      const original = inputOf(selected)
      const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => original[key as keyof HolidayInput] !== value)) as Partial<HolidayInput>
      if (!Object.keys(changes).length) { setError('Belum ada perubahan untuk disimpan.'); return }
      action = { id: selected.id, input: changes }
    }
    try { await save(action) }
    catch (cause) {
      if (statusOf(cause) === 401 && messageOf(cause) === 'Autentikasi ulang diperlukan') { setVerification(action); return }
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  async function confirm(proof: CredentialsProof) {
    if (!verification) return
    await reauthenticate(proof)
    const action = verification
    setVerification(null)
    try { await save(action) }
    catch (cause) {
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearch(keyword.trim()); setYear(yearInput ? Number(yearInput) : undefined); setPage(1)
  }

  return <section className="panel holidays-page">
    <div className="panel-header"><div><h2>Hari libur</h2><p>Kelola tanggal libur yang dikecualikan dari perhitungan durasi cuti.</p></div>{canEdit && <button className="button button-primary" disabled={busy || formOpen} onClick={() => openForm(null)}>Tambah hari libur</button>}</div>
    {success && <Notice kind="success">{success}</Notice>}
    {verification && <SecurityDialog title="Verifikasi perubahan hari libur" description="Masukkan password dan MFA jika aktif untuk melanjutkan penyimpanan." passwordChange={false} onConfirm={confirm} onClose={() => setVerification(null)} />}
    {canEdit && formOpen && <section className="holiday-editor" aria-label="Form hari libur"><div className="panel-header"><div><h3>{selected ? 'Edit hari libur' : 'Tambah hari libur'}</h3><p>Perubahan kalender digunakan pada perhitungan cuti berikutnya.</p></div></div><HolidayForm key={selected?.id ?? 'create'} initialValues={selected ? inputOf(selected) : undefined} pending={busy} error={error} onSubmit={submit} onCancel={closeForm} /></section>}
    <form className="holiday-filters" onSubmit={handleSearch}>
      <input className="text-input" aria-label="Cari nama hari libur" type="search" maxLength={150} placeholder="Cari nama hari libur" value={keyword} onChange={event => setKeyword(event.target.value)} />
      <input className="text-input" aria-label="Filter tahun hari libur" type="number" min={1900} max={2200} step={1} placeholder="Semua tahun" value={yearInput} onChange={event => setYearInput(event.target.value)} />
      <select className="text-input" aria-label="Filter status hari libur" value={isActive} onChange={event => { setIsActive(event.target.value as '' | 'true' | 'false'); setPage(1) }}><option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select><button className="button button-primary">Cari</button>
    </form>
    {items.isPending ? <div className="table-state" role="status">Memuat hari libur…</div> : items.isError ? <div className="table-state"><Notice>{messageOf(items.error)}</Notice><button className="button button-outline" onClick={() => items.refetch()}>Coba kembali</button>{statusOf(items.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div> : <>
      {items.data.data.length ? <HolidayTable items={items.data.data} onEdit={canEdit && !formOpen ? openForm : undefined} /> : <div className="table-state">Tidak ada hari libur yang sesuai dengan filter.</div>}
      <div className="table-footer"><span>{items.data.pagination.total} hari libur ditemukan</span><div className="pagination"><button className="button button-outline" disabled={page <= 1 || items.isFetching} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">{page} / {Math.max(1, items.data.pagination.totalPages)}</span><button className="button button-outline" disabled={items.isFetching || page >= items.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
    </>}
  </section>
}
