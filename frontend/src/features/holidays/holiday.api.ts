import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { Holiday, HolidayFilters, HolidayInput } from './holiday.types'

export async function getHolidays(filters: HolidayFilters, signal?: AbortSignal) {
  const response = await api.get<PaginatedResponse<Holiday>>('/holidays', { params: filters, signal })
  return response.data
}

export async function createHoliday(input: HolidayInput) {
  const response = await api.post<ApiResponse<Holiday>>('/holidays', input)
  return response.data.data
}

export async function updateHoliday(id: string, input: Partial<HolidayInput>) {
  const response = await api.patch<ApiResponse<Holiday>>(`/holidays/${id}`, input)
  return response.data.data
}
