import { apiRequest } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'
import type { RadiusSession } from '@/features/sessions/types/session.types'

export const sessionsApi = {
  list: (query: ListQuery) => apiRequest<RadiusSession[]>(`/api/v1/admin/sessions${toSearchParams(query)}`),
}
