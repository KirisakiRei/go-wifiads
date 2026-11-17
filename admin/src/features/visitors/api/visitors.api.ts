import { apiRequest } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'
import type { Visitor } from '@/features/visitors/types/visitor.types'

export const visitorsApi = {
  list: (query: ListQuery) => apiRequest<Visitor[]>(`/api/v1/admin/visitors${toSearchParams(query)}`),
}
