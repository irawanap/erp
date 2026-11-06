import { api } from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { LeaveRequest, LeaveRequestDetail } from '@/features/leave-requests/leave-request.types'

export interface ApprovalInput {
  id: string
  decision: 'approve' | 'reject'
  comment: string
}

export async function getPendingApprovals(page: number, signal?: AbortSignal) {
  return (await api.get<PaginatedResponse<LeaveRequest>>('/approvals/pending', { params: { page, limit: 10 }, signal })).data
}

export async function decideLeaveRequest(input: ApprovalInput) {
  return (await api.post<ApiResponse<LeaveRequestDetail>>(`/leave-requests/${input.id}/${input.decision}`, { comment: input.comment })).data.data
}
