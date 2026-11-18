import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { LoadingState } from '@/components/feedback/query-state'
import { advertiserApi } from '@/features/marketplace/marketplace.api'

export const advertiserAuthQueryKey = ['advertiser-me'] as const

export function useCurrentAdvertiser() {
  return useQuery({
    queryKey: advertiserAuthQueryKey,
    queryFn: advertiserApi.me,
    retry: false,
    staleTime: 60_000,
  })
}

export function AdvertiserProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isPending, isError } = useCurrentAdvertiser()
  const location = useLocation()

  if (isPending) return <LoadingState message="Memuat akun pengiklan..." />
  if (isError || !data) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

export function AdvertiserPublicOnlyRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = useCurrentAdvertiser()
  if (isPending) return <LoadingState message="Memeriksa sesi..." />
  if (data) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
