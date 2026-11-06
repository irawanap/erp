import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, CalendarDays, ChevronDown, ClipboardCheck, FileText, LayoutDashboard, LogOut, Menu, PanelLeftClose, Settings, ShieldCheck, Users, X } from 'lucide-react'
import { Brand } from '@/components/common/Brand'
import { useAuth } from '@/features/auth/use-auth'
import { logout } from '@/features/auth/auth.api'
import { messageOf } from '@/lib/api'

function initials(email: string) {
  return email.split('@')[0].split(/[._-]/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function AppShell() {
  const auth = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const user = auth.user!
  const accountPage = location.pathname === '/account'
  const futureMenus = [
    { Icon: Users, label: user.role === 'HRD/Admin' ? 'Data karyawan' : user.role === 'Supervisor' ? 'Anggota tim' : 'Profil karyawan' },
    { Icon: CalendarDays, label: 'Pengajuan cuti' },
    ...(user.role === 'Supervisor' ? [{ Icon: ClipboardCheck, label: 'Persetujuan tim' }] : []),
    ...(user.role === 'HRD/Admin' ? [{ Icon: Building2, label: 'Master data' }, { Icon: FileText, label: 'Laporan' }] : []),
  ]

  async function signOut() {
    setSigningOut(true); setError('')
    try { await logout(); auth.clearSession() }
    catch (cause) { setError(messageOf(cause)) }
    finally { setSigningOut(false) }
  }

  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
    <aside id="main-sidebar" className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Navigasi utama">
      <div className="sidebar-brand"><Link to="/" aria-label="EMP People — Ringkasan" onClick={() => setMobileOpen(false)}><Brand compact={collapsed && !mobileOpen} /></Link>
        <button className="sidebar-collapse icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Perluas sidebar' : 'Ringkas sidebar'}><PanelLeftClose size={18} /></button>
        <button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Tutup navigasi"><X size={20} /></button>
      </div>
      <div className="workspace-selector"><span className="workspace-initial">E</span><div><strong>EMP Company</strong><span>HR workspace</span></div><span className="workspace-tag">HR</span></div>
      <nav className="sidebar-nav">
        <span className="nav-section-label">WORKSPACE</span>
        <NavLink to="/" aria-label="Ringkasan" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><LayoutDashboard size={19} /><span>Ringkasan</span><span className="nav-active-dot" /></NavLink>
        {futureMenus.map(({ Icon, label }) => <button className="nav-item nav-future" disabled key={label} title="Halaman ini akan tersedia pada tahap pengembangan berikutnya"><Icon size={19} /><span>{label}</span><small>Segera</small></button>)}
        <span className="nav-section-label second-section">PREFERENSI</span>
        <NavLink to="/account" aria-label="Akun & session" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><Settings size={19} /><span>Akun & session</span><span className="nav-active-dot" /></NavLink>
      </nav>
      <div className="sidebar-bottom"><div className="role-note"><ShieldCheck size={18} /><div><strong>Akses sesuai peran</strong><span>{user.role === 'HRD/Admin' ? 'HRD / Admin' : user.role}</span></div></div>
        <button className="nav-item signout-button" onClick={signOut} disabled={signingOut}><LogOut size={18} /><span>{signingOut ? 'Mengakhiri session…' : 'Keluar dari akun'}</span></button>
      </div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><div className="topbar-title"><button className="mobile-menu icon-button" aria-label="Buka navigasi" aria-expanded={mobileOpen} aria-controls="main-sidebar" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div><span className="breadcrumb">Workspace <span>/</span> {accountPage ? 'Pengaturan' : 'Overview'}</span><h1>{accountPage ? 'Akun & session' : 'Ringkasan workspace'}</h1></div></div>
        <div className="topbar-actions"><span className="workspace-live"><span className="tiny-dot" /> Workspace aktif</span><span className="topbar-divider" />
          <div className="user-menu" onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false) }}><button className="user-menu-trigger" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">{initials(user.email)}</span><span className="user-menu-text"><strong>{user.email.split('@')[0]}</strong><small>{user.role === 'HRD/Admin' ? 'HRD / Admin' : user.role}</small></span><ChevronDown size={16} /></button>
            {menuOpen && <><button className="menu-dismiss" aria-label="Tutup menu akun" onClick={() => setMenuOpen(false)} /><div className="user-dropdown"><p>{user.email}</p><Link to="/account" onClick={() => setMenuOpen(false)}><Settings size={16} /> Pengaturan akun</Link><button onClick={signOut} disabled={signingOut}><LogOut size={16} /> Keluar</button></div></>}
          </div>
        </div>
      </header>
      {error && <div className="shell-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Tutup pesan"><X size={16} /></button></div>}
      <main className="workspace-content"><Outlet /></main>
      <footer className="workspace-footer"><span>EMP People · HR workspace</span><span>Data dan akses mengikuti peran akun Anda.</span></footer>
    </div>
  </div>
}
