import axios from 'axios'
import { api } from '@/lib/api'
import type { PaginatedResponse } from '@/types/api'
import type { LeaveUsageRow, ReportFilters } from './report.types'

export async function getLeaveUsage(filters: ReportFilters, page: number, signal?: AbortSignal) {
  return (await api.get<PaginatedResponse<LeaveUsageRow>>('/reports/leave-usage', { params: { ...filters, page, limit: 10 }, signal })).data
}

export async function downloadLeaveUsage(filters: ReportFilters) {
  try {
    const response = await api.get<Blob>('/reports/leave-usage/export', { params: filters, responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `leave-usage-${filters.startDate}-${filters.endDate}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try { error.response.data = JSON.parse(await error.response.data.text()) } catch { /* Non-JSON errors use the shared fallback message. */ }
    }
    throw error
  }
}
