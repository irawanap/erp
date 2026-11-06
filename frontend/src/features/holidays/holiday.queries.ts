import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { createHoliday, getHolidays, updateHoliday } from './holiday.api'
import type { HolidayFilters, HolidayInput } from './holiday.types'

export function useHolidays(filters: HolidayFilters) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['holidays', user?.id, filters], queryFn: ({ signal }) => getHolidays(filters, signal), enabled: !!user })
}

export function useSaveHoliday() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: { id: string; input: Partial<HolidayInput> } | { id?: undefined; input: HolidayInput }) => {
      if (action.id !== undefined) return updateHoliday(action.id, action.input)
      return createHoliday(action.input)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['holidays'] }),
  })
}
