import { apiClient, apiRequest, jsonBody } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'
import type {
  CreatedVoucher,
  CreateVoucherBatchInput,
  CreateVoucherInput,
  Voucher,
  VoucherBatch,
  VoucherBatchCreatedResult,
  VoucherSummary,
} from '@/features/vouchers/types/voucher.types'

export const vouchersApi = {
  list: (q: ListQuery) => apiRequest<Voucher[]>(`/api/v1/admin/vouchers${toSearchParams(q)}`),
  summary: () => apiClient<VoucherSummary>('/api/v1/admin/vouchers/summary'),
  create: (input: CreateVoucherInput) =>
    apiClient<CreatedVoucher>('/api/v1/admin/vouchers', { method: 'POST', ...jsonBody(input) }),
  revoke: (id: string) =>
    apiClient<Voucher>(`/api/v1/admin/vouchers/${id}/revoke`, { method: 'PUT' }),
  createBatch: (input: CreateVoucherBatchInput) =>
    apiClient<VoucherBatchCreatedResult>('/api/v1/admin/vouchers/batch', {
      method: 'POST',
      ...jsonBody(input),
    }),
  listBatches: (q: ListQuery) =>
    apiRequest<VoucherBatch[]>(`/api/v1/admin/vouchers/batches${toSearchParams(q)}`),
}
