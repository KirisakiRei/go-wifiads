import { useQuery } from '@tanstack/react-query'
import { advertisementsApi } from '@/features/advertisements/api/advertisements.api'

export const advertisementsQueryKey = ['advertisements'] as const

export function useAdvertisements() {
  return useQuery({
    queryKey: advertisementsQueryKey,
    queryFn: advertisementsApi.list,
  })
}
