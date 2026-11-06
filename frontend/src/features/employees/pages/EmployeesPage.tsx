import { useState } from 'react'
import type { FormEvent } from 'react'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import { EmployeeForm } from '../components/EmployeeForm'
import { EmployeeTable } from '../components/EmployeeTable'
import { useCreateEmployee, useEmployeeDepartments, useEmployees, useUpdateEmployee } from '../employee.queries'
import { changedFields, employeeValues } from '../employee.utils'
import type { Employee, EmployeeInput, EmploymentStatus } from '../employee.types'
import type { EmployeeFormValues } from '../employee.validation'

type SaveAction = { id: string; input: Partial<EmployeeInput> } | { id?: undefined; input: EmployeeInput }

export function EmployeesPage() {
  const auth = useAuth()
  const canEdit = auth.user?.role === 'HRD/Admin'
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState<EmploymentStatus | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingSave, setPendingSave] = useState<SaveAction | null>(null)
  const employees = useEmployees({ page, limit: 10, search, departmentId: departmentId || undefined, status: status || undefined })
  const departments = useEmployeeDepartments()
  const create = useCreateEmployee()
  const update = useUpdateEmployee()

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearch(keyword.trim())
    setPage(1)
  }

  function openForm(employee: Employee | null) {
    setSelected(employee)
    setFormError('')
    setSuccess('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setSelected(null)
    setFormError('')
  }

  async function save(action: SaveAction) {
    if (!canEdit) return
    if (action.id === undefined) await create.mutateAsync(action.input)
    else await update.mutateAsync({ id: action.id, input: action.input })
    closeForm()
    setSuccess(action.id ? 'Karyawan berhasil diperbarui.' : 'Karyawan berhasil ditambahkan.')
  }

  async function handleSave(values: EmployeeFormValues) {
    setFormError('')
    setSuccess('')
    const input: EmployeeInput = { ...values, supervisorId: values.supervisorId || null }
    const action: SaveAction = selected
      ? { id: selected.id, input: changedFields(employeeValues(selected), input) }
      : { input }
    if (!Object.keys(action.input).length) {
      setFormError('Belum ada perubahan untuk disimpan.')
      return
    }
    try {
      await save(action)
    } catch (error) {
      if (statusOf(error) === 401 && messageOf(error) === 'Autentikasi ulang diperlukan') {
        setPendingSave(action)
        return
      }
      setFormError(messageOf(error))
      if (statusOf(error) === 401) await auth.refresh()
    }
  }

  async function confirmSave(proof: CredentialsProof) {
    if (!pendingSave) return
    await reauthenticate(proof)
    const action = pendingSave
    setPendingSave(null)
    try {
      await save(action)
    } catch (error) {
      setFormError(messageOf(error))
      if (statusOf(error) === 401) await auth.refresh()
    }
  }

  return <section className="panel employees-page">
    <div className="panel-header"><div><h2>Karyawan</h2><p>Data ditampilkan sesuai cakupan akses akun Anda.</p></div>
      {canEdit && <button className="button button-primary" onClick={() => openForm(null)} disabled={formOpen || !departments.isSuccess}>Tambah karyawan</button>}
    </div>
    {success && <Notice kind="success">{success}</Notice>}
    {pendingSave && <SecurityDialog title="Verifikasi sebelum menyimpan" description="Masukkan password dan MFA jika aktif untuk melanjutkan penyimpanan." passwordChange={false} onConfirm={confirmSave} onClose={() => setPendingSave(null)} />}
    {canEdit && formOpen && departments.data && <section className="employee-editor" aria-label="Form karyawan">
      <div className="panel-header"><h3>{selected ? 'Edit karyawan' : 'Tambah karyawan'}</h3></div>
      <EmployeeForm key={selected?.id ?? 'create'} initialValues={selected ? { ...employeeValues(selected), supervisorId: selected.supervisor_id ?? '' } : undefined}
        departments={departments.data} pending={create.isPending || update.isPending || !!pendingSave} error={formError} onSubmit={handleSave} onCancel={closeForm} />
    </section>}
    <form className="employee-filters" onSubmit={handleSearch}>
      <label className="sr-only" htmlFor="employee-search">Cari NIK atau nama</label>
      <input id="employee-search" className="text-input" type="search" placeholder="Cari NIK atau nama" maxLength={150} value={keyword} onChange={event => setKeyword(event.target.value)} />
      <select className="text-input" aria-label="Filter departemen" value={departmentId} disabled={!departments.isSuccess} onChange={event => { setDepartmentId(event.target.value); setPage(1) }}>
        <option value="">Semua departemen</option>{departments.data?.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      <select className="text-input" aria-label="Filter status kerja" value={status} onChange={event => { setStatus(event.target.value as EmploymentStatus | ''); setPage(1) }}>
        <option value="">Semua status</option><option value="Active">Aktif</option><option value="Inactive">Tidak aktif</option><option value="Resigned">Resign</option>
      </select>
      <button type="submit" className="button button-primary">Cari</button>
    </form>
    {departments.isError && <div className="table-state"><Notice>{messageOf(departments.error)}</Notice><button className="button button-outline" onClick={() => departments.refetch()}>Muat ulang departemen</button></div>}
    {departments.isPending && <p className="employee-options-status" role="status">Memuat pilihan departemen…</p>}
    {employees.isPending ? <div className="table-state" role="status">Memuat karyawan…</div>
      : employees.isError ? <div className="table-state"><Notice>{messageOf(employees.error)}</Notice><button className="button button-outline" onClick={() => employees.refetch()}>Coba kembali</button>{statusOf(employees.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div>
        : <>
          {employees.data.data.length === 0 ? <div className="table-state">Tidak ada karyawan yang sesuai dengan filter.</div> : <EmployeeTable employees={employees.data.data} onEdit={canEdit && !formOpen ? openForm : undefined} />}
          <div className="table-footer"><span>{employees.data.pagination.total} karyawan ditemukan</span><div className="pagination">
            <button className="button button-outline" disabled={page <= 1 || employees.isFetching} onClick={() => setPage(current => current - 1)}>Sebelumnya</button>
            <span aria-live="polite">{page} / {Math.max(1, employees.data.pagination.totalPages)}</span>
            <button className="button button-outline" disabled={employees.isFetching || page >= employees.data.pagination.totalPages} onClick={() => setPage(current => current + 1)}>Berikutnya</button>
          </div></div>
        </>}
  </section>
}
