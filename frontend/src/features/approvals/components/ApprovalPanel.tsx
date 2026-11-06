import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import type { LeaveRequestDetail } from '@/features/leave-requests/leave-request.types'
import type { ApprovalInput } from '../approval.api'
import { approvalSchema } from '../approval.validation'
import { useDecideLeaveRequest } from '../approval.queries'

export function ApprovalPanel({ request }: { request: LeaveRequestDetail }) {
  const auth = useAuth()
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [action, setAction] = useState<ApprovalInput | null>(null)
  const mutation = useDecideLeaveRequest()
  const canDecide = auth.user?.role === 'Supervisor' && !!auth.user.employee_id
    && request.approver_id === auth.user.employee_id
    && request.employee_id !== auth.user.employee_id && request.status === 'Submitted'

  function choose(decision: ApprovalInput['decision']) {
    const result = approvalSchema.safeParse({ comment })
    setError(''); setSuccess('')
    if (!result.success) { setError(result.error.issues[0].message); return }
    setAction({ id: request.id, decision, comment: result.data.comment })
  }

  async function confirm(proof: CredentialsProof) {
    if (!action) return
    await reauthenticate(proof)
    const input = action
    setAction(null)
    try {
      await mutation.mutateAsync(input)
      setComment('')
      setSuccess(input.decision === 'approve' ? 'Pengajuan berhasil disetujui.' : 'Pengajuan berhasil ditolak.')
    } catch (cause) {
      setError(messageOf(cause))
      if (statusOf(cause) === 401) await auth.refresh()
    }
  }

  if (auth.user?.role !== 'Supervisor') return null

  return <section className="request-section approval-panel" aria-label="Keputusan supervisor">
    <h3>Keputusan supervisor</h3>
    {success && <Notice kind="success">{success}</Notice>}
    {error && <Notice>{error}</Notice>}
    {canDecide ? <>
      <div className="form-field"><label htmlFor="approval-comment">Komentar keputusan</label><textarea id="approval-comment" className="text-input request-reason" rows={4} maxLength={2000} disabled={mutation.isPending || !!action} value={comment} onChange={event => setComment(event.target.value)} aria-describedby="approval-help" /></div>
      <p id="approval-help" className="field-hint">Komentar wajib untuk persetujuan maupun penolakan. Persetujuan akan memotong saldo jika jenis cuti menggunakan saldo.</p>
      <div className="approval-actions"><button className="button button-primary" disabled={mutation.isPending || !!action} onClick={() => choose('approve')}>Setujui pengajuan</button><button className="button button-danger-soft" disabled={mutation.isPending || !!action} onClick={() => choose('reject')}>Tolak pengajuan</button></div>
    </> : <p>Pengajuan ini sudah diproses atau tidak ditugaskan kepada Anda.</p>}
    {action && <SecurityDialog title={action.decision === 'approve' ? 'Setujui pengajuan cuti?' : 'Tolak pengajuan cuti?'} description={`${request.full_name} — ${request.leave_type_name}, ${request.total_days} hari. Verifikasi identitas untuk menyimpan keputusan.`} passwordChange={false} onConfirm={confirm} onClose={() => setAction(null)} />}
    <Link className="text-button" to="/approvals">Kembali ke persetujuan tim</Link>
  </section>
}
