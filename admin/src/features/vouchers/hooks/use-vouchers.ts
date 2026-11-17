import { useQuery } from '@tanstack/react-query'
import type { ListQuery } from '@/types/common'
import { vouchersApi } from '@/features/vouchers/api/vouchers.api'

export function useVouchers(q: ListQuery) {
  return useQuery({
    queryKey: ['vouchers', q],
    queryFn: () => vouchersApi.list(q),
  })
}
