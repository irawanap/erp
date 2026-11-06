import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, LoaderCircle, LogOut, Monitor, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/use-auth'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { messageOf, statusOf } from '@/lib/api'
import { Notice } from '@/components/common/Notice'
import { changePassword, getSessions, logoutAll, revokeSession } from './account.api'
import { SecurityDialog } from '@/components/common/SecurityDialog'

type Action = { kind: 'session'; id: string; current: boolean } | { kind: 'all' } | { kind: 'password' }
function dateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value)) + ' WIB'
}

export function AccountPage() {
  const auth = useAuth()
  const user = auth.user!
  const [action, setAction] = useState<Action | null>(null)
  const [success, setSuccess] = useState('')
  const sessions = useQuery({ queryKey: ['sessions', user.id], queryFn: getSessions, retry: false })

  async function confirm(proof: CredentialsProof, newPassword?: string) {
    if (!action) return
    if (action.kind === 'password') {
      await changePassword({ ...proof, newPassword: newPassword! })
      auth.clearSession('Password berhasil diubah. Silakan masuk kembali.')
      return
    }
    await reauthenticate(proof)
    if (action.kind === 'all') {
      await logoutAll(); auth.clearSession(); return
    }
    // Reauthentication rotates the current session; revoke that new current session if selected.
    if (action.current) {
      const updated = await getSessions()
      const current = updated.find((session) => session.is_current)
      if (current) await revokeSession(current.id)
      auth.clearSession()
      return
    }
    await revokeSession(action.id)
    setAction(null); setSuccess('Session berhasil dicabut.')
    await sessions.refetch()
  }

  return <>
    <div className="page-intro"><div><span className="section-label">PENGATURAN PRIBADI</span><h2>Akses Anda, dalam kendali Anda<span className="heading-dot">.</span></h2><p>Tinjau akun dan kelola session yang terhubung ke workspace.</p></div></div>
    {success && <Notice kind="success">{success}</Notice>}
    <div className="account-grid"><section className="panel profile-panel"><div className="panel-header"><div><h3>Informasi akun</h3><p>Identitas dan hak akses workspace.</p></div><ShieldCheck size={20} className="green-text" /></div>
      <dl className="profile-details"><div><dt>Email perusahaan</dt><dd>{user.email}</dd></div><div><dt>Peran</dt><dd><span className="role-pill">{user.role === 'HRD/Admin' ? 'HRD / Admin' : user.role}</span></dd></div><div><dt>Status akun</dt><dd><span className="active-inline"><span className="tiny-dot" /> Aktif</span></dd></div><div><dt>Profil karyawan</dt><dd>{user.employee_id ? 'Terhubung' : 'Belum dihubungkan oleh HRD'}</dd></div><div><dt>Login terakhir</dt><dd>{user.last_login_at ? dateTime(user.last_login_at) : '—'}</dd></div></dl>
      <div className="profile-bottom"><KeyRound size={19} /><div><strong>Jaga password tetap pribadi</strong><p>Gunakan passphrase panjang dan hindari pemakaian ulang.</p></div><button className="button button-outline" onClick={() => setAction({ kind: 'password' })}>Ubah password</button></div>
    </section>
      <section className="panel sessions-panel"><div className="panel-header"><div><h3>Session aktif</h3><p>Maksimal 5 session. Keluar otomatis setelah tidak aktif.</p></div><button className="icon-button" aria-label="Perbarui daftar session" onClick={() => sessions.refetch()} disabled={sessions.isFetching}><RefreshCw size={17} className={sessions.isFetching ? 'spin' : ''} /></button></div>
        {sessions.isPending ? <div className="table-state"><LoaderCircle className="spin" size={24} /><p>Memuat session…</p></div> : sessions.isError ? <div className="session-error"><Notice>{messageOf(sessions.error)}</Notice>{statusOf(sessions.error) === 401 && <button className="text-button" onClick={() => auth.refresh()}>Periksa session</button>}</div>
          : <div className="session-list">{sessions.data.map((session) => <div className="session-row" key={session.id}><span className="device-icon"><Monitor size={21} /></span><div className="session-description"><strong>{session.is_current ? 'Session ini' : 'Session workspace lain'}{session.is_current && <span className="current-badge">Saat ini</span>}</strong><p>Aktif terakhir {dateTime(session.last_seen_at)}</p><small>Berakhir {dateTime(session.expires_at)}</small></div><button className="icon-button danger-hover" title="Cabut session" aria-label={`Cabut ${session.is_current ? 'session ini' : 'session lain'}`} onClick={() => setAction({ kind: 'session', id: session.id, current: session.is_current })}><Trash2 size={17} /></button></div>)}</div>}
        <div className="sessions-bottom"><p>Pengakhiran session memerlukan verifikasi password dan MFA bila aktif.</p><button className="button button-outline" onClick={() => setAction({ kind: 'all' })}><LogOut size={16} /> Keluar dari semua session</button></div>
      </section></div>
    <div className="account-explainer"><ShieldCheck size={19} /><p>Cookie session bersifat pribadi dan tidak dapat dibaca JavaScript. Perubahan password akan mengakhiri seluruh session akun Anda.</p></div>
    {action && <SecurityDialog title={action.kind === 'password' ? 'Ubah password' : action.kind === 'all' ? 'Akhiri semua session?' : 'Cabut akses session?'}
      description={action.kind === 'password' ? 'Password baru minimal 15 karakter. Setelah perubahan berhasil, Anda perlu masuk kembali.' : 'Verifikasi identitas Anda sebelum mengakhiri akses. Session yang dicabut tidak bisa digunakan kembali.'}
      passwordChange={action.kind === 'password'} onConfirm={confirm} onClose={() => setAction(null)} />}
  </>
}
