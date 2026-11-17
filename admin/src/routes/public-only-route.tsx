import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '@/features/auth/hooks/use-current-user'

export function PublicOnlyRoute({ children }: PropsWithChildren) {
  const { data: user, isPending } = useCurrentUser()
  if (isPending) return <div className="page-state">Memuat…</div>
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
