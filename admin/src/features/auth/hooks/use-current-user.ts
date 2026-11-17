import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/auth.api'

export const authQueryKey = ['auth', 'current-user'] as const

export function useCurrentUser() {
  return useQuery({ queryKey: authQueryKey, queryFn: authApi.currentUser, retry: false, staleTime: 5 * 60_000 })
}
