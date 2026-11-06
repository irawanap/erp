import { lazy, Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Link, Route, Routes } from 'react-router-dom'
import { AppProviders } from './app/AppProviders'
import { ProtectedRoute } from './app/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './features/auth/pages/LoginPage'
const RegisterPage = lazy(() => import('./features/auth/pages/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const MfaSetupPage = lazy(() => import('./features/auth/pages/MfaSetupPage').then((module) => ({ default: module.MfaSetupPage })))
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const AccountPage = lazy(() => import('./features/account/AccountPage').then((module) => ({ default: module.AccountPage })))

function NotFound() {
  return <main className="not-found"><span className="section-label">404 · HALAMAN TIDAK DITEMUKAN</span><h1>Sepertinya Anda tersesat.</h1><p>Alamat ini belum tersedia di workspace.</p><Link className="button button-primary" to="/">Kembali ke workspace</Link></main>
}

export default function App() {
  return <AppProviders><Suspense fallback={<div className="page-loading"><LoaderCircle className="spin" size={24} /><span>Memuat halaman…</span></div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/auth/mfa" element={<MfaSetupPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route index element={<DashboardPage />} />
      <Route path="account" element={<AccountPage />} />
    </Route></Route>
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></AppProviders>
}
