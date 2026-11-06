export interface LeaveBalance {
  id: string
  employee_id: string
  full_name: string
  leave_type_id: string
  leave_type_name: string
  period_year: number
  entitlement: number
  used_days: number
  available_days: number
  updated_at: string
}

export interface LeaveBalanceInput {
  employeeId: string
  leaveTypeId: string
  periodYear: number
  entitlement: number
}

export interface LeaveBalanceFilters {
  page: number
  limit: number
  employeeId?: string
  periodYear?: number
}
