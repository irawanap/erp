export interface LeaveType {
  id: string
  code: string
  name: string
  requires_balance: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeaveTypeInput {
  code: string
  name: string
  requiresBalance: boolean
  isActive: boolean
}

export interface LeaveTypeFilters {
  page: number
  limit: number
  search: string
  isActive?: 'true' | 'false'
}
