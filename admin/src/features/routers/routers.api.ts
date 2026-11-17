import { apiClient, jsonBody } from '@/lib/api-client'
import type { RouterDevice, UpdateRouterVoucherConfigInput } from './types'

export const routersApi = {
  list: () => apiClient<RouterDevice[]>('/api/v1/admin/routers'),
  updateVoucherConfig: (routerId: string, input: UpdateRouterVoucherConfigInput) =>
    apiClient<RouterDevice>(`/api/v1/admin/routers/${routerId}/voucher-config`, {
      method: 'PUT',
      ...jsonBody(input),
    }),
}
