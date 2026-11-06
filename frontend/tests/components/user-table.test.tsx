import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { UserTable } from '@/features/users/components/UserTable'
import type { ManagedUser } from '@/features/users/user.types'

const current: ManagedUser = { id: 'self', employee_id: null, email: 'admin@example.test', role: 'HRD/Admin', is_active: true, created_at: '', updated_at: '', last_login_at: null }
const other: ManagedUser = { ...current, id: 'other', email: 'employee@example.test', role: 'Employee' }
const props = () => ({ users: [current, other], currentUserId: current.id, disabled: false, onEdit: vi.fn(), onLink: vi.fn(), onDeactivate: vi.fn(), onActivate: vi.fn() })

it('does not expose self-deactivation and targets the correct other user', async () => {
  const callbacks = props()
  render(<UserTable {...callbacks} />)
  const ownRow = screen.getByText(current.email).closest('tr')!
  expect(within(ownRow).queryByRole('button', { name: 'Nonaktifkan' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Nonaktifkan' }))
  expect(callbacks.onDeactivate).toHaveBeenCalledWith(other)
})
it('locks table actions while another operation is pending', () => {
  render(<UserTable {...props()} disabled />)
  screen.getAllByRole('button').forEach(button => expect(button).toBeDisabled())
})
