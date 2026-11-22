import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListQuery } from '@/types/common'
import { sessionsApi } from '@/features/sessions/api/sessions.api'

export function useSessions(query: ListQuery) {
  return useQuery({
    queryKey: ['sessions', query],
    queryFn: () => sessionsApi.list(query),
    refetchInterval: 30_000,
  })
}

export function useDisconnectSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => sessionsApi.disconnect(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['routers'] })
      qc.invalidateQueries({ queryKey: ['visitors'] })
    },
  })
}
