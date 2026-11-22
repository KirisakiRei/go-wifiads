import { apiClient, jsonBody } from '@/lib/api-client'
import type { ConnectProfile, CreateProfilePayload, UpdateProfilePayload } from '@/features/profiles/types/profile.types'

export const profilesApi = {
  list: () => apiClient<ConnectProfile[]>('/api/v1/admin/profiles'),
  get: (id: string) => apiClient<ConnectProfile>(`/api/v1/admin/profiles/${id}`),
  create: (data: CreateProfilePayload) =>
    apiClient<ConnectProfile>('/api/v1/admin/profiles', { ...jsonBody(data), method: 'POST' }),
  update: ({ id, data }: { id: string; data: UpdateProfilePayload }) =>
    apiClient<ConnectProfile>(`/api/v1/admin/profiles/${id}`, { ...jsonBody(data), method: 'PUT' }),
  delete: (id: string) =>
    apiClient<null>(`/api/v1/admin/profiles/${id}`, { method: 'DELETE' }),
}
