import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  MapPin,
  Megaphone,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingState } from '@/components/feedback/query-state'
import { KpiCard, KpiGrid, StatusPill, WavyHeader } from '@/components/ui'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import { useCurrentPartner } from '@/features/partner-portal/hooks/use-current-partner'
import { formatRupiah } from '@/lib/formatters'

function buildSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`
  let path = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const cpX1 = curr.x + (next.x - curr.x) * 0.45
    const cpX2 = curr.x + (next.x - curr.x) * 0.55
    path += ` C ${cpX1.toFixed(1)},${curr.y.toFixed(1)} ${cpX2.toFixed(1)},${next.y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`
  }
  return path
}

export function PartnerOverviewPage() {
  const navigate = useNavigate()
  const { data: partner } = useCurrentPartner()
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')

  const { data: overview, isPending } = useQuery({
    queryKey: ['partner-overview'],
    queryFn: partnerApi.getOverview,
  })

  const series = useMemo(() => {
    if (!overview) return []
    if (range === 'today') return overview.trend_today || []
    if (range === '30d') return overview.trend_30d || []
    return overview.trend_7d || []
  }, [overview, range])

  const chart = useMemo(() => {
    const width = 760
    const topY = 24
    const bottomY = 185
    const usable = bottomY - topY
    const maxEarned = Math.max(100, ...series.map((s) => s.earned_idr))
    const maxVis = Math.max(5, ...series.map((s) => s.visitors))
    const stepX = series.length > 1 ? width / (series.length - 1) : width

    const earnedPts = series.map((s, i) => ({
      x: i * stepX,
      y: bottomY - (s.earned_idr / maxEarned) * usable,
      label: s.label,
    }))
    const visPts = series.map((s, i) => ({
      x: i * stepX,
      y: bottomY - (s.visitors / maxVis) * usable,
    }))

    const earnedLine = buildSmoothSvgPath(earnedPts)
    const earnedArea = earnedLine ? `${earnedLine} L ${width},${bottomY} L 0,${bottomY} Z` : ''
    const visLine = buildSmoothSvgPath(visPts)
    return { earnedPts, earnedLine, earnedArea, visLine }
  }, [series])

  if (isPending || !overview) return <LoadingState />

  const rankProgressPercent =
    overview.rank.next_tier_min_connects && overview.rank.next_tier_min_connects > 0
      ? Math.min(
          100,
          Math.round(
            (overview.rank.avg_daily_connects * 100) / overview.rank.next_tier_min_connects
          )
        )
      : 100

  return (
    <div>
      <WavyHeader
        title={partner?.venue_name || 'Ringkasan Lokasi'}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: '#059669' }}
            onClick={() => navigate('/earnings')}
          >
            <Wallet size={16} /> Pencairan Dana
          </button>
        }
      />

      <div className="stitch-page-stage">
        {overview.needs_location_setup && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              padding: '1rem 1.25rem',
              borderRadius: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '13px' }}>
              <AlertTriangle size={19} style={{ flexShrink: 0 }} />
              <span>
                <strong>Titik lokasi peta belum dilengkapi.</strong> Silakan tentukan titik koordinat
                dan alamat tempat usaha Anda agar tampil di peta pemilihan iklan.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '12px' }}
              onClick={() => navigate('/profile')}
            >
              <MapPin size={14} /> Atur Titik Lokasi Sekarang
            </button>
          </div>
        )}

        <KpiGrid columns={4}>
          <KpiCard
            label="Saldo Siap Dicairkan"
            value={formatRupiah(overview.wallet_balance_idr)}
            icon={Wallet}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext={`Hari ini: ${formatRupiah(overview.today_earned_idr)}`}
          />
          <KpiCard
            label="Total Pendapatan Lokasi"
            value={formatRupiah(overview.total_earned_idr)}
            icon={TrendingUp}
            subtext={`Bulan ini: ${formatRupiah(overview.month_earned_idr)}`}
          />
          <KpiCard
            label="Pengunjung Wi-Fi Hari Ini"
            value={overview.today_visitors.toLocaleString('id-ID')}
            icon={Users}
            iconBoxVariant="secondary"
            subtext={`${overview.online_routers_count}/${overview.routers_count} perangkat terhubung`}
          />
          <KpiCard
            label="Iklan Aktif di Lokasi"
            value={overview.active_ads_count}
            icon={Megaphone}
            subtext="Sedang dijadwalkan tayang"
          />
        </KpiGrid>

        {/* Rank Progress Card */}
        <div
          className="stitch-card-container"
          style={{
            background: '#ffffff',
            padding: '1.25rem 1.4rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#eff6ff',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  Kategori Lokasi: {overview.rank.current_tier_name}
                </strong>
                <StatusPill variant="active">Aktif</StatusPill>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Rata-rata 7 hari terakhir: <strong>{overview.rank.avg_daily_connects}</strong> koneksi
                Wi-Fi/hari • <strong>{overview.rank.avg_daily_impressions}</strong> tayangan/hari
              </span>
            </div>
          </div>

          {overview.rank.next_tier_name && overview.rank.next_tier_min_connects ? (
            <div style={{ minWidth: '240px', flex: '0 1 300px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '4px',
                }}
              >
                <span>Menuju Rank {overview.rank.next_tier_name}</span>
                <span>
                  {overview.rank.avg_daily_connects} / {overview.rank.next_tier_min_connects}{' '}
                  koneksi/hari
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  borderRadius: '999px',
                  background: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${rankProgressPercent}%`,
                    height: '100%',
                    background: '#059669',
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '12px' }}
              onClick={() => navigate('/ads')}
            >
              Lihat Iklan Tayang <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Trend Chart */}
        <div
          className="stitch-card-container"
          style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1rem' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Grafik Pendapatan &amp; Pengunjung Lokasi
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Perkembangan pendapatan lokasi dan jumlah pengunjung Wi-Fi.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[
                { k: 'today', label: 'Hari Ini' },
                { k: '7d', label: '7 Hari' },
                { k: '30d', label: '30 Hari' },
              ].map((t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setRange(t.k as 'today' | '7d' | '30d')}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: range === t.k ? '#059669' : '#ffffff',
                    color: range === t.k ? '#ffffff' : '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox="0 0 760 210" style={{ width: '100%', minWidth: '500px', height: '210px' }}>
              <defs>
                <linearGradient id="partnerEarnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[45, 95, 145, 185].map((y) => (
                <line
                  key={y}
                  x1={0}
                  y1={y}
                  x2={760}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeDasharray="4 4"
                />
              ))}
              {chart.earnedArea && <path d={chart.earnedArea} fill="url(#partnerEarnGrad)" />}
              {chart.visLine && (
                <path
                  d={chart.visLine}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              )}
              {chart.earnedLine && (
                <path d={chart.earnedLine} fill="none" stroke="#059669" strokeWidth="3" />
              )}
              {chart.earnedPts.map((pt, idx) => (
                <text
                  key={idx}
                  x={pt.x}
                  y={204}
                  fontSize="11"
                  fill="#64748b"
                  textAnchor={
                    idx === 0 ? 'start' : idx === chart.earnedPts.length - 1 ? 'end' : 'middle'
                  }
                >
                  {pt.label}
                </text>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
