import { env } from '@/config/env'
import { apiClient, jsonBody } from '@/lib/api-client'
import type { Advertisement, CreateAdvertisementPayload, UpdateAdvertisementPayload } from '@/features/advertisements/types/advertisement.types'

export interface UploadProgressInfo {
  loaded: number
  total: number
  percent: number
}

export interface UploadMediaResult {
  url: string
  r2_url?: string
  filename: string
  media_type?: 'image' | 'video'
}

export const advertisementsApi = {
  list: () => apiClient<Advertisement[]>('/api/v1/admin/advertisements'),
  get: (id: string) => apiClient<Advertisement>(`/api/v1/admin/advertisements/${id}`),
  create: (data: CreateAdvertisementPayload) =>
    apiClient<Advertisement>('/api/v1/admin/advertisements', { ...jsonBody(data), method: 'POST' }),
  update: ({ id, data }: { id: string; data: UpdateAdvertisementPayload }) =>
    apiClient<Advertisement>(`/api/v1/admin/advertisements/${id}`, { ...jsonBody(data), method: 'PUT' }),
  delete: (id: string) =>
    apiClient<void>(`/api/v1/admin/advertisements/${id}`, { method: 'DELETE' }),
  uploadImage: (
    file: File,
    onProgress?: (info: UploadProgressInfo) => void,
    options?: { trimStart?: number; trimEnd?: number }
  ): Promise<UploadMediaResult> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('image', file)
      if (options && typeof options.trimEnd === 'number' && options.trimEnd > (options.trimStart ?? 0) + 0.5) {
        formData.append('trim_start', String(Math.max(0, options.trimStart ?? 0)))
        formData.append('trim_end', String(options.trimEnd))
      }

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${env.apiBaseUrl}/api/v1/admin/advertisements/upload`, true)
      xhr.withCredentials = true

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent,
          })
        }
      }

      xhr.onload = () => {
        let payload: {
          success?: boolean
          message?: string
          data?: UploadMediaResult
        } | null = null
        try {
          payload = JSON.parse(xhr.responseText)
        } catch {
          payload = null
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload?.success && payload.data) {
          resolve(payload.data)
        } else {
          reject(new Error(payload?.message || `Gagal mengunggah berkas (HTTP ${xhr.status})`))
        }
      }

      xhr.onerror = () => {
        reject(new Error('Koneksi terputus saat mengunggah berkas media'))
      }

      xhr.send(formData)
    })
  },
}
