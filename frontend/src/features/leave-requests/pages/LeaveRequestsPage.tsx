import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Notice } from '@/components/common/Notice'
import { useAuth } from '@/features/auth/use-auth'
import { messageOf, statusOf } from '@/lib/api'
import { LeaveRequestForm } from '../components/LeaveRequestForm'
import {
    useLeaveRequests,
    useRequestTypes,
    useSaveLeaveRequest,
} from '../leave-request.queries'
import {
    formatLeaveDate,
    leaveRequestStatusLabels,
} from '../leave-request.constants'
import type {
    LeaveRequestInput,
    LeaveRequestStatus,
} from '../leave-request.types'

export function LeaveRequestsPage() {
    const auth = useAuth()
    const navigate = useNavigate()

    const [page, setPage] = useState(1)
    const [status, setStatus] = useState<LeaveRequestStatus | ''>('')
    const [ownOnly, setOwnOnly] = useState(false)
    const [formOpen, setFormOpen] = useState(false)
    const [error, setError] = useState('')

    const requests = useLeaveRequests({
        page,
        limit: 10,
        status: status || undefined,
        employeeId: ownOnly ? auth.user?.employee_id ?? undefined : undefined,
    })

    const types = useRequestTypes()
    const mutation = useSaveLeaveRequest()

    async function createDraft(input: LeaveRequestInput) {
        setError('')

    try {
        const result = await mutation.mutateAsync({
            kind: 'create',
            input,
        })

        navigate(`/leave-requests/${result.id}`)
        } catch (cause) {
            setError(messageOf(cause))
            if (statusOf(cause) === 401) await auth.refresh()
        }
    }

    return (
        <section className="panel leave-requests-page">
            <div className="panel-header">
                <div>
                    <h2>Pengajuan cuti</h2>
                    <p>Daftar pengajuan sesuai cakupan akses akun Anda.</p>
                </div>

                <button
                    className="button button-primary"
                    disabled={!auth.user?.employee_id || formOpen}
                    onClick={() => {
                        setError('')
                        setFormOpen(true)
                    }}
                >
                    Ajukan cuti
                </button>
            </div>

            {!auth.user?.employee_id && (
                <Notice kind="info">
                    Hubungkan akun dengan profil karyawan melalui HRD
                    sebelum membuat pengajuan.
                </Notice>
            )}

            {formOpen && (
                <section className="request-editor" aria-label="Draft baru">
                    <div className="panel-header">
                        <h3>Pengajuan baru</h3>
                    </div>

                    {types.isPending ? (
                        <div className="table-state">Memuat jenis cuti…</div>
                    ) : types.isError ? (
                        <div className="table-state">
                            <Notice>{messageOf(types.error)}</Notice>

                            <button
                                className="button button-outline"
                                onClick={() => types.refetch()}
                            >
                                Coba kembali
                            </button>

                            <button
                                className="button button-outline"
                                onClick={() => setFormOpen(false)}
                            >
                                Batal
                            </button>
                        </div>
                    ) : (
                        <>
                        {types.data.length === 0 && (
                            <Notice kind="info">
                                Belum ada jenis cuti aktif. Hubungi HRD.
                            </Notice>
                        )}

                        <LeaveRequestForm
                            types={types.data}
                            pending={mutation.isPending}
                            error={error}
                            onSubmit={createDraft}
                            onCancel={() => setFormOpen(false)}
                        />
                        </>
                    )}
                </section>
            )}

            <div className="request-filters">
                <select
                    className="text-input"
                    aria-label="Filter status pengajuan"
                    value={status}
                    onChange={event => {
                        setStatus(event.target.value as LeaveRequestStatus | '')
                        setPage(1)
                    }}
                >
                <option value="">Semua status</option>

                {Object.entries(leaveRequestStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                    {label}
                    </option>
                ))}
                </select>

                {auth.user?.employee_id && (
                <label className="request-own-filter">
                    <input
                        type="checkbox"
                        checked={ownOnly}
                        onChange={event => {
                            setOwnOnly(event.target.checked)
                            setPage(1)
                        }}
                    />
                    Pengajuan saya saja
                </label>
                )}
            </div>

            {requests.isPending ? (
                <div className="table-state" role="status">
                Memuat pengajuan…
                </div>
            ) : requests.isError ? (
                <div className="table-state">
                    <Notice>{messageOf(requests.error)}</Notice>

                    <button
                        className="button button-outline"
                        onClick={() => requests.refetch()}
                    >
                        Coba kembali
                    </button>

                    {statusOf(requests.error) === 401 && (
                        <button
                            className="button button-outline"
                            onClick={() => auth.refresh()}
                        >
                        Periksa session
                        </button>
                    )}
                </div>
            ) : (
                <>
                {requests.data.data.length === 0 ? (
                    <div className="table-state">
                    Tidak ada pengajuan yang sesuai dengan filter.
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <caption className="sr-only">Daftar pengajuan cuti</caption>

                            <thead>
                                <tr>
                                    <th scope="col">Karyawan</th>
                                    <th scope="col">Jenis cuti</th>
                                    <th scope="col">Periode</th>
                                    <th scope="col">Durasi</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Aksi</th>
                                </tr>
                            </thead>

                            <tbody>
                            {requests.data.data.map(request => (
                                <tr key={request.id}>
                                    <td>
                                        <strong>{request.full_name}</strong>
                                        <span className="table-secondary">
                                        {request.department_name}
                                        </span>
                                    </td>

                                    <td>{request.leave_type_name}</td>

                                    <td>
                                        {formatLeaveDate(request.start_date)}
                                        <span className="table-secondary">
                                        s.d. {formatLeaveDate(request.end_date)}
                                        </span>
                                    </td>

                                    <td>{request.total_days} hari</td>

                                    <td>
                                        {leaveRequestStatusLabels[request.status]}
                                    </td>

                                    <td>
                                        <Link
                                        className="button button-detail"
                                        to={`/leave-requests/${request.id}`}
                                        >
                                        Detail
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="table-footer">
                    <span>
                    {requests.data.pagination.total} pengajuan ditemukan
                    </span>

                    <div className="pagination">
                        <button
                            className="button button-outline"
                            disabled={page <= 1 || requests.isFetching}
                            onClick={() => setPage(value => value - 1)}
                        >
                            Sebelumnya
                        </button>

                        <span aria-live="polite">
                            {page} / {Math.max(1, requests.data.pagination.totalPages)}
                        </span>

                        <button
                            className="button button-outline"
                            disabled={
                                requests.isFetching ||
                                page >= requests.data.pagination.totalPages
                            }
                            onClick={() => setPage(value => value + 1)}
                        >
                            Berikutnya
                        </button>
                    </div>
                </div>
                </>
            )}
        </section>
    )
}
