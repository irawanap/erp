import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import { getEmployees } from '@/features/employees/employee.api'
import type { Employee } from '@/features/employees/employee.types'
import type { ManagedUser, UserAction, UserFilters } from './user.types'

export async function getUsers(filters: UserFilters, signal?: AbortSignal) {
  const response = await api.get<PaginatedResponse<ManagedUser>>('/users', { params: filters, signal })
  return response.data
}

export async function saveUser(action: UserAction) {
  switch (action.kind) {
    case 'create': return (await api.post<ApiResponse<ManagedUser>>('/users', action.input)).data.data
    case 'update': return (await api.patch<ApiResponse<ManagedUser>>(`/users/${action.id}`, action.input)).data.data
    case 'deactivate': return (await api.delete<ApiResponse<ManagedUser>>(`/users/${action.id}`, { data: {} })).data.data
    case 'link': return (await api.patch(`/users/${action.id}/employee`, { employeeId: action.employeeId })).data.data
  }
}

export async function getEmployeeOptions(signal?: AbortSignal) {
  const employees: Employee[] = []
  let page = 1
  while (true) {
    const result = await getEmployees({ page, limit: 100, status: 'Active' }, signal)
    employees.push(...result.data)
    if (page >= result.pagination.totalPages) break
    page += 1
  }
  return employees
}
