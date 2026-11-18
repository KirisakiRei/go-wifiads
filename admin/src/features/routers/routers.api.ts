import { apiClient, jsonBody } from '@/lib/api-client'
import type { CreateRouterInput, RouterDevice, UpdateRouterVoucherConfigInput } from './types'

export const routersApi = {
  list: () => apiClient<RouterDevice[]>('/api/v1/admin/routers'),
  create: (input: CreateRouterInput) =>
    apiClient<RouterDevice>('/api/v1/admin/routers', {
      method: 'POST',
      ...jsonBody(input),
    }),
  updateVoucherConfig: (routerId: string, input: UpdateRouterVoucherConfigInput) =>
    apiClient<RouterDevice>(`/api/v1/admin/routers/${routerId}/voucher-config`, {
      method: 'PUT',
      ...jsonBody(input),
    }),
}
