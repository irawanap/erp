import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '@/components/common/Notice'
import { useAuth } from '@/features/auth/use-auth'
import { messageOf, statusOf } from '@/lib/api'
import { formatLeaveDate } from '@/features/leave-requests/leave-request.constants'
import { usePendingApprovals } from '../approval.queries'

export function ApprovalsPage() {
  const auth = useAuth()
  const [page, setPage] = useState(1)
  const items = usePendingApprovals(page)

  if (auth.user?.role !== 'Supervisor') return <section className="panel"><div className="table-state"><Notice>Halaman ini hanya tersedia untuk Supervisor.</Notice><Link to="/">Kembali ke ringkasan</Link></div></section>

  return <section className="panel approvals-page">
    <div className="panel-header"><div><h2>Persetujuan tim</h2><p>Pengajuan Submitted yang ditugaskan kepada Anda sebagai atasan langsung.</p></div><button className="button button-outline" disabled={items.isFetching} onClick={() => items.refetch()}>Perbarui</button></div>
    {!auth.user.employee_id && <Notice kind="info">Hubungkan akun dengan profil karyawan melalui HRD untuk menerima penugasan approval.</Notice>}
    {items.isPending ? <div className="table-state" role="status">Memuat pengajuan tim…</div> : items.isError ? <div className="table-state"><Notice>{messageOf(items.error)}</Notice><button className="button button-outline" onClick={() => items.refetch()}>Coba kembali</button>{statusOf(items.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div> : <>
      {items.data.data.length ? <div className="table-scroll"><table className="data-table"><caption className="sr-only">Pengajuan menunggu keputusan</caption><thead><tr><th scope="col">Karyawan</th><th scope="col">Jenis cuti</th><th scope="col">Periode</th><th scope="col">Durasi</th><th scope="col">Aksi</th></tr></thead><tbody>{items.data.data.map(item => <tr key={item.id}><td><strong>{item.full_name}</strong><span className="table-secondary">{item.department_name}</span></td><td>{item.leave_type_name}</td><td>{formatLeaveDate(item.start_date)}<span className="table-secondary">s.d. {formatLeaveDate(item.end_date)}</span></td><td>{item.total_days} hari</td><td><Link className="button button-detail" to={`/leave-requests/${item.id}`}>Tinjau pengajuan</Link></td></tr>)}</tbody></table></div> : <div className="table-state">Tidak ada pengajuan menunggu keputusan pada halaman ini.</div>}
      <div className="table-footer"><span>{items.data.pagination.total} pengajuan menunggu</span><div className="pagination"><button className="button button-outline" disabled={page <= 1 || items.isFetching} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">{page} / {Math.max(1, items.data.pagination.totalPages)}</span><button className="button button-outline" disabled={items.isFetching || page >= items.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
    </>}
  </section>
}
