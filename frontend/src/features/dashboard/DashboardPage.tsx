import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, Clock, FileText, LoaderCircle, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/use-auth'
import { messageOf, statusOf } from '@/lib/api'
import { Notice } from '@/components/common/Notice'
import { getRequests, getSummary } from './dashboard.api'
import type { LeaveStatus } from './dashboard.api'

const statusLabels: Record<LeaveStatus, string> = { Draft: 'Draft', Submitted: 'Menunggu', Approved: 'Disetujui', Rejected: 'Ditolak', Cancelled: 'Dibatalkan' }
function shortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'))
}

export function DashboardPage() {
  const auth = useAuth()
  const client = useQueryClient()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const user = auth.user!
  const summary = useQuery({ queryKey: ['dashboard', user.id], queryFn: getSummary, retry: false })
  const requests = useQuery({ queryKey: ['requests', user.id, page, status], queryFn: () => getRequests(page, status), retry: false,
    enabled: summary.isSuccess })
  const mfaRequired = statusOf(summary.error) === 403 && messageOf(summary.error).includes('MFA')
  const counts = summary.data?.leaveRequestsByStatus
  const total = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0
  const metrics = [
    { label: user.role === 'Employee' ? 'Profil karyawan aktif' : 'Karyawan aktif', value: summary.data?.activeEmployees, Icon: Users, hint: user.role === 'HRD/Admin' ? 'Di seluruh perusahaan' : 'Sesuai cakupan akun Anda', tone: 'green' },
    { label: 'Total pengajuan', value: summary.data ? total : undefined, Icon: FileText, hint: 'Seluruh status pengajuan', tone: 'blue' },
    { label: user.role === 'Employee' ? 'Menunggu keputusan' : 'Menunggu persetujuan', value: user.role === 'Employee' ? counts?.Submitted : summary.data?.pendingApproval, Icon: Clock, hint: user.role === 'Employee' ? 'Pengajuan Anda yang disubmit' : 'Pengajuan yang perlu ditinjau', tone: 'amber' },
    { label: 'Cuti disetujui', value: counts?.Approved, Icon: ClipboardCheck, hint: 'Pengajuan berstatus approved', tone: 'violet' },
  ]

  async function refresh() {
    await client.invalidateQueries({ queryKey: ['dashboard'] })
    await client.invalidateQueries({ queryKey: ['requests'] })
  }

  return <>
    <div className="page-intro"><div><span className="section-label">OVERVIEW</span><h2>Hari yang baik untuk tim Anda<span className="heading-dot">.</span></h2><p>Perkembangan karyawan dan pengajuan cuti, dalam satu pandangan.</p></div><button className="button button-outline refresh-button" onClick={refresh} disabled={summary.isFetching || requests.isFetching}><RefreshCw size={16} className={summary.isFetching ? 'spin' : ''} /> Perbarui</button></div>
    <div className="scope-strip"><span className="scope-icon"><ShieldCheck size={18} /></span><span>Anda masuk sebagai <strong>{user.role === 'HRD/Admin' ? 'HRD / Admin' : user.role}</strong></span><span className="scope-separator" /><span className="scope-description">{user.role === 'HRD/Admin' ? 'Ringkasan seluruh perusahaan' : user.role === 'Supervisor' ? 'Ringkasan pribadi dan tim langsung' : 'Ringkasan data pribadi Anda'}</span><span className="scope-tag"><span className="tiny-dot" /> Session aktif</span></div>
    {mfaRequired ? <section className="mfa-gate panel"><span className="security-large-icon"><ShieldCheck size={30} /></span><span className="section-label">SATU LANGKAH LAGI</span><h2>Amankan akses admin Anda</h2><p>Aktifkan autentikasi dua langkah untuk membuka data workspace. Penyiapan hanya membutuhkan password dan aplikasi authenticator Anda.</p><Link className="button button-primary" to="/auth/mfa">Aktifkan MFA <ArrowRight size={17} /></Link><small>Session Anda aktif. Data perusahaan tetap terlindungi sampai verifikasi selesai.</small></section>
      : summary.isError ? <div className="panel error-panel"><Notice>{messageOf(summary.error)}</Notice><div className="error-actions"><button className="button button-outline" onClick={() => summary.refetch()}>Coba kembali</button>{statusOf(summary.error) === 401 && <button className="button button-primary" onClick={() => auth.refresh()}>Periksa session</button>}</div></div>
        : <>
          <div className="metrics-grid">{metrics.map(({ label, value, Icon, hint, tone }) => <section className="metric-card panel" key={label}><div className="metric-top"><span>{label}</span><span className={`metric-icon tone-${tone}`}><Icon size={18} /></span></div><strong className={value === undefined ? 'metric-loading' : ''}>{value === undefined ? '—' : value.toLocaleString('id-ID')}</strong><span className="metric-hint">{hint}</span></section>)}</div>
          <div className="dashboard-grid">
            <section className="panel requests-panel"><div className="panel-header"><div><h3>Pengajuan terbaru</h3><p>Histori cuti sesuai akses workspace Anda.</p></div><label className="status-filter"><span className="sr-only">Filter status pengajuan</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">Semua status</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronRight size={15} /></label></div>
              {requests.isError ? <div className="table-state"><Notice>{messageOf(requests.error)}</Notice><button className="text-button" onClick={() => requests.refetch()}>Coba kembali</button></div> : requests.isPending ? <div className="table-state"><LoaderCircle className="spin" size={23} /><p>Memuat pengajuan…</p></div> : requests.data.data.length === 0 ? <div className="table-state"><span className="empty-icon"><CalendarDays size={26} /></span><h4>Belum ada pengajuan</h4><p>{status ? 'Tidak ada pengajuan dengan status ini.' : 'Pengajuan cuti akan tampil di sini ketika tersedia.'}</p></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Karyawan</th><th>Periode cuti</th><th>Durasi</th><th>Status</th></tr></thead><tbody>{requests.data.data.map((request) => <tr key={request.id}><td><div className="employee-cell"><span className="avatar avatar-small">{request.full_name.split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><strong>{request.full_name}</strong><span>{request.department_name}</span></div></div></td><td><strong className="table-date">{shortDate(request.start_date)} – {shortDate(request.end_date)}</strong><span className="table-secondary">{request.leave_type_name}</span></td><td><span className="days-pill">{request.total_days} hari</span></td><td><span className={`status-badge status-${request.status.toLowerCase()}`}><span />{statusLabels[request.status]}</span></td></tr>)}</tbody></table></div>}
              <div className="table-footer"><span>{requests.data ? `${requests.data.pagination.total} pengajuan ditemukan` : 'Data dari workspace Anda'}</span><div className="pagination"><button className="icon-button" aria-label="Halaman sebelumnya" disabled={page <= 1 || requests.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>{page}</span><button className="icon-button" aria-label="Halaman berikutnya" disabled={!requests.data || page >= requests.data.pagination.totalPages || requests.isFetching} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></div>
            </section>
            <aside className="dashboard-side"><section className="panel department-panel"><div className="panel-header"><div><h3>{user.role === 'Employee' ? 'Organisasi Anda' : 'Distribusi karyawan'}</h3><p>Berdasarkan departemen aktif.</p></div><BuildingIcon /></div><div className="department-list">{summary.data?.employeesByDepartment.length ? summary.data.employeesByDepartment.map((department) => <div className="department-item" key={department.department_id}><div><span>{department.name}</span><strong>{department.total} <small>orang</small></strong></div><div className="progress-track"><span style={{ width: `${(department.total / Math.max(1, summary.data.activeEmployees)) * 100}%` }} /></div></div>) : <p className="muted-text">Belum ada karyawan aktif dalam cakupan akun ini.</p>}</div></section>
              <section className="account-callout"><span className="callout-icon"><ShieldCheck size={23} /></span><h3>Kelola akses<br />akun Anda.</h3><p>Periksa informasi akun, cabut session lain, atau perbarui password Anda.</p><Link className="button button-primary button-full" to="/account">Kelola akun saya <ArrowUpRight size={17} /></Link><span className="callout-footnote"><Check size={13} /> Session dapat dicabut kapan saja</span></section>
            </aside>
          </div>
        </>}
  </>
}

function BuildingIcon() {
  return <span className="panel-small-icon"><Users size={18} /></span>
}
