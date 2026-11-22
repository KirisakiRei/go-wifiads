import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { routersApi } from './routers.api'

export const routersQueryKey = ['routers'] as const

export function useRouters() {
  return useQuery({
    queryKey: routersQueryKey,
    queryFn: routersApi.list,
  })
}

export function useDeleteRouter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (routerId: string) => routersApi.delete(routerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routersQueryKey })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
