import { useQuery } from '@tanstack/react-query'
import type { ListQuery } from '@/types/common'
import { visitorsApi } from '@/features/visitors/api/visitors.api'

export function useVisitors(query: ListQuery) {
  return useQuery({
    queryKey: ['visitors', query],
    queryFn: () => visitorsApi.list(query),
  })
}
