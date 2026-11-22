import { apiClient, apiRequest, jsonBody } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'
import type { BlockDeviceInput, BlockedDevice, Visitor } from '@/features/visitors/types/visitor.types'

export const visitorsApi = {
  list: (query: ListQuery) => apiRequest<Visitor[]>(`/api/v1/admin/visitors${toSearchParams(query)}`),
  listBlocked: (query: ListQuery) =>
    apiRequest<BlockedDevice[]>(`/api/v1/admin/blocked-devices${toSearchParams(query)}`),
  block: (mac: string, input: BlockDeviceInput) =>
    apiClient<BlockedDevice>(`/api/v1/admin/visitors/${encodeURIComponent(mac)}/block`, {
      method: 'POST',
      ...jsonBody(input),
    }),
  unblock: (mac: string) =>
    apiClient<null>(`/api/v1/admin/visitors/${encodeURIComponent(mac)}/block`, {
      method: 'DELETE',
    }),
}
