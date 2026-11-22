import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListQuery } from '@/types/common'
import { vouchersApi } from '@/features/vouchers/api/vouchers.api'
import type { CreateVoucherBatchInput } from '@/features/vouchers/types/voucher.types'

export function useVouchers(q: ListQuery) {
  return useQuery({
    queryKey: ['vouchers', q],
    queryFn: () => vouchersApi.list(q),
  })
}

export function useVoucherSummary() {
  return useQuery({
    queryKey: ['vouchers-summary'],
    queryFn: vouchersApi.summary,
  })
}

export function useRevokeVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vouchersApi.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      qc.invalidateQueries({ queryKey: ['vouchers-summary'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export function useCreateVoucherBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVoucherBatchInput) => vouchersApi.createBatch(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      qc.invalidateQueries({ queryKey: ['vouchers-summary'] })
    },
  })
}
