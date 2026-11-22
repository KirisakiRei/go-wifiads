import { apiClient, apiRequest } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'

export interface AuditLogItem {
  id: string
  actor_id: string
  actor_name: string
  action: string
  entity_type: string
  entity_id: string
  detail: string
  ip_address?: string
  created_at: string
}

export interface AuditLogQuery {
  page: number
  per_page: number
  search?: string
  action?: string
  entity_type?: string
  actor_name?: string
  date_from?: string
  date_to?: string
}

export interface AuditLogFilters {
  actions: string[]
  entity_types: string[]
}

export const auditLogsApi = {
  list: (q: AuditLogQuery) =>
    apiRequest<AuditLogItem[]>(`/api/v1/admin/audit-logs${toSearchParams(q)}`),
  filters: () => apiClient<AuditLogFilters>('/api/v1/admin/audit-logs/filters'),
  cleanup: (days = 90) =>
    apiClient<{ days: number; deleted: number }>(`/api/v1/admin/audit-logs/cleanup?days=${days}`, {
      method: 'DELETE',
    }),
}
