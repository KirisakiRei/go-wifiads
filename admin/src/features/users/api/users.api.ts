import { apiClient, jsonBody } from '@/lib/api-client'
import type { AdminUser, ChangePasswordPayload, CreateUserPayload, UpdateUserPayload } from '@/features/users/types/user.types'

export const usersApi = {
  list: () => apiClient<AdminUser[]>('/api/v1/admin/users'),
  get: (id: string) => apiClient<AdminUser>(`/api/v1/admin/users/${id}`),
  create: (data: CreateUserPayload) =>
    apiClient<AdminUser>('/api/v1/admin/users', { ...jsonBody(data), method: 'POST' }),
  update: ({ id, data }: { id: string; data: UpdateUserPayload }) =>
    apiClient<AdminUser>(`/api/v1/admin/users/${id}`, { ...jsonBody(data), method: 'PUT' }),
  changePassword: ({ id, data }: { id: string; data: ChangePasswordPayload }) =>
    apiClient<void>(`/api/v1/admin/users/${id}/password`, { ...jsonBody(data), method: 'PUT' }),
  delete: (id: string) =>
    apiClient<void>(`/api/v1/admin/users/${id}`, { method: 'DELETE' }),
}
