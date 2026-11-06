import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import {
    getLeaveRequest,
    getLeaveRequests,
    getRequestTypes,
    saveLeaveRequest,
} from './leave-request.api'
import type { LeaveRequestFilters } from './leave-request.types'

export function useLeaveRequests(filters: LeaveRequestFilters) {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['leave-requests', user?.id, 'list', filters],
        queryFn: ({ signal }) => getLeaveRequests(filters, signal),
        enabled: !!user,
    })
}

export function useLeaveRequest(id?: string) {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['leave-requests', user?.id, 'detail', id],
        queryFn: ({ signal }) => {
            if (!id) throw new Error('ID pengajuan wajib diisi.')
            return getLeaveRequest(id, signal)
        },
        enabled: !!user && !!id,
    })
}

export function useRequestTypes() {
    const { user } = useAuth()

    return useQuery({
        queryKey: ['leave-types', user?.id, 'request-options'],
        queryFn: ({ signal }) => getRequestTypes(signal),
        enabled: !!user,
    })
}

export function useSaveLeaveRequest() {
    const client = useQueryClient()

    return useMutation({
        mutationFn: saveLeaveRequest,

        onSuccess: async () => {
        await Promise.all([
            'approvals',
            'leave-requests',
            'requests',
            'dashboard',
            'leave-balances',
        ].map(key => client.invalidateQueries({
            queryKey: [key],
        })))
        },
    })
}
