import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/use-auth'

export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <div className="page-loading"><LoaderCircle className="spin" size={25} /><span>Menyiapkan workspace Anda…</span></div>
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
