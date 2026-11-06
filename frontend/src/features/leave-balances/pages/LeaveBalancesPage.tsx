import { useState } from 'react'
import type { FormEvent } from 'react'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import { LeaveBalanceForm } from '../components/LeaveBalanceForm'
import { LeaveBalanceTable } from '../components/LeaveBalanceTable'
import { useBalanceEmployees, useBalanceTypes, useLeaveBalances, useSetLeaveBalance } from '../leave-balance.queries'
import type { LeaveBalance, LeaveBalanceInput } from '../leave-balance.types'

export function LeaveBalancesPage() {
  const auth = useAuth()
  const canEdit = auth.user?.role === 'HRD/Admin'
  const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date()))
  const [yearInput, setYearInput] = useState(String(currentYear))
  const [year, setYear] = useState<number | undefined>(currentYear)
  const [employeeId, setEmployeeId] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<LeaveBalance | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verification, setVerification] = useState<LeaveBalanceInput | null>(null)
  const balances = useLeaveBalances({ page, limit: 10, periodYear: year, employeeId: employeeId || undefined })
  const employees = useBalanceEmployees()
  const types = useBalanceTypes(formOpen)
  const mutation = useSetLeaveBalance()
  const busy = mutation.isPending || !!verification

  function openForm(item: LeaveBalance | null) {
    setSelected(item); setFormOpen(true); setError(''); setSuccess('')
  }

  function closeForm() {
    setFormOpen(false); setSelected(null); setError('')
  }

  async function save(input: LeaveBalanceInput) {
    if (!canEdit) return
    await mutation.mutateAsync(input)
    closeForm(); setSuccess('Hak cuti berhasil ditetapkan. Saldo terpakai tetap dipertahankan.')
  }

  async function submit(input: LeaveBalanceInput) {
    setError(''); setSuccess('')
    try { await save(input) }
    catch (cause) {
      if (statusOf(cause) === 401 && messageOf(cause) === 'Autentikasi ulang diperlukan') { setVerification(input); return }
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  async function confirm(proof: CredentialsProof) {
    if (!verification) return
    await reauthenticate(proof)
    const input = verification
    setVerification(null)
    try { await save(input) }
    catch (cause) {
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setYear(yearInput ? Number(yearInput) : undefined); setPage(1)
  }

  return <section className="panel balances-page">
    <div className="panel-header"><div><h2>Saldo cuti</h2><p>Hak tahunan, pemakaian, dan saldo tersedia sesuai cakupan akses akun.</p></div>{canEdit && <button className="button button-primary" disabled={formOpen || busy} onClick={() => openForm(null)}>Tetapkan saldo</button>}</div>
    {success && <Notice kind="success">{success}</Notice>}
    {verification && <SecurityDialog title="Verifikasi pengaturan saldo" description="Masukkan password dan MFA jika aktif untuk menetapkan hak cuti." passwordChange={false} onConfirm={confirm} onClose={() => setVerification(null)} />}
    {canEdit && formOpen && <section className="balance-editor" aria-label="Form saldo cuti"><div className="panel-header"><h3>{selected ? 'Atur hak cuti' : 'Tetapkan saldo cuti'}</h3></div>
      {employees.isPending || types.isPending ? <div className="table-state" role="status">Memuat pilihan karyawan dan jenis cuti…</div> : employees.isError || types.isError ? <div className="table-state"><Notice>{messageOf(employees.error || types.error)}</Notice><button className="button button-outline" onClick={() => { void employees.refetch(); void types.refetch() }}>Coba kembali</button><button className="button button-outline" onClick={closeForm}>Batal</button></div> : <>
        {(!employees.data.length || !types.data.length) && <Notice kind="info">Siapkan data karyawan dan jenis cuti yang menggunakan saldo terlebih dahulu.</Notice>}
        <LeaveBalanceForm key={selected?.id ?? 'create'} balance={selected} year={year ?? currentYear} employees={employees.data} types={types.data} pending={busy} error={error} onSubmit={submit} onCancel={closeForm} />
      </>}
    </section>}
    <form className="balance-filters" onSubmit={filter}>
      <input className="text-input" aria-label="Filter tahun saldo" type="number" min={1900} max={2200} step={1} placeholder="Semua tahun" value={yearInput} onChange={event => setYearInput(event.target.value)} />
      <select className="text-input" aria-label="Filter karyawan saldo" disabled={!employees.isSuccess} value={employeeId} onChange={event => { setEmployeeId(event.target.value); setPage(1) }}><option value="">Semua karyawan dalam akses Anda</option>{employees.data?.map(item => <option key={item.id} value={item.id}>{item.nik} — {item.full_name}</option>)}</select><button className="button button-primary">Terapkan</button>
    </form>
    {employees.isError && <div className="table-state"><Notice>{messageOf(employees.error)}</Notice><button className="button button-outline" onClick={() => employees.refetch()}>Muat ulang karyawan</button></div>}
    {balances.isPending ? <div className="table-state" role="status">Memuat saldo cuti…</div> : balances.isError ? <div className="table-state"><Notice>{messageOf(balances.error)}</Notice><button className="button button-outline" onClick={() => balances.refetch()}>Coba kembali</button>{statusOf(balances.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div> : <>
      {balances.data.data.length ? <LeaveBalanceTable items={balances.data.data} onEdit={canEdit && !formOpen ? openForm : undefined} /> : <div className="table-state">Belum ada saldo cuti yang sesuai dengan filter.</div>}
      <div className="table-footer"><span>{balances.data.pagination.total} saldo ditemukan</span><div className="pagination"><button className="button button-outline" disabled={page <= 1 || balances.isFetching} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">{page} / {Math.max(1, balances.data.pagination.totalPages)}</span><button className="button button-outline" disabled={balances.isFetching || page >= balances.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
    </>}
  </section>
}
