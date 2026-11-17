import { useQuery } from '@tanstack/react-query'
import { profilesApi } from '@/features/profiles/api/profiles.api'

export const profilesQueryKey = ['profiles'] as const

export function useProfiles() {
  return useQuery({
    queryKey: profilesQueryKey,
    queryFn: profilesApi.list,
  })
}
