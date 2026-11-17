import { apiClient } from '@/lib/api-client'
import type { Overview } from '@/features/dashboard/types/overview.types'
export const overviewApi = { get: () => apiClient<Overview>('/api/v1/admin/overview') }
