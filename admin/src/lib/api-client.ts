import { env } from '@/config/env'
import type { ApiResponse, PaginationMeta } from '@/types/api'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type ApiResult<T> = { data: T; meta?: PaginationMeta }

let refreshInFlight: Promise<boolean> | null = null

async function tryRefreshAdminSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = fetch(`${env.apiBaseUrl}/api/v1/admin/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

function isRefreshableAdminPath(path: string): boolean {
  return (
    path.startsWith('/api/v1/admin/') &&
    !path.startsWith('/api/v1/admin/auth/login') &&
    !path.startsWith('/api/v1/admin/auth/logout') &&
    !path.startsWith('/api/v1/admin/auth/refresh')
  )
}

export async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const result = await apiRequest<T>(path, init)
  return result.data
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retried = false
): Promise<ApiResult<T>> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
  })

  if (response.status === 401 && !retried && isRefreshableAdminPath(path)) {
    const refreshed = await tryRefreshAdminSession()
    if (refreshed) {
      return apiRequest<T>(path, init, true)
    }
  }

  if (response.status === 204) {
    return { data: undefined as T }
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error,
      payload?.details
    )
  }
  return { data: payload.data as T, meta: payload.meta }
}

export function jsonBody(data: unknown): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
}
