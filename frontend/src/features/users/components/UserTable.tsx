import type { ManagedUser } from '../user.types'

export function UserTable({ users, currentUserId, disabled, onEdit, onLink, onDeactivate, onActivate }: {
  users: ManagedUser[]
  currentUserId: string
  disabled: boolean
  onEdit: (user: ManagedUser) => void
  onLink: (user: ManagedUser) => void
  onDeactivate: (user: ManagedUser) => void
  onActivate: (user: ManagedUser) => void
}) {
  return <div className="table-scroll"><table className="data-table"><caption className="sr-only">Daftar akun user</caption>
    <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Profil karyawan</th><th scope="col">Aksi</th></tr></thead>
    <tbody>{users.map(user => <tr key={user.id}>
      <td>{user.email}{user.id === currentUserId && <span className="table-secondary">Akun Anda</span>}</td><td>{user.role}</td><td>{user.is_active ? 'Aktif' : 'Nonaktif'}</td><td>{user.employee_id ? 'Terhubung' : 'Belum terhubung'}</td>
      <td><div className="user-row-actions"><button className="button button-edit" disabled={disabled} onClick={() => onEdit(user)}>Edit</button><button className="button button-detail" disabled={disabled} onClick={() => onLink(user)}>Profil karyawan</button>
        {user.id !== currentUserId && (user.is_active ? <button className="button button-danger-soft" disabled={disabled} onClick={() => onDeactivate(user)}>Nonaktifkan</button> : <button className="button button-edit" disabled={disabled} onClick={() => onActivate(user)}>Aktifkan</button>)}
      </div></td>
    </tr>)}</tbody>
  </table></div>
}
