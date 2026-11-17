import { useQuery } from '@tanstack/react-query'
import { overviewApi } from '@/features/dashboard/api/overview.api'

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: overviewApi.get,
    refetchInterval: 60_000,
  })
}
