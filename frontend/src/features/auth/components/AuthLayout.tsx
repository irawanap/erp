import type { ReactNode } from 'react'
import { CalendarDays, Check, ClipboardCheck, ShieldCheck, Users } from 'lucide-react'
import { Brand } from '@/components/common/Brand'

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-layout">
    <section className="auth-story" aria-label="Tentang EMP People">
      <Brand />
      <div className="story-content">
        <span className="eyebrow"><span className="tiny-dot" /> PEOPLE & OPERATIONS</span>
        <h1>Data rapi.<br />Tim lebih <span>terhubung.</span></h1>
        <p>Ruang kerja bersama untuk mengelola karyawan, cuti, dan persetujuan. Semua dalam satu alur yang jelas.</p>
        <div className="story-workflow">
          <div className="workflow-heading"><span>Workspace perusahaan</span><span className="live-label"><span className="tiny-dot" /> Terintegrasi</span></div>
          {[
            { Icon: Users, title: 'Data karyawan', subtitle: 'Profil dan organisasi dalam satu tempat' },
            { Icon: CalendarDays, title: 'Pengajuan cuti', subtitle: 'Saldo dan histori yang mudah ditelusuri' },
            { Icon: ClipboardCheck, title: 'Persetujuan tim', subtitle: 'Keputusan tepat, alur lebih singkat' },
          ].map(({ Icon, title, subtitle }, index) => <div className="workflow-row" key={title}>
            <span className="workflow-icon"><Icon size={20} strokeWidth={1.7} /></span>
            <div><strong>{title}</strong><span>{subtitle}</span></div>
            <span className="workflow-check"><Check size={14} /></span>
            {index < 2 && <span className="workflow-connector" />}
          </div>)}
        </div>
        <div className="story-caption"><span className="mini-avatars"><i>A</i><i>B</i><i>C</i></span><span>Dirancang untuk setiap peran di tim Anda.</span></div>
      </div>
      <div className="story-footer"><span>EMP People · HR workspace</span><span><ShieldCheck size={14} /> Akses sesuai peran</span></div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-form-container">{children}</div>
      <p className="auth-footer">© {new Date().getFullYear()} EMP People. Semua hak dilindungi.</p>
    </section>
  </main>
}
