import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { LeaveRequestForm } from '@/features/leave-requests/components/LeaveRequestForm'
import type { LeaveType } from '@/features/leave-types/leave-type.types'

const type: LeaveType = { id: '9c59cfac-6a95-4d7f-bab5-115911152773', code: 'ANNUAL', name: 'Annual Leave', requires_balance: true, is_active: true, created_at: '', updated_at: '' }
const input = { leaveTypeId: type.id, startDate: '2026-12-14', endDate: '2026-12-15', reason: ' Family leave ' }

it('shows validation errors and does not submit an empty form', async () => {
  const onSubmit = vi.fn()
  render(<LeaveRequestForm types={[type]} pending={false} error="" onSubmit={onSubmit} onCancel={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Simpan draft' }))
  expect(await screen.findByText('Alasan cuti wajib diisi.')).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})
it('submits normalized input without adding status or employee fields', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<LeaveRequestForm types={[type]} initialValues={input} pending={false} error="" onSubmit={onSubmit} onCancel={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Simpan draft' }))
  expect(onSubmit).toHaveBeenCalled()
  expect(onSubmit.mock.calls[0][0]).toEqual({ ...input, reason: 'Family leave' })
})
it('disables save and cancel during a pending request', () => {
  render(<LeaveRequestForm types={[type]} initialValues={input} pending error="" onSubmit={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Menyimpan…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled()
  expect(screen.getByLabelText('Alasan cuti')).toBeDisabled()
})
it('preserves entered values when a server error is rendered', () => {
  const props = { types: [type], initialValues: input, pending: false, onSubmit: vi.fn(), onCancel: vi.fn() }
  const { rerender } = render(<LeaveRequestForm {...props} error="" />)
  rerender(<LeaveRequestForm {...props} error="Saldo tidak cukup" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Saldo tidak cukup')
  expect(screen.getByLabelText('Alasan cuti')).toHaveValue(input.reason)
})
