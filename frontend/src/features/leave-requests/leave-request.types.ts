export type LeaveRequestStatus =
    |   'Draft'
    |   'Submitted'
    |   'Approved'
    |   'Rejected'
    |   'Cancelled'

export interface LeaveRequest {
    id: string
    request_no: string
    employee_id: string
    nik: string
    full_name: string
    department_id: string
    department_name: string
    leave_type_id: string
    leave_type_name: string
    start_date: string
    end_date: string
    total_days: number
    reason: string
    status: LeaveRequestStatus
    approver_id: string | null
    approver_name: string | null
    submitted_at: string | null
    created_at: string
    updated_at: string
}

export interface LeaveApproval {
    id: string
    approver_id: string
    approver_name: string
    decision: 'Approved' | 'Rejected'
    comment: string
    decided_at: string
}

export interface LeaveRequestDetail extends LeaveRequest {
    approvals: LeaveApproval[]
    working_dates: string[]
}

export interface LeaveRequestInput {
    leaveTypeId: string
    startDate: string
    endDate: string
    reason: string
}

export interface LeaveRequestFilters {
    page: number
    limit: number
    status?: LeaveRequestStatus
    employeeId?: string
}

export type LeaveRequestAction =
    | { kind: 'create'; input: LeaveRequestInput }
    | {
        kind: 'update'
        id: string
        input: LeaveRequestInput
    }
    | { kind: 'submit' | 'cancel'; id: string}
