import type { EmploymentStatus } from './employee.types'

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  Active: 'Aktif',
  Inactive: 'Tidak aktif',
  Resigned: 'Resign',
}
