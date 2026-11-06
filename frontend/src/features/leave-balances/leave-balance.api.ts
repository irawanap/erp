import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import { getEmployees } from '@/features/employees/employee.api'
import { getLeaveTypes } from '@/features/leave-types/leave-type.api'
import type { Employee } from '@/features/employees/employee.types'
import type { LeaveType } from '@/features/leave-types/leave-type.types'
import type { LeaveBalance, LeaveBalanceFilters, LeaveBalanceInput } from './leave-balance.types'

export async function getLeaveBalances(filters: LeaveBalanceFilters, signal?: AbortSignal) {
  return (await api.get<PaginatedResponse<LeaveBalance>>('/leave-balances', { params: filters, signal })).data
}

export async function setLeaveBalance(input: LeaveBalanceInput) {
  return (await api.put<ApiResponse<LeaveBalance>>('/leave-balances', input)).data.data
}

export async function getBalanceEmployees(signal?: AbortSignal) {
  const items: Employee[] = []
  for (let page = 1; ; page++) {
    const result = await getEmployees({ page, limit: 100 }, signal)
    items.push(...result.data)
    if (page >= result.pagination.totalPages) return items
  }
}

export async function getBalanceTypes(signal?: AbortSignal) {
  const items: LeaveType[] = []
  for (let page = 1; ; page++) {
    const result = await getLeaveTypes({ page, limit: 100, search: '' }, signal)
    items.push(...result.data.filter(item => item.requires_balance))
    if (page >= result.pagination.totalPages) return items
  }
}
