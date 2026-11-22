import type { ListQuery } from '@/types/common'

export function listQuery(search: URLSearchParams): ListQuery {
  const page = Number(search.get('page'))
  const perPage = Number(search.get('per_page'))
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    per_page: Number.isInteger(perPage) && perPage > 0 && perPage <= 100 ? perPage : 20,
    search: search.get('search') || undefined,
    status: search.get('status') || undefined,
    router_id: search.get('router_id') || undefined,
  }
}

export function toSearchParams(query: object): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '' && value !== 1) params.set(key, String(value)) })
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export function formSearchParams(form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams()
  new FormData(form).forEach((value, key) => { if (typeof value === 'string' && value) params.set(key, value) })
  return params
}
