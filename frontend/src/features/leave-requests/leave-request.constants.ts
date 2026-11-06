import type { LeaveRequestStatus } from "./leave-request.types";

export const leaveRequestStatusLabels: Record<
    LeaveRequestStatus,
    string
> = {
    Draft: 'Draft',
    Submitted: 'Menunggu persetujuan',
    Approved: 'Disetujui',
    Rejected: 'Ditolak',
    Cancelled: 'Dibatalkan',
}

export function formatLeaveDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`))
}
