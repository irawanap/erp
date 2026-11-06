import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { getBalanceEmployees, getBalanceTypes, getLeaveBalances, setLeaveBalance } from './leave-balance.api'
import type { LeaveBalanceFilters } from './leave-balance.types'

export function useLeaveBalances(filters: LeaveBalanceFilters) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['leave-balances', user?.id, filters], queryFn: ({ signal }) => getLeaveBalances(filters, signal), enabled: !!user })
}

export function useBalanceEmployees() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['employees', user?.id, 'balance-options'], queryFn: ({ signal }) => getBalanceEmployees(signal), enabled: !!user })
}

export function useBalanceTypes(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['leave-types', user?.id, 'balance-options'], queryFn: ({ signal }) => getBalanceTypes(signal), enabled: enabled && user?.role === 'HRD/Admin' })
}

export function useSetLeaveBalance() {
  const client = useQueryClient()
  return useMutation({ mutationFn: setLeaveBalance, onSuccess: () => client.invalidateQueries({ queryKey: ['leave-balances'] }) })
}
