import { apiClient, apiRequest } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'
import type { DisconnectSessionResult, RadiusSession } from '@/features/sessions/types/session.types'

export const sessionsApi = {
  list: (query: ListQuery) => apiRequest<RadiusSession[]>(`/api/v1/admin/sessions${toSearchParams(query)}`),
  disconnect: (sessionId: string) =>
    apiClient<DisconnectSessionResult>(`/api/v1/admin/sessions/${sessionId}/disconnect`, {
      method: 'POST',
    }),
}
