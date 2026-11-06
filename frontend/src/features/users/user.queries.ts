import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { getEmployeeOptions, getUsers, saveUser } from './user.api'
import type { UserFilters } from './user.types'

export function useUsers(filters: UserFilters) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['users', user?.id, filters], queryFn: ({ signal }) => getUsers(filters, signal), enabled: user?.role === 'HRD/Admin' })
}

export function useUserEmployees(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['employees', user?.id, 'user-options'], queryFn: ({ signal }) => getEmployeeOptions(signal), enabled: enabled && user?.role === 'HRD/Admin' })
}

export function useSaveUser() {
  const client = useQueryClient()
  return useMutation({ mutationFn: saveUser, onSuccess: async () => {
    await Promise.all(['users', 'employees', 'sessions', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
}
