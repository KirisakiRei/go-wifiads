import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Eye, ScrollText, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { auditLogsApi, type AuditLogItem } from '@/features/audit-logs/audit-logs.api'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDate } from '@/lib/formatters'

function formatDetailPreview(raw: string): string {
  if (!raw) return '—'
  if (raw.length <= 72) return raw
  return `${raw.slice(0, 72)}…`
}

function prettyDetail(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw || '—'
  }
}

export function AuditLogsPage() {
  const qc = useQueryClient()
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const action = searchParams.get('action') || ''
  const entityType = searchParams.get('entity_type') || ''
  const dateFrom = searchParams.get('date_from') || ''
  const dateTo = searchParams.get('date_to') || ''

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)
  const [confirmCleanup, setConfirmCleanup] = useState(false)

  const { data, isPending, error } = useQuery({
    queryKey: ['audit-logs', query.page, query.per_page, query.search, action, entityType, dateFrom, dateTo],
    queryFn: () =>
      auditLogsApi.list({
        page: query.page,
        per_page: query.per_page,
        search: query.search,
        action: action || undefined,
        entity_type: entityType || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  })

  const { data: filterOpts } = useQuery({
    queryKey: ['audit-log-filters'],
    queryFn: auditLogsApi.filters,
  })

  const cleanupMutation = useMutation({
    mutationFn: (days: number) => auditLogsApi.cleanup(days),
    onSuccess: (res) => {
      setConfirmCleanup(false)
      toast.success(`Berhasil membersihkan ${res.deleted} log lebih dari ${res.days} hari`)
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal membersihkan log'),
  })

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat log sistem." />

  return (
    <div>
      <WavyHeader
        title="Log Sistem & Audit Trail"
        actions={
          confirmCleanup ? (
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <button
                type="button"
                className="btn btn-danger"
                disabled={cleanupMutation.isPending}
                onClick={() => cleanupMutation.mutate(90)}
              >
                {cleanupMutation.isPending ? 'Membersihkan...' : 'Hapus Log > 90 Hari'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmCleanup(false)}>
                Batal
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmCleanup(true)}>
              <Trash2 size={15} />
              Bersihkan Log Lama
            </button>
          )
        }
      />

      <div className="stitch-page-stage">
        <DataTableCard
          title="Riwayat Aktivitas Administrator"
          icon={ScrollText}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari aktor, entitas, detail..."
                style={{ width: '210px' }}
              />
              <select
                value={action}
                onChange={(e) => setFilter('action', e.target.value)}
                style={{ padding: '0.6rem 0.75rem' }}
              >
                <option value="">Semua Aksi</option>
                {(filterOpts?.actions || []).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                value={entityType}
                onChange={(e) => setFilter('entity_type', e.target.value)}
                style={{ padding: '0.6rem 0.75rem' }}
              >
                <option value="">Semua Entitas</option>
                {(filterOpts?.entity_types || []).map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setFilter('date_from', e.target.value)}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setFilter('date_to', e.target.value)}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
          }
        >
          {data.data.length ? (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Aktor</th>
                      <th>Aksi</th>
                      <th>Entitas</th>
                      <th>Ringkasan Detail</th>
                      <th style={{ textAlign: 'right' }}>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((log) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#475569' }}>
                          {formatDate(log.created_at)}
                        </td>
                        <td>
                          <strong style={{ fontSize: '13px', color: '#0b1c30' }}>
                            {log.actor_name || 'system'}
                          </strong>
                        </td>
                        <td>
                          <StatusPill variant="basic">{log.action}</StatusPill>
                        </td>
                        <td style={{ fontSize: '12px', color: '#475569' }}>
                          <span>{log.entity_type || '—'}</span>
                          {log.entity_id && (
                            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                              {log.entity_id.slice(0, 14)}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: '#334155', maxWidth: '300px' }}>
                          {formatDetailPreview(log.detail)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '11px' }}
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye size={13} />
                            Lihat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} path="/logs" search={searchParams} />
            </>
          ) : (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada catatan log aktivitas." />
            </div>
          )}
        </DataTableCard>
      </div>

      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 60,
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="stitch-card-container"
            style={{ width: '100%', maxWidth: '540px', padding: '1.5rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Detail Audit Log
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: '0.4rem', fontSize: '12px', color: '#334155', marginBottom: '0.85rem' }}>
              <div><strong>Waktu:</strong> {formatDate(selectedLog.created_at)}</div>
              <div><strong>Aktor:</strong> {selectedLog.actor_name} ({selectedLog.actor_id || '—'})</div>
              <div><strong>Aksi:</strong> <code>{selectedLog.action}</code></div>
              <div><strong>Entitas:</strong> {selectedLog.entity_type} / <code>{selectedLog.entity_id || '—'}</code></div>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '0.9rem',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: '12px',
                overflowX: 'auto',
                maxHeight: '280px',
              }}
            >
              {prettyDetail(selectedLog.detail)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
