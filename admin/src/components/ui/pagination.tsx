import { Link } from 'react-router-dom'
import type { PaginationMeta } from '@/types/api'

type PaginationProps =
  | {
      meta?: PaginationMeta
      path: string
      search: URLSearchParams
      onPageChange?: never
    }
  | {
      meta?: PaginationMeta
      onPageChange: (page: number) => void
      path?: never
      search?: never
    }

export function Pagination(props: PaginationProps) {
  const { meta } = props
  if (!meta || meta.total_pages <= 1) return null

  if ('onPageChange' in props && props.onPageChange) {
    const { onPageChange } = props
    return (
      <div className="pagination">
        <span>Total {meta.total_items} data</span>
        <div>
          {meta.current_page > 1 && (
            <button
              type="button"
              onClick={() => onPageChange(meta.current_page - 1)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.35rem 0.7rem',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              ← Sebelumnya
            </button>
          )}
          <span>
            Halaman {meta.current_page}/{meta.total_pages}
          </span>
          {meta.current_page < meta.total_pages && (
            <button
              type="button"
              onClick={() => onPageChange(meta.current_page + 1)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.35rem 0.7rem',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              Berikutnya →
            </button>
          )}
        </div>
      </div>
    )
  }

  const target = (page: number) => {
    const next = new URLSearchParams(props.search)
    next.set('page', String(page))
    return `${props.path}?${next}`
  }

  return (
    <div className="pagination">
      <span>Total {meta.total_items} data</span>
      <div>
        {meta.current_page > 1 && <Link to={target(meta.current_page - 1)}>← Sebelumnya</Link>}
        <span>
          Halaman {meta.current_page}/{meta.total_pages}
        </span>
        {meta.current_page < meta.total_pages && <Link to={target(meta.current_page + 1)}>Berikutnya →</Link>}
      </div>
    </div>
  )
}
