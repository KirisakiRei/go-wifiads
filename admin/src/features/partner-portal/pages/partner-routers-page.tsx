import { useQuery } from '@tanstack/react-query'
import { Award, Clock, MapPin, Router, Smartphone } from 'lucide-react'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import { StatusPill, WavyHeader } from '@/components/ui'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import { formatDate } from '@/lib/formatters'

export function PartnerRoutersPage() {
  const { data: routers = [], isPending } = useQuery({
    queryKey: ['partner-routers'],
    queryFn: partnerApi.listRouters,
  })

  if (isPending) return <LoadingState />

  return (
    <div>
      <WavyHeader title="Perangkat Wi-Fi di Lokasi Saya" />

      <div className="stitch-page-stage">
        {routers.length === 0 ? (
          <EmptyState
            title="Belum ada perangkat router yang terhubung ke akun Anda"
            description="Tim pengelola akan mengaitkan perangkat router lokasi Anda segera setelah instalasi selesai."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {routers.map((r) => (
              <div
                key={r.id}
                className="stitch-card-container"
                style={{
                  background: '#ffffff',
                  padding: '1.35rem',
                  display: 'grid',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: r.is_connected ? '#ecfdf5' : '#fef3c7',
                        color: r.is_connected ? '#059669' : '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Router size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {r.name}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{r.venue_name}</span>
                    </div>
                  </div>

                  <StatusPill variant={r.is_connected ? 'active' : 'basic'} dot={r.is_connected}>
                    {r.is_connected ? 'Online' : 'Menunggu Sesi'}
                  </StatusPill>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.6rem',
                    background: '#f8fafc',
                    borderRadius: '11px',
                    border: '1px solid #e2e8f0',
                    padding: '0.85rem',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Smartphone size={12} color="#059669" /> Sedang Aktif
                    </span>
                    <strong style={{ fontSize: '15px', display: 'block', marginTop: '2px' }}>
                      {r.active_sessions_count} Perangkat
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Rata-rata Harian</span>
                    <strong style={{ fontSize: '15px', display: 'block', marginTop: '2px' }}>
                      {r.avg_daily_visitors} / hari
                    </strong>
                  </div>

                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Award size={12} color="#2563eb" /> Kategori Rank
                    </span>
                    <strong
                      style={{
                        fontSize: '14px',
                        color: '#1d4ed8',
                        display: 'block',
                        marginTop: '2px',
                      }}
                    >
                      {r.tier_name}
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', display: 'grid', gap: '4px' }}>
                  {r.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin size={13} color="#059669" />
                      <span>{r.address}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={13} />
                    <span>
                      {r.last_seen_at
                        ? `Aktivitas terakhir: ${formatDate(r.last_seen_at)}`
                        : 'Menunggu aktivitas pengguna pertama'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
