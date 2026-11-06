import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { getLeaveUsage } from './report.api'
import type { ReportFilters } from './report.types'

export function useLeaveUsage(filters: ReportFilters, page: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['reports', user?.id, filters, page], queryFn: ({ signal }) => getLeaveUsage(filters, page, signal), enabled: user?.role === 'HRD/Admin' })
}
