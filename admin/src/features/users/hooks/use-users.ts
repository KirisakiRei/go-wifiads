import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/features/users/api/users.api'

export const usersQueryKey = ['users'] as const
export const rolesQueryKey = ['roles'] as const

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: usersApi.list,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: rolesQueryKey,
    queryFn: usersApi.listRoles,
  })
}
