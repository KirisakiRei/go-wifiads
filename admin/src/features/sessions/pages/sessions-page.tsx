import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Download,
  Router,
  Smartphone,
  Upload,
} from 'lucide-react'
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
import { useSessions } from '@/features/sessions/hooks/use-sessions'

export function SessionsPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const { data, isPending, error } = useSessions(query)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat sesi RADIUS." />

  const activeSessions = data.data.filter((s) => s.status === 'ACTIVE').length
  const staleSessions = data.data.filter((s) => s.status === 'STALE').length
  const totalIn = data.data.reduce((acc, s) => acc + (s.input_octets || 0), 0)
  const totalOut = data.data.reduce((acc, s) => acc + (s.output_octets || 0), 0)

  return (
    <div>
      <WavyHeader
        title="Sesi RADIUS"
      />

      <div className="stitch-page-stage">
        {/* Telemetry KPI Cards from Stitch */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Sesi Pengguna Online"
            value={activeSessions}
            icon={Smartphone}
            iconColor="#10b981"
            iconBoxVariant="success"
            trend={{ label: 'Terhubung', variant: 'success' }}
            footerLeft="Layanan Autentikasi Aktif"
            footerRight="Waktu Nyata"
          />

          <KpiCard
            label="Sesi Stale / Idle"
            value={staleSessions}
            icon={AlertTriangle}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            trend={{ label: 'Butuh CoA', variant: 'warning' }}
            footerLeft="Keepalive Miss > 3m"
            footerRight="Auto Cleanup Hook"
          />

          <KpiCard
            label="Total Traffic Download"
            value={formatBytes(totalIn)}
            icon={Download}
            trend={{ label: 'Acct-Input' }}
            footerLeft="Total unduhan klien"
            footerRight="MikroTik Interface"
          />

          <KpiCard
            label="Total Traffic Upload"
            value={formatBytes(totalOut)}
            icon={Upload}
            iconBoxVariant="secondary"
            trend={{ label: 'Acct-Output' }}
            footerLeft="Total unggahan klien"
            footerRight="MikroTik Interface"
          />
        </KpiGrid>

        {/* Sessions Table Container */}
        <DataTableCard
          title="Riwayat Sesi Koneksi Pengguna"
          icon={ArrowLeftRight}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari voucher, NAS, atau MAC..."
                style={{ width: '240px' }}
              />

              <select
                value={query.status || ''}
                onChange={(e) => setFilter('status', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Status Sesi</option>
                <option value="ACTIVE">Active (Live Online)</option>
                <option value="CLOSED">Closed (Selesai/Logout)</option>
                <option value="STALE">Stale (Koneksi Putus)</option>
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
                      <th>Router / NAS MikroTik</th>
                      <th>Kredensial Sesi (Voucher)</th>
                      <th>Perangkat Klien (MAC / IP)</th>
                      <th>Status Sesi RADIUS</th>
                      <th>Waktu Mulai &amp; Durasi</th>
                      <th>Konsumsi Traffic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((x) => {
                      const isActive = x.status === 'ACTIVE'
                      return (
                        <tr key={x.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Router size={18} style={{ color: '#00668a', flexShrink: 0 }} />
                              <div>
                                <strong style={{ fontSize: '13px', color: '#0b1c30' }}>
                                  {x.nas_identifier || 'MikroTik-Gateway'}
                                </strong>
                                <br />
                                <small style={{ color: '#64748b', fontSize: '11px' }}>
                                  Acct-ID: {x.acct_session_id?.substring(0, 12) || '—'}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <code style={{ fontSize: '13px', background: '#eff4ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, width: 'fit-content' }}>
                                {x.username}
                              </code>
                              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Akses Terverifikasi
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0b1c30' }}>
                                {x.calling_station_id || '—'}
                              </strong>
                              <small style={{ color: '#64748b', fontSize: '11px' }}>
                                IP: {x.framed_ip_address || '—'}
                              </small>
                            </div>
                          </td>

                          <td>
                            <StatusPill
                              variant={isActive ? 'active' : x.status === 'STALE' ? 'expired' : 'neutral'}
                              dot={isActive}
                            >
                              {x.status}
                            </StatusPill>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                              <span style={{ color: '#0b1c30', fontWeight: 600 }}>
                                {formatDate(x.started_at || x.created_at)}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>
                                Online: {formatDuration(x.session_time_seconds)}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'grid', gap: '0.15rem', fontSize: '12px' }}>
                              <span style={{ color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <ArrowDown size={11} /> {formatBytes(x.input_octets)}
                              </span>
                              <span style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <ArrowUp size={11} /> {formatBytes(x.output_octets)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} path="/sessions" search={searchParams} />
            </>
          ) : (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada sesi accounting tercatat." />
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
