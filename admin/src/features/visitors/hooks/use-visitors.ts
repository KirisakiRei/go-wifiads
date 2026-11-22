import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListQuery } from '@/types/common'
import { visitorsApi } from '@/features/visitors/api/visitors.api'
import type { BlockDeviceInput } from '@/features/visitors/types/visitor.types'

export function useVisitors(query: ListQuery) {
  return useQuery({
    queryKey: ['visitors', query],
    queryFn: () => visitorsApi.list(query),
  })
}

export function useBlockedDevices(query: ListQuery) {
  return useQuery({
    queryKey: ['blocked-devices', query],
    queryFn: () => visitorsApi.listBlocked(query),
  })
}

export function useBlockDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mac, input }: { mac: string; input: BlockDeviceInput }) =>
      visitorsApi.block(mac, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitors'] })
      qc.invalidateQueries({ queryKey: ['blocked-devices'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export function useUnblockDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mac: string) => visitorsApi.unblock(mac),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitors'] })
      qc.invalidateQueries({ queryKey: ['blocked-devices'] })
    },
  })
}
