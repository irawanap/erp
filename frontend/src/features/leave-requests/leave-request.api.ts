import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import { getLeaveTypes } from '@/features/leave-types/leave-type.api'
import type { LeaveType } from '@/features/leave-types/leave-type.types'
import type {
    LeaveRequest,
    LeaveRequestAction,
    LeaveRequestDetail,
    LeaveRequestFilters,
} from './leave-request.types'

export async function getLeaveRequests(
    filters: LeaveRequestFilters,
    signal?: AbortSignal,
) {
    const response = await api.get<PaginatedResponse<LeaveRequest>>(
        '/leave-requests',
        { params: filters, signal },
    )

    return response.data
}

export async function getLeaveRequest(
    id: string,
    signal?: AbortSignal,
) {
    const response = await api.get<ApiResponse<LeaveRequestDetail>>(
        `/leave-requests/${id}`,
        { signal },
    )

    return response.data.data
}

export async function saveLeaveRequest(action: LeaveRequestAction) {
    if (action.kind === 'create') {
        const response = await api.post<ApiResponse<LeaveRequestDetail>>(
            '/leave-requests',
            action.input,
        )

        return response.data.data
    }

    if (action.kind === 'update') {
        const response = await api.patch<ApiResponse<LeaveRequestDetail>>(
            `/leave-requests/${action.id}`,
            action.input,
        )

        return response.data.data
    }

    const response = await api.post<ApiResponse<LeaveRequestDetail>>(
        `/leave-requests/${action.id}/${action.kind}`,
        {},
    )

    return response.data.data
}

export async function getRequestTypes(signal?: AbortSignal) {
    const items: LeaveType[] = []

    for (let page = 1; ; page += 1) {
        const result = await getLeaveTypes({
            page,
            limit: 100,
            search: '',
            isActive: 'true',
        }, signal)

        items.push(...result.data)

        if (page >= result.pagination.totalPages) {
            return items
        }
    }
}
