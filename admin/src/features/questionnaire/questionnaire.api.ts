import { apiClient, apiRequest, jsonBody } from '@/lib/api-client'
import { toSearchParams } from '@/lib/query-params'
import type { ListQuery } from '@/types/common'

export type FieldType = 'TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER' | 'SELECT' | 'TEXTAREA'

export interface QuestionnaireField {
  id: string
  key: string
  label: string
  type: FieldType
  options: string[]
  placeholder: string
  required: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UpsertFieldInput {
  key: string
  label: string
  type: FieldType
  options?: string[]
  placeholder?: string
  required: boolean
  sort_order: number
  is_active: boolean
}

export interface QuestionnaireSubmission {
  id: string
  portal_session_id: string
  router_id: string
  router_name?: string
  mac: string
  answers: Record<string, string>
  created_at: string
}

export const questionnaireApi = {
  listFields: () => apiClient<QuestionnaireField[]>('/api/v1/admin/questionnaire/fields'),
  createField: (input: UpsertFieldInput) =>
    apiClient<QuestionnaireField>('/api/v1/admin/questionnaire/fields', {
      method: 'POST',
      ...jsonBody(input),
    }),
  updateField: (id: string, input: UpsertFieldInput) =>
    apiClient<QuestionnaireField>(`/api/v1/admin/questionnaire/fields/${id}`, {
      method: 'PUT',
      ...jsonBody(input),
    }),
  deleteField: (id: string) =>
    apiClient<null>(`/api/v1/admin/questionnaire/fields/${id}`, { method: 'DELETE' }),
  reorderFields: (ids: string[]) =>
    apiClient<null>('/api/v1/admin/questionnaire/fields/reorder', {
      method: 'PUT',
      ...jsonBody({ ids }),
    }),
  listSubmissions: (q: ListQuery) =>
    apiRequest<QuestionnaireSubmission[]>(`/api/v1/admin/questionnaire/submissions${toSearchParams(q)}`),
}
