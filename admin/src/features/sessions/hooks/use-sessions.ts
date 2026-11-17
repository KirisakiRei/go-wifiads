import { useQuery } from '@tanstack/react-query'
import type { ListQuery } from '@/types/common'
import { sessionsApi } from '@/features/sessions/api/sessions.api'

export function useSessions(query: ListQuery) {
  return useQuery({
    queryKey: ['sessions', query],
    queryFn: () => sessionsApi.list(query),
    refetchInterval: 60_000,
  })
}
