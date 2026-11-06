import { useState } from 'react'
import { ApprovalPanel } from '@/features/approvals/components/ApprovalPanel'
import { Link, useParams } from 'react-router-dom'
import { Notice } from '@/components/common/Notice'
import { useAuth } from '@/features/auth/use-auth'
import { messageOf, statusOf } from '@/lib/api'
import { LeaveRequestForm } from '../components/LeaveRequestForm'
import {
  useLeaveRequest,
  useRequestTypes,
  useSaveLeaveRequest,
} from '../leave-request.queries'
import {
  formatLeaveDate,
  leaveRequestStatusLabels,
} from '../leave-request.constants'
import type { LeaveRequestInput } from '../leave-request.types'

export function LeaveRequestDetailPage() {
  const { id } = useParams()
  const auth = useAuth()

  const request = useLeaveRequest(id)
  const types = useRequestTypes()
  const mutation = useSaveLeaveRequest()

  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleError(cause: unknown) {
    setError(messageOf(cause))

    if (statusOf(cause) === 401) {
      await auth.refresh()
    }
  }

  async function updateDraft(input: LeaveRequestInput) {
    if (!id) return

    setError('')
    setSuccess('')

    try {
      await mutation.mutateAsync({ kind: 'update', id, input })
      setEditing(false)
      setSuccess('Draft berhasil diperbarui.')
    } catch (cause) {
      await handleError(cause)
    }
  }

  async function transition(kind: 'submit' | 'cancel') {
    if (!id) return

    const confirmed = window.confirm(
      kind === 'submit'
        ? 'Kirim pengajuan ini kepada atasan? Draft tidak dapat diedit setelah dikirim.'
        : 'Batalkan pengajuan ini? Pengajuan yang dibatalkan tidak dapat dikirim ulang.',
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      await mutation.mutateAsync({ kind, id })
      setSuccess(
        kind === 'submit'
          ? 'Pengajuan berhasil dikirim.'
          : 'Pengajuan berhasil dibatalkan.',
      )
    } catch (cause) {
      await handleError(cause)
    }
  }

  if (request.isPending) {
    return <p role="status">Memuat detail pengajuan…</p>
  }

  if (request.isError) {
    return (
      <section className="panel">
        <div className="table-state">
          <Notice>{messageOf(request.error)}</Notice>

          <button
            className="button button-outline"
            onClick={() => request.refetch()}
          >
            Coba kembali
          </button>

          {statusOf(request.error) === 401 && (
            <button
              className="button button-outline"
              onClick={() => auth.refresh()}
            >
              Periksa session
            </button>
          )}

          <Link to="/leave-requests">Kembali ke daftar</Link>
        </div>
      </section>
    )
  }

  const data = request.data
  const own = auth.user?.employee_id === data.employee_id
  const canEdit = own && data.status === 'Draft'
  const showEditor = editing && canEdit
  const canCancel = own && ['Draft', 'Submitted'].includes(data.status)

  const details = [
    ['Nomor pengajuan', data.request_no],
    ['Karyawan', data.full_name],
    ['Departemen', data.department_name],
    ['Jenis cuti', data.leave_type_name],
    ['Tanggal mulai', formatLeaveDate(data.start_date)],
    ['Tanggal selesai', formatLeaveDate(data.end_date)],
    ['Durasi hari kerja', `${data.total_days} hari`],
    ['Status', leaveRequestStatusLabels[data.status]],
    ['Atasan', data.approver_name ?? 'Belum ditetapkan saat submit'],
  ]

  const formTypes = types.data ?? []
  const hasCurrentType = formTypes.some(type => type.id === data.leave_type_id)

  return (
    <section className="panel leave-requests-page">
      <div className="panel-header">
        <h2>Detail pengajuan</h2>

        <Link className="button button-outline" to="/leave-requests">
          Kembali
        </Link>
      </div>

      {success && <Notice kind="success">{success}</Notice>}
      {error && !showEditor && <Notice>{error}</Notice>}

      <dl className="request-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}

        <div className="request-wide">
          <dt>Alasan</dt>
          <dd className="request-text">{data.reason}</dd>
        </div>
      </dl>

      {!showEditor && (
        <div className="request-detail-actions">
          {canEdit && (
            <>
              <button
                className="button button-edit"
                disabled={mutation.isPending}
                onClick={() => {
                  setError('')
                  setSuccess('')
                  setEditing(true)
                }}
              >
                Edit draft
              </button>

              <button
                className="button button-primary"
                disabled={mutation.isPending}
                onClick={() => transition('submit')}
              >
                Submit pengajuan
              </button>
            </>
          )}

          {canCancel && (
            <button
              className="button button-danger-soft"
              disabled={mutation.isPending}
              onClick={() => transition('cancel')}
            >
              Batalkan pengajuan
            </button>
          )}

          <button
            className="button button-outline"
            disabled={request.isFetching || mutation.isPending}
            onClick={() => request.refetch()}
          >
            Perbarui detail
          </button>
        </div>
      )}

      {showEditor && (
        <section className="request-editor" aria-label="Edit draft">
          <div className="panel-header">
            <h3>Edit draft</h3>
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
                onClick={() => setEditing(false)}
              >
                Batal
              </button>
            </div>
          ) : (
            <>
              {!hasCurrentType && (
                <Notice kind="info">
                  Jenis cuti sebelumnya sudah tidak aktif.
                  Pilih jenis cuti aktif untuk menyimpan draft.
                </Notice>
              )}

              <LeaveRequestForm
                key={data.id}
                types={formTypes}
                initialValues={{
                  leaveTypeId: hasCurrentType ? data.leave_type_id : '',
                  startDate: data.start_date,
                  endDate: data.end_date,
                  reason: data.reason,
                }}
                pending={mutation.isPending}
                error={error}
                onSubmit={updateDraft}
                onCancel={() => setEditing(false)}
              />
            </>
          )}
        </section>
      )}

      <ApprovalPanel key={data.id} request={data} />

      <section className="request-section">
        <h3>Tanggal kerja yang dihitung</h3>

        {data.working_dates.length ? (
          <ul className="request-working-dates">
            {data.working_dates.map(date => (
              <li key={date}>{formatLeaveDate(date)}</li>
            ))}
          </ul>
        ) : (
          <p>Belum ada tanggal kerja tersimpan.</p>
        )}
      </section>

      <section className="request-section">
        <h3>Riwayat keputusan</h3>

        {data.approvals.length === 0 ? (
          <p>Belum ada keputusan atasan.</p>
        ) : (
          data.approvals.map(approval => (
            <article className="request-approval" key={approval.id}>
              <strong>
                {leaveRequestStatusLabels[approval.decision]}
                {' — '}
                {approval.approver_name}
              </strong>

              <p className="request-text">{approval.comment}</p>

              <small>
                {new Intl.DateTimeFormat('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Jakarta',
                }).format(new Date(approval.decided_at))}
                {' WIB'}
              </small>
            </article>
          ))
        )}
      </section>
    </section>
  )
}
