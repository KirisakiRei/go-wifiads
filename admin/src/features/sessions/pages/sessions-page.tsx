import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Download,
  PowerOff,
  RefreshCw,
  Router,
  Smartphone,
  Upload,
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
import { useRouters } from '@/features/routers/use-routers'
import { useDisconnectSession, useSessions } from '@/features/sessions/hooks/use-sessions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatBytes, formatDate, formatDuration } from '@/lib/formatters'

export function SessionsPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const { data, isPending, error, refetch, isFetching } = useSessions(query)
  const { data: routers = [] } = useRouters()
  const disconnectMutation = useDisconnectSession()
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat sesi RADIUS." />

  const activeSessions = data.data.filter((s) => s.status === 'ACTIVE').length
  const staleSessions = data.data.filter((s) => s.status === 'STALE').length
  const totalDown = data.data.reduce((acc, s) => acc + (s.output_octets || 0), 0)
  const totalUp = data.data.reduce((acc, s) => acc + (s.input_octets || 0), 0)

  const handleKick = (sessionId: string) => {
    disconnectMutation.mutate(sessionId, {
      onSuccess: (res) => {
        setConfirmKickId(null)
        if (res.coa_sent) {
          toast.success(res.message)
        } else {
          toast.warning(res.message)
        }
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Gagal memutus sesi pengguna')
      },
    })
  }

  return (
    <div>
      <WavyHeader
        title="Sesi Aktif & Riwayat RADIUS"
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            Segarkan
          </button>
        }
      />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Sesi Pengguna Online"
            value={activeSessions}
            icon={Smartphone}
            iconColor="#10b981"
            iconBoxVariant="success"
            trend={{ label: 'Live', variant: 'success' }}
            footerLeft="Autentikasi RADIUS Aktif"
            footerRight="Auto 30 dtk"
          />

          <KpiCard
            label="Sesi Stale / Idle"
            value={staleSessions}
            icon={AlertTriangle}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            trend={{ label: 'Idle', variant: 'warning' }}
            footerLeft="Interim-Update terhenti"
            footerRight="Auto Janitor"
          />

          <KpiCard
            label="Total Download"
            value={formatBytes(totalDown)}
            icon={Download}
            trend={{ label: 'Acct-Output' }}
            footerLeft="Unduhan klien pada halaman ini"
            footerRight="MikroTik Hotspot"
          />

          <KpiCard
            label="Total Upload"
            value={formatBytes(totalUp)}
            icon={Upload}
            iconBoxVariant="secondary"
            trend={{ label: 'Acct-Input' }}
            footerLeft="Unggahan klien pada halaman ini"
            footerRight="MikroTik Hotspot"
          />
        </KpiGrid>

        <DataTableCard
          title="Daftar Sesi Koneksi Pengguna"
          icon={ArrowLeftRight}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari voucher, MAC, atau IP..."
                style={{ width: '220px' }}
              />

              <select
                value={query.router_id || ''}
                onChange={(e) => setFilter('router_id', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Router</option>
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={query.status || ''}
                onChange={(e) => setFilter('status', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Status</option>
                <option value="ACTIVE">Active (Online)</option>
                <option value="CLOSED">Closed (Selesai)</option>
                <option value="STALE">Stale (Terputus)</option>
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
                      <th>Router / Lokasi</th>
                      <th>Voucher</th>
                      <th>Perangkat (MAC / IP)</th>
                      <th>Status</th>
                      <th>Mulai &amp; Uptime</th>
                      <th>Traffic (Down / Up)</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((x) => {
                      const isActive = x.status === 'ACTIVE'
                      const isConfirming = confirmKickId === x.id
                      return (
                        <tr key={x.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Router size={17} style={{ color: '#00668a', flexShrink: 0 }} />
                              <div>
                                <strong style={{ fontSize: '13px', color: '#0b1c30' }}>
                                  {x.router_name || x.nas_identifier || 'MikroTik-Gateway'}
                                </strong>
                                <br />
                                <small style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                                  {x.nas_identifier}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <code
                              style={{
                                fontSize: '13px',
                                background: '#eff4ff',
                                color: '#1d4ed8',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                              }}
                            >
                              {x.username}
                            </code>
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
                            {x.terminate_cause && (
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                {x.terminate_cause}
                              </div>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                              <span style={{ color: '#0b1c30', fontWeight: 600 }}>
                                {formatDate(x.started_at || x.created_at)}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>
                                Uptime: {formatDuration(x.session_time_seconds)}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'grid', gap: '0.15rem', fontSize: '12px' }}>
                              <span style={{ color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <ArrowDown size={11} /> {formatBytes(x.output_octets)}
                              </span>
                              <span style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <ArrowUp size={11} /> {formatBytes(x.input_octets)}
                              </span>
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {isActive ? (
                              isConfirming ? (
                                <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px' }}
                                    disabled={disconnectMutation.isPending}
                                    onClick={() => handleKick(x.id)}
                                  >
                                    {disconnectMutation.isPending ? 'Memutus...' : 'Ya, Putus'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                    onClick={() => setConfirmKickId(null)}
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '0.4rem 0.7rem',
                                    fontSize: '12px',
                                    color: '#b91c1c',
                                    borderColor: '#fecaca',
                                    background: '#fef2f2',
                                  }}
                                  onClick={() => setConfirmKickId(x.id)}
                                >
                                  <PowerOff size={13} />
                                  Putuskan
                                </button>
                              )
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                            )}
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
