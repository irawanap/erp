export interface LeaveUsageRow {
  employee_id: string
  nik: string
  full_name: string
  department_id: string
  department_name: string
  leave_type_id: string
  leave_type_name: string
  used_days: number
}

export interface ReportFilters {
  startDate: string
  endDate: string
  departmentId?: string
}
