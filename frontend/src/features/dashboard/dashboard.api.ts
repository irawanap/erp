import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'

export type LeaveStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled'
export interface DashboardSummary {
  activeEmployees: number
  employeesByDepartment: { department_id: string; name: string; total: number }[]
  leaveRequestsByStatus: Record<LeaveStatus, number>
  pendingApproval: number
}
export interface LeaveRequest {
  id: string
  request_no: string
  full_name: string
  department_name: string
  leave_type_name: string
  start_date: string
  end_date: string
  total_days: number
  status: LeaveStatus
}
export async function getSummary() {
  const { data } = await api.get<ApiResponse<DashboardSummary>>('/dashboard/summary')
  return data.data
}
export async function getRequests(page: number, status: string) {
  const { data } = await api.get<PaginatedResponse<LeaveRequest>>('/leave-requests', {
    params: { page, limit: 5, ...(status ? { status } : {}) },
  })
  return data
}
