import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { createLeaveType, getLeaveTypes, updateLeaveType } from './leave-type.api'
import type { LeaveTypeFilters, LeaveTypeInput } from './leave-type.types'

export function useLeaveTypes(filters: LeaveTypeFilters) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['leave-types', user?.id, filters], queryFn: ({ signal }) => getLeaveTypes(filters, signal), enabled: !!user })
}

export function useSaveLeaveType() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: { id: string; input: Partial<LeaveTypeInput> } | { id?: undefined; input: LeaveTypeInput }) => {
      if (action.id !== undefined) return updateLeaveType(action.id, action.input)
      return createLeaveType(action.input)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['leave-types'] }),
  })
}
