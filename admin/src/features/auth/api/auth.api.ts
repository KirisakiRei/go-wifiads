import { apiClient, jsonBody } from '@/lib/api-client'
import type { AdminUser, LoginInput, LoginResponse } from '@/features/auth/types/auth.types'

export const authApi = {
  login: (input: LoginInput) => apiClient<LoginResponse>('/api/v1/admin/auth/login', { method: 'POST', ...jsonBody(input) }),
  currentUser: () => apiClient<AdminUser>('/api/v1/admin/auth/me'),
  logout: () => apiClient<void>('/api/v1/admin/auth/logout', { method: 'POST' }),
  changeOwnPassword: (password: string) =>
    apiClient<void>('/api/v1/admin/auth/password', { method: 'PUT', ...jsonBody({ password }) }),
}
