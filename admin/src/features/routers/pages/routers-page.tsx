import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Clock,
  Globe,
  Plus,
  RefreshCw,
  Router,
  Smartphone,
  Terminal,
  Wifi,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/query-state'
import { KpiCard, KpiGrid, WavyHeader } from '@/components/ui'
import { useRouters } from '@/features/routers/use-routers'
import { formatBytes, formatDate } from '@/lib/formatters'

export function RoutersPage() {
  const navigate = useNavigate()
  const { data: routers = [], isLoading, refetch, isFetching } = useRouters()

  if (isLoading) {
    return (
      <div className="stitch-card-container" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
        <p style={{ color: '#64748b', margin: 0 }}>Memuat daftar router...</p>
      </div>
    )
  }

  const connectedRouters = routers.filter((r) => r.is_connected).length
  const totalOnlineUsers = routers.reduce((acc, r) => acc + (r.active_sessions_count || 0), 0)
  const totalTrafficDown = routers.reduce((acc, r) => acc + (r.total_output_octets || 0), 0)
  const totalTrafficUp = routers.reduce((acc, r) => acc + (r.total_input_octets || 0), 0)

  return (
    <div>
      <WavyHeader
        title="Daftar Router"
        actions={
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              Segarkan
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/routers/new')}
            >
              <Plus size={18} />
              Tambah Router
            </button>
          </div>
        }
      />

      <div className="stitch-page-stage">
        {/* KPI Summary */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Router"
            value={routers.length}
            icon={Router}
            subtext="Perangkat terdaftar"
          />

          <KpiCard
            label="Router Terhubung"
            value={connectedRouters}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Aktif berkomunikasi"
          />

          <KpiCard
            label="Perangkat Online"
            value={totalOnlineUsers}
            icon={Smartphone}
            iconBoxVariant="secondary"
            subtext="Pengguna sedang terhubung"
          />

          <KpiCard
            label="Total Pemakaian Data"
            value={formatBytes(totalTrafficDown + totalTrafficUp)}
            icon={Activity}
            subtext={`↓ ${formatBytes(totalTrafficDown)} • ↑ ${formatBytes(totalTrafficUp)}`}
          />
        </KpiGrid>

        {/* Router Cards List */}
        {routers.length === 0 ? (
          <div className="stitch-card-container" style={{ padding: '2.5rem' }}>
            <EmptyState title="Belum ada router MikroTik yang terdaftar." />
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/routers/new')}
              >
                <Plus size={16} />
                Tambah Router Pertama
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '1.35rem',
            }}
          >
            {routers.map((r) => {
              const isConnected = Boolean(r.is_connected)
              return (
                <div
                  key={r.id}
                  className="stitch-card-container"
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            background: isConnected ? '#ecfdf5' : '#fffbeb',
                            color: isConnected ? '#059669' : '#d97706',
                            border: isConnected ? '1px solid #a7f3d0' : '1px solid #fde68a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Router size={24} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                              {r.name}
                            </h3>
                            <span
                              style={{
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                padding: '2px 7px',
                                borderRadius: '6px',
                              }}
                            >
                              Kode: {r.voucher_prefix || 'MK1-'}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                            ID: <strong style={{ fontFamily: 'monospace' }}>{r.nas_identifier}</strong>
                            {r.partner_venue_name ? ` • Mitra: ${r.partner_venue_name}` : r.venue_category ? ` • ${r.venue_category}` : ''}
                            {r.location_tier_name ? ` • ${r.location_tier_name} (${r.location_multiplier || 1}x)` : ''}
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: isConnected ? '#dcfce7' : '#fef3c7',
                          color: isConnected ? '#166534' : '#92400e',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: isConnected ? '#16a34a' : '#f59e0b',
                          }}
                        />
                        {isConnected ? 'Terhubung' : 'Belum Terhubung'}
                      </span>
                    </div>

                    {/* Telemetry Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.75rem',
                        background: '#f8fafc',
                        padding: '0.95rem',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Smartphone size={12} color="#10b981" /> Pengguna Aktif
                        </span>
                        <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block', marginTop: '3px' }}>
                          {r.active_sessions_count || 0} Online
                        </strong>
                        <small style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Total {r.total_sessions_count || 0} sesi
                        </small>
                      </div>

                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Globe size={12} color="#2563eb" /> Alamat IP
                        </span>
                        <strong style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0f172a', display: 'block', marginTop: '4px' }}>
                          {r.nas_ip_address || '—'}
                        </strong>
                        <small style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                          Lokal: {r.ip_address || '10.10.0.1'}
                        </small>
                      </div>

                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Activity size={12} color="#0369a1" /> Pemakaian Data
                        </span>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <ArrowDown size={11} /> {formatBytes(r.total_output_octets || 0)}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <ArrowUp size={11} /> {formatBytes(r.total_input_octets || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Last Activity Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', color: '#64748b' }}>
                      <Clock size={14} color={isConnected ? '#10b981' : '#f59e0b'} />
                      <span>
                        {r.last_seen_at
                          ? `Aktivitas terakhir: ${formatDate(r.last_seen_at)}`
                          : 'Belum ada koneksi dari router ini'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Action Buttons */}
                  <div
                    style={{
                      paddingTop: '1rem',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '12px', padding: '0.6rem 0.85rem' }}
                      onClick={() => navigate(`/routers/${r.id}`)}
                    >
                      <Terminal size={14} />
                      Script MikroTik
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: '12px', padding: '0.6rem 0.85rem' }}
                      onClick={() => navigate(`/routers/${r.id}`)}
                    >
                      Atur Router
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
