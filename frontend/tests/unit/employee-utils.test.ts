import { expect, it } from 'vitest'
import { changedFields, employeeValues } from '@/features/employees/employee.utils'
import type { Employee } from '@/features/employees/employee.types'

const employee: Employee = { id: 'employee', nik: 'EMP001', full_name: 'Andi', department_id: 'department', department_name: 'Operation', position: 'Staff', supervisor_id: 'supervisor', supervisor_name: 'Budi', join_date: '2026-01-05', employment_status: 'Active', created_at: '', updated_at: '' }

it('does not resend unchanged supervisor when editing position', () => {
  const original = employeeValues(employee)
  expect(changedFields(original, { ...original, position: 'Senior Staff' })).toEqual({ position: 'Senior Staff' })
})
it('sends null explicitly when removing supervisor', () => {
  const original = employeeValues(employee)
  expect(changedFields(original, { ...original, supervisorId: null })).toEqual({ supervisorId: null })
})
it('produces an empty patch when no fields changed', () => {
  const input = employeeValues(employee)
  expect(changedFields(input, input)).toEqual({})
})
