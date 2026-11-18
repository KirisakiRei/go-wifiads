import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Copy,
  FastForward,
  Fingerprint,
  Phone,
  Table,
  Wifi,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { formatBytes, formatDate, formatDuration } from '@/lib/formatters'
import { useTableQuery } from '@/hooks/use-table-query'
import { useVisitors } from '@/features/visitors/hooks/use-visitors'

function formatVisitorStatus(status?: string): string {
  switch (status) {
    case 'CONNECTED':
      return 'Online'
    case 'PENDING':
      return 'Di Portal'
    case 'CLOSED':
      return 'Selesai'
    case 'STALE':
      return 'Terputus'
    default:
      return status || '—'
  }
}

export function VisitorsPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const { data, isPending, error } = useVisitors(query)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat daftar pengunjung." />

  const leadsCount = data.data.filter((v) => Boolean(v.survey_email || v.survey_phone)).length
  const leadsConversionRate = data.data.length > 0 ? ((leadsCount / data.data.length) * 100).toFixed(1) : '0'

  return (
    <div>
      <WavyHeader title="Data Pengunjung" />

      <div className="stitch-page-stage">
        {/* KPI Cards */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Pengunjung"
            value={data.meta?.total_items || data.data.length}
            icon={Fingerprint}
            subtext="Perangkat tercatat"
          />

          <KpiCard
            label="Kontak Terkumpul"
            value={leadsCount}
            icon={ClipboardCheck}
            iconBoxVariant="secondary"
            trend={{ label: `${leadsConversionRate}%` }}
            subtext="Email & nomor WhatsApp"
          />

          <KpiCard
            label="Sedang Online"
            value={data.data.filter((v) => v.status === 'CONNECTED').length}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Terhubung ke internet"
          />

          <KpiCard
            label="Tanpa Isi Kontak"
            value={data.data.filter((v) => v.survey_skipped).length}
            icon={FastForward}
            subtext="Langsung terhubung"
          />
        </KpiGrid>

        {/* Main Data Table Container */}
        <DataTableCard
          title="Daftar Pengunjung & Kontak"
          icon={Table}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari MAC, IP, atau kode voucher..."
                style={{ width: '240px' }}
              />

              <select
                value={query.status || ''}
                onChange={(e) => setFilter('status', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Status</option>
                <option value="CONNECTED">Online</option>
                <option value="PENDING">Di Portal</option>
                <option value="CLOSED">Selesai</option>
                <option value="STALE">Terputus</option>
              </select>
            </div>
          }
        >
          {data.data.length ? (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Perangkat</th>
                      <th>Voucher &amp; Paket</th>
                      <th>Status</th>
                      <th>Waktu Koneksi</th>
                      <th>Berlaku Sampai</th>
                      <th>Pemakaian Data</th>
                      <th>Kontak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((x) => {
                      const hasContact = Boolean(x.survey_email || x.survey_phone)
                      const isConnected = x.status === 'CONNECTED'
                      return (
                        <tr key={x.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Fingerprint size={18} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0b1c30' }}>
                                    {x.mac}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(x.mac)
                                      toast.success('Alamat MAC disalin')
                                    }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b' }}
                                    title="Salin Alamat MAC"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <small style={{ color: '#64748b', fontSize: '11px' }}>
                                  IP: {x.ip || '—'}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <code style={{ fontSize: '12px', background: '#eff4ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  {x.username || '—'}
                                </code>
                              </div>
                              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                                {x.profile_name || 'Standar'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <StatusPill
                              variant={isConnected ? 'active' : x.status === 'STALE' ? 'expired' : 'neutral'}
                              dot={isConnected}
                            >
                              {formatVisitorStatus(x.status)}
                            </StatusPill>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                              {isConnected ? (
                                <>
                                  <span style={{ color: '#065f46', fontWeight: 600 }}>
                                    Mulai: {formatDate(x.connected_at || x.created_at)}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '11px' }}>
                                    Durasi: {formatDuration(x.session_time_seconds)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#475569', fontWeight: 500 }}>
                                    Selesai: {formatDate(x.disconnected_at || x.last_accounting_at || x.created_at)}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '11px' }}>
                                    Durasi: {formatDuration(x.session_time_seconds)}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#0b1c30' }}>
                              {x.voucher_expires_at ? formatDate(x.voucher_expires_at) : '—'}
                            </span>
                          </td>

                          <td>
                            <div style={{ display: 'grid', gap: '0.15rem', fontSize: '12px' }}>
                              <span style={{ color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <ArrowDown size={12} /> {formatBytes(x.output_octets || 0)}
                              </span>
                              <span style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <ArrowUp size={12} /> {formatBytes(x.input_octets || 0)}
                              </span>
                            </div>
                          </td>

                          <td>
                            {hasContact ? (
                              <div style={{ display: 'grid', gap: '0.2rem' }}>
                                {x.survey_email && (
                                  <span style={{ fontWeight: 600, color: '#0b1c30', fontSize: '12px' }}>
                                    {x.survey_email}
                                  </span>
                                )}
                                {x.survey_phone && (
                                  <StatusPill variant="active" icon={Phone} iconSize={11} style={{ width: 'fit-content', fontSize: '11px', padding: '1px 6px' }}>
                                    {x.survey_phone}
                                  </StatusPill>
                                )}
                              </div>
                            ) : x.survey_skipped ? (
                              <small style={{ color: '#747686' }}>Tanpa Survei</small>
                            ) : (
                              <small style={{ color: '#94a3b8' }}>—</small>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} path="/visitors" search={searchParams} />
            </>
          ) : (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada pengunjung tercatat." />
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
