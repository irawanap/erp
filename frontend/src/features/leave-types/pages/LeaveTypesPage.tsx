import { useState } from 'react'
import type { FormEvent } from 'react'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import { LeaveTypeForm } from '../components/LeaveTypeForm'
import { LeaveTypeTable } from '../components/LeaveTypeTable'
import { useLeaveTypes, useSaveLeaveType } from '../leave-type.queries'
import type { LeaveType, LeaveTypeInput } from '../leave-type.types'
import type { LeaveTypeFormValues } from '../leave-type.validation'

type SaveAction = { id: string; input: Partial<LeaveTypeInput> } | { id?: undefined; input: LeaveTypeInput }

function inputOf(item: LeaveType): LeaveTypeInput {
  return { code: item.code, name: item.name, requiresBalance: item.requires_balance, isActive: item.is_active }
}

export function LeaveTypesPage() {
  const auth = useAuth()
  const canEdit = auth.user?.role === 'HRD/Admin'
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<LeaveType | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verification, setVerification] = useState<SaveAction | null>(null)
  const items = useLeaveTypes({ page, limit: 10, search, isActive: isActive || undefined })
  const mutation = useSaveLeaveType()
  const busy = mutation.isPending || !!verification

  function openForm(item: LeaveType | null) {
    setSelected(item); setFormOpen(true); setError(''); setSuccess('')
  }

  function closeForm() {
    setFormOpen(false); setSelected(null); setError('')
  }

  async function save(action: SaveAction) {
    if (!canEdit) return
    await mutation.mutateAsync(action)
    closeForm()
    setSuccess(action.id ? 'Jenis cuti berhasil diperbarui.' : 'Jenis cuti berhasil ditambahkan.')
  }

  async function submit(values: LeaveTypeFormValues) {
    setError(''); setSuccess('')
    let action: SaveAction = { input: values }
    if (selected) {
      const original = inputOf(selected)
      const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => original[key as keyof LeaveTypeInput] !== value)) as Partial<LeaveTypeInput>
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
    event.preventDefault(); setSearch(keyword.trim()); setPage(1)
  }

  return <section className="panel leave-types-page">
    <div className="panel-header"><div><h2>Jenis cuti</h2><p>Atur jenis cuti, penggunaan saldo, dan ketersediaan pengajuan.</p></div>{canEdit && <button className="button button-primary" disabled={busy || formOpen} onClick={() => openForm(null)}>Tambah jenis cuti</button>}</div>
    {success && <Notice kind="success">{success}</Notice>}
    {verification && <SecurityDialog title="Verifikasi perubahan jenis cuti" description="Masukkan password dan MFA jika aktif untuk melanjutkan penyimpanan." passwordChange={false} onConfirm={confirm} onClose={() => setVerification(null)} />}
    {canEdit && formOpen && <section className="leave-type-editor" aria-label="Form jenis cuti"><div className="panel-header"><div><h3>{selected ? 'Edit jenis cuti' : 'Tambah jenis cuti'}</h3><p>Perubahan penggunaan saldo atau status harus menunggu pengajuan pending selesai.</p></div></div><LeaveTypeForm key={selected?.id ?? 'create'} initialValues={selected ? inputOf(selected) : undefined} pending={busy} error={error} onSubmit={submit} onCancel={closeForm} /></section>}
    <form className="leave-type-filters" onSubmit={handleSearch}>
      <input className="text-input" aria-label="Cari kode atau nama jenis cuti" type="search" maxLength={150} placeholder="Cari kode atau nama jenis cuti" value={keyword} onChange={event => setKeyword(event.target.value)} />
      <select className="text-input" aria-label="Filter status jenis cuti" value={isActive} onChange={event => { setIsActive(event.target.value as '' | 'true' | 'false'); setPage(1) }}><option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select><button className="button button-primary">Cari</button>
    </form>
    {items.isPending ? <div className="table-state" role="status">Memuat jenis cuti…</div> : items.isError ? <div className="table-state"><Notice>{messageOf(items.error)}</Notice><button className="button button-outline" onClick={() => items.refetch()}>Coba kembali</button>{statusOf(items.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div> : <>
      {items.data.data.length ? <LeaveTypeTable items={items.data.data} onEdit={canEdit && !formOpen ? openForm : undefined} /> : <div className="table-state">Tidak ada jenis cuti yang sesuai dengan filter.</div>}
      <div className="table-footer"><span>{items.data.pagination.total} jenis cuti ditemukan</span><div className="pagination"><button className="button button-outline" disabled={page <= 1 || items.isFetching} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">{page} / {Math.max(1, items.data.pagination.totalPages)}</span><button className="button button-outline" disabled={items.isFetching || page >= items.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
    </>}
  </section>
}
