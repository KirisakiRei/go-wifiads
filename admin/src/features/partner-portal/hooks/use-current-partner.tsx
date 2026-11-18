import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingState } from '@/components/feedback/query-state'
import { partnerApi } from '@/features/marketplace/marketplace.api'

export const partnerAuthQueryKey = ['partner-me'] as const

export function useCurrentPartner() {
  return useQuery({
    queryKey: partnerAuthQueryKey,
    queryFn: partnerApi.me,
    retry: false,
    staleTime: 60_000,
  })
}

export function PartnerProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isPending, isError } = useCurrentPartner()
  if (isPending) return <LoadingState />
  if (isError || !data) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function PartnerPublicOnlyRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = useCurrentPartner()
  if (isPending) return <LoadingState />
  if (data) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
