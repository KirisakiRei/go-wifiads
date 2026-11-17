import { useQuery } from '@tanstack/react-query'
import { routersApi } from './routers.api'

export const routersQueryKey = ['routers'] as const

export function useRouters() {
  return useQuery({
    queryKey: routersQueryKey,
    queryFn: routersApi.list,
  })
}
