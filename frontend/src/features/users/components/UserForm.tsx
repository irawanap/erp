import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Role } from '@/features/auth/auth.types'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Notice } from '@/components/common/Notice'
import { createUserSchema, userSchema } from '../user.validation'
import type { ManagedUser, UserAction } from '../user.types'

export function UserForm({ user, currentUserId, pending, error, onSave, onCancel }: {
  user: ManagedUser | null
  currentUserId: string
  pending: boolean
  error: string
  onSave: (action: UserAction) => Promise<void>
  onCancel: () => void
}) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'Employee')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = user ? userSchema.safeParse({ email, role }) : createUserSchema.safeParse({ email, role, password })
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    setValidation('')
    if (user) {
      const input: { email?: string; role?: Role } = {}
      if (result.data.email !== user.email) input.email = result.data.email
      if (result.data.role !== user.role) input.role = result.data.role
      if (!Object.keys(input).length) { setValidation('Belum ada perubahan untuk disimpan.'); return }
      await onSave({ kind: 'update', id: user.id, input })
    } else {
      await onSave({ kind: 'create', input: { ...result.data, password } })
    }
  }

  return <form className="user-form" onSubmit={submit} noValidate>
    {(validation || error) && <div className="user-form-wide"><Notice>{validation || error}</Notice></div>}
    <div className="form-field"><label htmlFor="user-email">Email</label><input id="user-email" className="text-input" type="email" autoComplete="off" maxLength={255} disabled={pending} value={email} onChange={event => setEmail(event.target.value)} required /></div>
    <div className="form-field"><label htmlFor="user-role">Role</label><select id="user-role" className="text-input" disabled={pending || user?.id === currentUserId} value={role} onChange={event => setRole(event.target.value as Role)}><option value="Employee">Employee</option><option value="Supervisor">Supervisor</option><option value="HRD/Admin">HRD/Admin</option></select></div>
    {!user && <div className="form-field user-form-wide"><label htmlFor="user-password">Password awal</label><PasswordInput id="user-password" autoComplete="new-password" disabled={pending} value={password} onChange={event => setPassword(event.target.value)} /><p className="field-hint">Minimal 15 karakter, maksimal 72 byte. Sampaikan password melalui saluran pribadi.</p></div>}
    <div className="user-form-actions"><button type="button" className="button button-outline" disabled={pending} onClick={onCancel}>Batal</button><button className="button button-primary" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>
}
