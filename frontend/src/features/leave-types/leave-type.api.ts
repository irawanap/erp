import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { LeaveType, LeaveTypeFilters, LeaveTypeInput } from './leave-type.types'

export async function getLeaveTypes(filters: LeaveTypeFilters, signal?: AbortSignal) {
  const response = await api.get<PaginatedResponse<LeaveType>>('/leave-types', { params: filters, signal })
  return response.data
}

export async function createLeaveType(input: LeaveTypeInput) {
  const response = await api.post<ApiResponse<LeaveType>>('/leave-types', input)
  return response.data.data
}

export async function updateLeaveType(id: string, input: Partial<LeaveTypeInput>) {
  const response = await api.patch<ApiResponse<LeaveType>>(`/leave-types/${id}`, input)
  return response.data.data
}
