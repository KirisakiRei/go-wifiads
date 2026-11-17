import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listQuery } from '@/lib/query-params'

export function useTableQuery(debounceMs = 350) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = listQuery(searchParams)

  // Local state for immediate input feedback
  const [searchTerm, setSearchTerm] = useState<string>(query.search || '')

  // Sync if URL search changes externally
  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '')
  }, [searchParams])

  // Debounced search sync to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = searchParams.get('search') || ''
      const trimmed = searchTerm.trim()
      if (trimmed !== currentParam) {
        const next = new URLSearchParams(searchParams)
        if (trimmed) {
          next.set('search', trimmed)
        } else {
          next.delete('search')
        }
        next.set('page', '1') // Reset page to 1 on search
        setSearchParams(next, { replace: true })
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [searchTerm, debounceMs, searchParams, setSearchParams])

  // Instant filter updater (e.g. for <select>)
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'ALL' && value !== '') {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.set('page', '1') // Reset page on filter change
    setSearchParams(next, { replace: true })
  }

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return {
    query,
    searchParams,
    searchTerm,
    setSearchTerm,
    setFilter,
    resetFilters,
  }
}
