import { apiClient, apiRequest, jsonBody } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'
import type { CreatedVoucher, CreateVoucherInput, Voucher } from '@/features/vouchers/types/voucher.types'

export const vouchersApi = {
  list: (q: ListQuery) => apiRequest<Voucher[]>(`/api/v1/admin/vouchers${toSearchParams(q)}`),
  create: (input: CreateVoucherInput) =>
    apiClient<CreatedVoucher>('/api/v1/admin/vouchers', { method: 'POST', ...jsonBody(input) }),
}
