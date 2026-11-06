import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof, Role } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import { UserForm } from '../components/UserForm'
import { UserTable } from '../components/UserTable'
import { useSaveUser, useUserEmployees, useUsers } from '../user.queries'
import type { ManagedUser, UserAction } from '../user.types'

export function UsersPage() {
  const auth = useAuth()
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [role, setRole] = useState<Role | ''>('')
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<ManagedUser | null>(null)
  const [linkUser, setLinkUser] = useState<ManagedUser | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verification, setVerification] = useState<UserAction | null>(null)
  const users = useUsers({ page, limit: 10, search, role: role || undefined, isActive: isActive || undefined })
  const employees = useUserEmployees(!!linkUser)
  const mutation = useSaveUser()
  const busy = mutation.isPending || !!verification

  if (auth.user?.role !== 'HRD/Admin') return <section className="panel"><div className="table-state"><Notice>Halaman ini hanya tersedia untuk HRD/Admin.</Notice><Link to="/">Kembali ke ringkasan</Link></div></section>
  const currentUserId = auth.user.id

  function openForm(user: ManagedUser | null) {
    setSelected(user); setFormOpen(true); setLinkUser(null); setError(''); setSuccess('')
  }

  function closeEditor() {
    setFormOpen(false); setSelected(null); setLinkUser(null); setError('')
  }

  function openLink(user: ManagedUser) {
    setFormOpen(false); setLinkUser(user); setEmployeeId(user.employee_id ?? ''); setError(''); setSuccess('')
  }

  async function save(action: UserAction) {
    await mutation.mutateAsync(action)
    closeEditor()
    setSuccess(action.kind === 'create' ? 'Akun berhasil dibuat. Hubungkan profil karyawan jika diperlukan.' : action.kind === 'link' ? 'Pengaitan profil berhasil diperbarui.' : action.kind === 'deactivate' ? 'Akun berhasil dinonaktifkan.' : 'Akun berhasil diperbarui.')
    if (action.kind !== 'create' && action.id === currentUserId) {
      await auth.refresh()
    }
  }

  async function submit(action: UserAction) {
    setError(''); setSuccess('')
    try { await save(action) }
    catch (cause) {
      if (statusOf(cause) === 401 && messageOf(cause) === 'Autentikasi ulang diperlukan') {
        setVerification(action); return
      }
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

  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearch(keyword.trim()); setPage(1)
  }

  const targetId = verification && verification.kind !== 'create' ? verification.id : null
  const target = users.data?.data.find(user => user.id === targetId)

  return <section className="panel users-page">
    <div className="panel-header"><div><h2>Users & akses</h2><p>Kelola akun login, role, dan hubungan dengan profil karyawan.</p></div><button className="button button-primary" disabled={busy || formOpen || !!linkUser} onClick={() => openForm(null)}>Tambah user</button></div>
    {success && <Notice kind="success">{success}</Notice>}
    {error && !formOpen && <Notice>{error}</Notice>}
    {verification && <SecurityDialog title={verification.kind === 'deactivate' ? 'Nonaktifkan akun?' : 'Verifikasi perubahan akun'} description={`${target?.email ? `Akun: ${target.email}. ` : ''}${verification.kind === 'deactivate' ? 'Akun ini tidak dapat login dan session aktifnya akan dicabut.' : 'Masukkan password dan MFA jika aktif untuk melanjutkan perubahan.'}`} passwordChange={false} onConfirm={confirm} onClose={() => setVerification(null)} />}
    {formOpen && <section className="user-editor" aria-label="Form user"><div className="panel-header"><h3>{selected ? 'Edit user' : 'Tambah user'}</h3></div><UserForm key={selected?.id ?? 'create'} user={selected} currentUserId={currentUserId} pending={busy} error={error} onSave={submit} onCancel={closeEditor} /></section>}
    {linkUser && <section className="user-editor" aria-label="Hubungkan profil karyawan"><div className="panel-header"><div><h3>Profil karyawan</h3><p>{linkUser.email}</p></div></div>
      <form className="user-form" onSubmit={event => {
        event.preventDefault()
        if ((employeeId || null) === linkUser.employee_id) { setError('Belum ada perubahan pengaitan.'); return }
        setError(''); setSuccess(''); setVerification({ kind: 'link', id: linkUser.id, employeeId: employeeId || null })
      }}>
        <div className="form-field user-form-wide"><label htmlFor="user-employee">Karyawan aktif</label>
          <select id="user-employee" className="text-input" value={employeeId} disabled={busy || !employees.isSuccess} onChange={event => setEmployeeId(event.target.value)}>
            <option value="">Tanpa profil karyawan</option>
            {linkUser.employee_id && !employees.data?.some(employee => employee.id === linkUser.employee_id) && <option value={linkUser.employee_id}>Profil saat ini (tidak ada dalam daftar karyawan aktif)</option>}
            {employees.data?.map(employee => <option key={employee.id} value={employee.id}>{employee.nik} — {employee.full_name} ({employee.department_name})</option>)}
          </select><p className="field-hint">Perubahan profil dapat mengakhiri session akun terkait. Profil yang sudah dipakai akun lain akan ditolak backend.</p>
        </div>
        {employees.isPending && <p role="status">Memuat pilihan karyawan…</p>}
        {employees.isError && <div className="user-form-wide"><Notice>{messageOf(employees.error)}</Notice><button type="button" className="button button-outline" onClick={() => employees.refetch()}>Coba kembali</button></div>}
        <div className="user-form-actions"><button type="button" className="button button-outline" disabled={busy} onClick={closeEditor}>Batal</button><button className="button button-primary" disabled={busy || !employees.isSuccess}>Simpan pengaitan</button></div>
      </form>
    </section>}
    <form className="user-filters" onSubmit={searchUsers}>
      <input className="text-input" aria-label="Cari email user" placeholder="Cari email user" type="search" maxLength={255} value={keyword} onChange={event => setKeyword(event.target.value)} />
      <select className="text-input" aria-label="Filter role" value={role} onChange={event => { setRole(event.target.value as Role | ''); setPage(1) }}><option value="">Semua role</option><option value="Employee">Employee</option><option value="Supervisor">Supervisor</option><option value="HRD/Admin">HRD/Admin</option></select>
      <select className="text-input" aria-label="Filter status akun" value={isActive} onChange={event => { setIsActive(event.target.value as '' | 'true' | 'false'); setPage(1) }}><option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select><button className="button button-primary">Cari</button>
    </form>
    {users.isPending ? <div className="table-state" role="status">Memuat akun…</div> : users.isError ? <div className="table-state"><Notice>{messageOf(users.error)}</Notice><button className="button button-outline" onClick={() => users.refetch()}>Coba kembali</button>{statusOf(users.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}</div> : <>
      {users.data.data.length ? <UserTable users={users.data.data} currentUserId={currentUserId} disabled={busy || formOpen || !!linkUser} onEdit={openForm} onLink={openLink} onDeactivate={user => { setError(''); setSuccess(''); setVerification({ kind: 'deactivate', id: user.id }) }} onActivate={user => { setError(''); setSuccess(''); setVerification({ kind: 'update', id: user.id, input: { isActive: true } }) }} /> : <div className="table-state">Tidak ada akun yang sesuai dengan filter.</div>}
      <div className="table-footer"><span>{users.data.pagination.total} akun ditemukan</span><div className="pagination"><button className="button button-outline" disabled={page <= 1 || users.isFetching} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span aria-live="polite">{page} / {Math.max(1, users.data.pagination.totalPages)}</span><button className="button button-outline" disabled={users.isFetching || page >= users.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>
    </>}
  </section>
}
