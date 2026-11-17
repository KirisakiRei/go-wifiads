import { env } from '@/config/env'
import { apiClient, jsonBody } from '@/lib/api-client'
import type { Advertisement, CreateAdvertisementPayload, UpdateAdvertisementPayload } from '@/features/advertisements/types/advertisement.types'

export const advertisementsApi = {
  list: () => apiClient<Advertisement[]>('/api/v1/admin/advertisements'),
  get: (id: string) => apiClient<Advertisement>(`/api/v1/admin/advertisements/${id}`),
  create: (data: CreateAdvertisementPayload) =>
    apiClient<Advertisement>('/api/v1/admin/advertisements', { ...jsonBody(data), method: 'POST' }),
  update: ({ id, data }: { id: string; data: UpdateAdvertisementPayload }) =>
    apiClient<Advertisement>(`/api/v1/admin/advertisements/${id}`, { ...jsonBody(data), method: 'PUT' }),
  delete: (id: string) =>
    apiClient<void>(`/api/v1/admin/advertisements/${id}`, { method: 'DELETE' }),
  uploadImage: async (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch(`${env.apiBaseUrl}/api/v1/admin/advertisements/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { url: string; filename: string } } | null
    if (!response.ok || !payload?.success || !payload.data) {
      throw new Error(payload?.message || 'Gagal mengunggah gambar')
    }
    return payload.data
  },
}
