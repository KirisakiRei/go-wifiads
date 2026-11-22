import { apiClient, jsonBody } from '@/lib/api-client'

export interface SystemSettingItem {
  key: string
  value: string
  group: string
  description: string
  updated_at?: string
}

export const settingsApi = {
  list: () => apiClient<SystemSettingItem[]>('/api/v1/admin/settings'),
  bulkUpdate: (settings: Record<string, string>) =>
    apiClient<SystemSettingItem[]>('/api/v1/admin/settings', {
      method: 'PUT',
      ...jsonBody({ settings }),
    }),
}
