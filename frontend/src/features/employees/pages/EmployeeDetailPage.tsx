import { Link, useParams } from 'react-router-dom'
import { Notice } from '@/components/common/Notice'
import { useAuth } from '@/features/auth/use-auth'
import { messageOf, statusOf } from '@/lib/api'
import { useEmployee } from '../employee.queries'
import { employmentStatusLabels } from '../employee.constants'

export function EmployeeDetailPage() {
  const { id } = useParams()
  const employee = useEmployee(id)
  const auth = useAuth()

  if (employee.isPending) return <p role="status">Memuat detail karyawan…</p>
  if (employee.isError) return <section className="panel"><div className="table-state">
    <Notice>{messageOf(employee.error)}</Notice>
    <button className="button button-outline" onClick={() => employee.refetch()}>Coba kembali</button>
    {statusOf(employee.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}
    <Link to="/employees">Kembali ke daftar</Link>
  </div></section>

  const data = employee.data
  const fields = [
    ['ID karyawan', data.id],
    ['NIK', data.nik],
    ['Nama lengkap', data.full_name],
    ['Departemen', data.department_name],
    ['Jabatan', data.position],
    ['Atasan', data.supervisor_name ?? 'Tanpa atasan'],
    ['Tanggal bergabung', data.join_date],
    ['Status', employmentStatusLabels[data.employment_status]],
  ]

  return <section className="panel">
    <div className="panel-header"><h2>Detail karyawan</h2><Link className="button button-outline" to="/employees">Kembali</Link></div>
    <dl className="employee-details">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>
}
