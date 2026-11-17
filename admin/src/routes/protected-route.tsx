import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/features/auth/hooks/use-current-user'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation()
  const { data: user, isPending } = useCurrentUser()
  if (isPending) return <div className="page-state">Memverifikasi sesi…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}
