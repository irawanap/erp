import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { useEmployeeDepartments } from '@/features/employees/employee.queries'
import { formatLeaveDate } from '@/features/leave-requests/leave-request.constants'
import { messageOf, statusOf } from '@/lib/api'
import { downloadLeaveUsage } from '../report.api'
import { useLeaveUsage } from '../report.queries'
import { reportSchema } from '../report.validation'
import type { ReportFilters } from '../report.types'

function initialPeriod(): ReportFilters {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { startDate: today.slice(0, 4) + '-01-01', endDate: today }
}

export function ReportsPage() {
  const auth = useAuth()
  const [filters, setFilters] = useState(initialPeriod)
  const [draft, setDraft] = useState(filters)
  const [page, setPage] = useState(1)
  const [validation, setValidation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [exporting, setExporting] = useState(false)
  const [verification, setVerification] = useState<ReportFilters | null>(null)
  const report = useLeaveUsage(filters, page)
  const departments = useEmployeeDepartments()
  const busy = exporting || !!verification

  if (auth.user?.role !== 'HRD/Admin') return <section className="panel"><div className="table-state"><Notice>Laporan hanya tersedia untuk HRD/Admin.</Notice><Link to="/">Kembali ke ringkasan</Link></div></section>

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = reportSchema.safeParse(draft)
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    setValidation(''); setError(''); setSuccess(''); setFilters(result.data); setPage(1)
  }

  async function exportFile(snapshot: ReportFilters) {
    setExporting(true)
    try {
      await downloadLeaveUsage(snapshot)
      setSuccess('File CSV telah dikirim ke browser untuk diunduh.')
    } finally { setExporting(false) }
  }

  async function startExport() {
    setError(''); setSuccess('')
    const snapshot = { ...filters }
    try { await exportFile(snapshot) }
    catch (cause) {
      if (statusOf(cause) === 401 && messageOf(cause) === 'Autentikasi ulang diperlukan') { setVerification(snapshot); return }
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  async function confirm(proof: CredentialsProof) {
    if (!verification) return
    await reauthenticate(proof)
    const snapshot = verification
    setVerification(null)
    try { await exportFile(snapshot) }
    catch (cause) {
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  return <section className="panel reports-page">
    <div className="panel-header"><div><h2>Laporan penggunaan cuti</h2><p>Hari kerja cuti Approved dalam rentang tanggal yang dipilih.</p></div><button className="button button-primary" disabled={busy || !report.isSuccess || report.isFetching} onClick={startExport}><Download size={17} aria-hidden="true" />{exporting ? 'Menyiapkan CSV…' : 'Ekspor CSV'}</button></div>
    {verification && <SecurityDialog title="Verifikasi ekspor laporan" description="Masukkan password dan MFA jika aktif sebelum mengunduh data karyawan." passwordChange={false} onConfirm={confirm} onClose={() => setVerification(null)} />}
    {error && <Notice>{error}</Notice>}{success && <Notice kind="success">{success}</Notice>}
    <form className="report-filters" onSubmit={apply}>
      <div className="form-field"><label htmlFor="report-start">Tanggal mulai</label><input id="report-start" className="text-input" type="date" required disabled={busy} value={draft.startDate} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></div>
      <div className="form-field"><label htmlFor="report-end">Tanggal selesai</label><input id="report-end" className="text-input" type="date" required disabled={busy} value={draft.endDate} onChange={event => setDraft({ ...draft, endDate: event.target.value })} /></div>
      <div className="form-field"><label htmlFor="report-department">Departemen</label><select id="report-department" className="text-input" disabled={busy || !departments.isSuccess} value={draft.departmentId ?? ''} onChange={event => setDraft({ ...draft, departmentId: event.target.value || undefined })}><option value="">Semua departemen</option>{departments.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <button className="button button-primary" disabled={busy}>Terapkan</button>
    </form>
    {validation && <Notice>{validation}</Notice>}
    {departments.isError && <div className="table-state"><Notice>{messageOf(departments.error)}</Notice><button className="button button-outline" onClick={() => departments.refetch()}>Muat ulang departemen</button></div>}
    <div className="report-scope"><strong>{formatLeaveDate(filters.startDate)} — {formatLeaveDate(filters.endDate)}</strong><p>Tabel dan ekspor memakai filter yang sudah diterapkan. CSV memuat seluruh hasil, maksimal 10.000 baris. Jumlah baris merupakan kombinasi karyawan dan jenis cuti.</p></div>
    {report.isPending ? <div className="table-state" role="status">Memuat laporan…</div> : report.isError ? <div className="table-state"><Notice>{messageOf(report.error)}</Notice><button className="button button-outline" onClick={() => report.refetch()}>Coba kembali</button>{statusOf(report.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div> : <>
      {report.data.data.length ? <div className="table-scroll"><table className="data-table"><caption className="sr-only">Penggunaan cuti yang disetujui</caption><thead><tr><th scope="col">NIK</th><th scope="col">Karyawan</th><th scope="col">Departemen</th><th scope="col">Jenis cuti</th><th scope="col">Hari terpakai</th></tr></thead><tbody>{report.data.data.map(item => <tr key={`${item.employee_id}-${item.leave_type_id}`}><td>{item.nik}</td><td>{item.full_name}</td><td>{item.department_name}</td><td>{item.leave_type_name}</td><td><strong>{item.used_days.toLocaleString('id-ID')} hari</strong></td></tr>)}</tbody></table></div> : <div className="table-state">Tidak ada penggunaan cuti yang disetujui pada filter ini.</div>}
      <div className="table-footer"><span>{report.data.pagination.total} baris ditemukan</span><div className="pagination"><button className="button button-outline" disabled={page <= 1 || report.isFetching || busy} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">{page} / {Math.max(1, report.data.pagination.totalPages)}</span><button className="button button-outline" disabled={report.isFetching || busy || page >= report.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
    </>}
  </section>
}
