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

export function VisitorsPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const { data, isPending, error } = useVisitors(query)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat pengunjung." />

  const leadsCount = data.data.filter((v) => Boolean(v.survey_email || v.survey_phone)).length
  const leadsConversionRate = data.data.length > 0 ? ((leadsCount / data.data.length) * 100).toFixed(1) : '0'

  return (
    <div>
      <WavyHeader
        title="Data Pengunjung"
      />

      <div className="stitch-page-stage">
        {/* Telemetry KPI Cards from Stitch */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Perangkat Terdata di Fleet"
            value={data.meta?.total_items || data.data.length}
            icon={Fingerprint}
            trend={{ label: 'Unique MAC', variant: 'success' }}
            footerLeft="Across MikroTik APs"
            footerRight="Active Tracking"
          />

          <KpiCard
            label="Leads Terkumpul (Kontak/Survey)"
            value={leadsCount}
            icon={ClipboardCheck}
            iconBoxVariant="secondary"
            trend={{ label: `${leadsConversionRate}% Opt-in` }}
            footerLeft="Kontak Email & WhatsApp"
            footerRight="Survey Leads"
          />

          <KpiCard
            label="Sesi Aktif Online"
            value={data.data.filter((v) => v.status === 'CONNECTED').length}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            trend={{ label: 'Connected', variant: 'success' }}
            footerLeft="Pengguna sedang browsing"
            footerRight="MikroTik DHCP Hook"
          />

          <KpiCard
            label="Dilewati (Skip Survey)"
            value={data.data.filter((v) => v.survey_skipped).length}
            icon={FastForward}
            trend={{ label: 'Paket Basic' }}
            footerLeft="Melewati pengisian form"
            footerRight="QoS Terbatas"
          />
        </KpiGrid>

        {/* Main Data Table Container */}
        <DataTableCard
          title="Daftar Pengunjung & Kontak Survey Leads"
          icon={Table}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari MAC, IP, atau username..."
                style={{ width: '240px' }}
              />

              <select
                value={query.status || ''}
                onChange={(e) => setFilter('status', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Status</option>
                <option value="CONNECTED">Connected</option>
                <option value="DISCONNECTED">Disconnected</option>
                <option value="EXPIRED">Expired</option>
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
                      <th>Perangkat (Real MAC &amp; IP)</th>
                      <th>Kredensial &amp; Profil QoS</th>
                      <th>Status Koneksi</th>
                      <th>Waktu &amp; Terakhir Terhubung</th>
                      <th>Masa Aktif Voucher</th>
                      <th>Konsumsi Traffic</th>
                      <th>Leads Survey</th>
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
                                      toast.success('MAC Address disalin')
                                    }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b' }}
                                    title="Salin MAC Address"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <small style={{ color: '#64748b', fontSize: '11px' }}>
                                  IP: {x.ip || '10.10.x.x'}
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
                                {x.profile_name || 'Default Hotspot'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <StatusPill
                              variant={isConnected ? 'active' : x.status === 'STALE' ? 'expired' : 'neutral'}
                              dot={isConnected}
                            >
                              {x.status}
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
                                    Online: {formatDuration(x.session_time_seconds)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#475569', fontWeight: 500 }}>
                                    Putus: {formatDate(x.disconnected_at || x.last_accounting_at || x.created_at)}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '11px' }}>
                                    Total Durasi: {formatDuration(x.session_time_seconds)}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                              {x.voucher_expires_at ? (
                                <>
                                  <span style={{ fontWeight: 600, color: '#0b1c30' }}>
                                    {formatDate(x.voucher_expires_at)}
                                  </span>
                                  <span style={{ fontSize: '11px', color: x.voucher_status === 'ACTIVE' ? '#10b981' : '#64748b' }}>
                                    Status: {x.voucher_status || 'Issued'}
                                  </span>
                                </>
                              ) : (
                                <small style={{ color: '#94a3b8' }}>Mengikuti Sesi</small>
                              )}
                            </div>
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
                              <small style={{ color: '#747686' }}>Skip Survey</small>
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
              <EmptyState title="Belum ada pengunjung tercatat di database." />
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
