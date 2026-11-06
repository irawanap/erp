import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { decideLeaveRequest, getPendingApprovals } from './approval.api'

export function usePendingApprovals(page: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['approvals', user?.id, page], queryFn: ({ signal }) => getPendingApprovals(page, signal), enabled: user?.role === 'Supervisor' })
}

export function useDecideLeaveRequest() {
  const client = useQueryClient()
  return useMutation({ mutationFn: decideLeaveRequest, onSuccess: async () => {
    await Promise.all(['approvals', 'leave-requests', 'requests', 'dashboard', 'leave-balances'].map(key => client.invalidateQueries({ queryKey: [key] })))
  } })
}
