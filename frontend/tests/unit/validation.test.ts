import { describe, expect, it } from 'vitest'
import { departmentSchema } from '@/features/departments/department.validation'
import { employeeSchema } from '@/features/employees/employee.validation'
import { createUserSchema } from '@/features/users/user.validation'
import { leaveTypeSchema } from '@/features/leave-types/leave-type.validation'
import { holidaySchema } from '@/features/holidays/holiday.validation'
import { leaveBalanceSchema } from '@/features/leave-balances/leave-balance.validation'
import { leaveRequestSchema } from '@/features/leave-requests/leave-request.validation'
import { approvalSchema } from '@/features/approvals/approval.validation'
import { reportSchema } from '@/features/reports/report.validation'
import { loginSchema, registrationSchema } from '@/features/auth/auth.validation'

const id = '9c59cfac-6a95-4d7f-bab5-115911152773'
const employee = { nik: ' e001 ', fullName: ' Andi ', departmentId: id, position: ' Staff ', supervisorId: '', joinDate: '2026-01-05', employmentStatus: 'Active' }
const request = { leaveTypeId: id, startDate: '2026-12-14', endDate: '2026-12-15', reason: ' Family ' }

describe('form contracts', () => {
  it('normalizes department values before sending', () => {
    expect(departmentSchema.parse({ code: ' hr ', name: ' HRD ' })).toEqual({ code: 'HR', name: 'HRD' })
  })
  it.each(['', ' '.repeat(3), 'x'.repeat(21)])('rejects invalid department code %j', code => {
    expect(departmentSchema.safeParse({ code, name: 'HRD' }).success).toBe(false)
  })
  it('rejects privilege fields injected into a department form', () => {
    expect(departmentSchema.safeParse({ code: 'HR', name: 'HRD', role: 'HRD/Admin' }).success).toBe(false)
  })
  it('normalizes employee identity and accepts no supervisor', () => {
    expect(employeeSchema.parse(employee)).toMatchObject({ nik: 'E001', fullName: 'Andi', supervisorId: '' })
  })
  it.each([{ joinDate: '2026-02-30' }, { departmentId: '1' }, { supervisorId: 'invalid' }, { employmentStatus: 'Deleted' }])('rejects invalid employee fields %j', patch => {
    expect(employeeSchema.safeParse({ ...employee, ...patch }).success).toBe(false)
  })
  it('requires a strong initial password and normalizes user email', () => {
    expect(createUserSchema.parse({ email: ' ADMIN@example.test ', role: 'Employee', password: 'long-password-for-test' }).email).toBe('admin@example.test')
    expect(createUserSchema.safeParse({ email: 'a@example.test', role: 'Employee', password: 'short' }).success).toBe(false)
  })
  it('enforces password byte limit for multibyte input', () => {
    expect(createUserSchema.safeParse({ email: 'a@example.test', role: 'Employee', password: '🔐'.repeat(20) }).success).toBe(false)
  })
  it('preserves false policy flags rather than applying defaults', () => {
    expect(leaveTypeSchema.parse({ code: ' unpaid ', name: ' Unpaid ', requiresBalance: false, isActive: false })).toMatchObject({ code: 'UNPAID', requiresBalance: false, isActive: false })
  })
  it('validates leap-day holiday dates', () => {
    expect(holidaySchema.safeParse({ holidayDate: '2028-02-29', name: 'Holiday', isActive: true }).success).toBe(true)
    expect(holidaySchema.safeParse({ holidayDate: '2027-02-29', name: 'Holiday', isActive: true }).success).toBe(false)
  })
  it.each([0, 0.5, 12, 12.5])('accepts entitlement %s', entitlement => {
    expect(leaveBalanceSchema.safeParse({ employeeId: id, leaveTypeId: id, periodYear: 2026, entitlement }).success).toBe(true)
  })
  it.each([-1, 0.25, 10000, NaN])('rejects entitlement %s', entitlement => {
    expect(leaveBalanceSchema.safeParse({ employeeId: id, leaveTypeId: id, periodYear: 2026, entitlement }).success).toBe(false)
  })
  it('rejects reversed leave dates on the end-date field', () => {
    const result = leaveRequestSchema.safeParse({ ...request, endDate: '2026-12-13' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['endDate'])
  })
  it('accepts same-day leave and trims the reason', () => {
    expect(leaveRequestSchema.parse({ ...request, endDate: request.startDate }).reason).toBe('Family')
  })
  it.each(['', '   ', 'x'.repeat(2001)])('requires a bounded decision comment', comment => {
    expect(approvalSchema.safeParse({ comment }).success).toBe(false)
  })
  it('accepts a full leap year report but rejects a 367-day period', () => {
    expect(reportSchema.safeParse({ startDate: '2028-01-01', endDate: '2028-12-31' }).success).toBe(true)
    expect(reportSchema.safeParse({ startDate: '2028-01-01', endDate: '2029-01-01' }).success).toBe(false)
  })
  it('rejects reversed report dates', () => {
    expect(reportSchema.safeParse({ startDate: '2026-12-31', endDate: '2026-01-01' }).success).toBe(false)
  })
  it('checks authenticator and recovery-code formats', () => {
    const login = { email: 'a@example.test', password: 'password', factor: 'otp', code: '12345' }
    expect(loginSchema.safeParse(login).success).toBe(false)
    expect(loginSchema.safeParse({ ...login, code: '123456' }).success).toBe(true)
    expect(loginSchema.safeParse({ ...login, factor: 'recovery', code: 'a'.repeat(32) }).success).toBe(true)
  })
  it('requires matching password confirmation', () => {
    expect(registrationSchema.safeParse({ email: 'a@example.test', password: 'long-password-for-test', confirmPassword: 'different' }).success).toBe(false)
  })
})
