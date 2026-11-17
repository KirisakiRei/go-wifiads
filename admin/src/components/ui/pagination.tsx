import { Link } from 'react-router-dom'
import type { PaginationMeta } from '@/types/api'

export function Pagination({ meta, path, search }: { meta?: PaginationMeta; path: string; search: URLSearchParams }) {
  if (!meta || meta.total_pages <= 1) return null
  const target = (page: number) => { const next = new URLSearchParams(search); next.set('page', String(page)); return `${path}?${next}` }
  return <div className="pagination"><span>Total {meta.total_items} data</span><div>{meta.current_page > 1 && <Link to={target(meta.current_page - 1)}>← Sebelumnya</Link>}<span>Halaman {meta.current_page}/{meta.total_pages}</span>{meta.current_page < meta.total_pages && <Link to={target(meta.current_page + 1)}>Berikutnya →</Link>}</div></div>
}
