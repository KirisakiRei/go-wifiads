import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Eye,
  Megaphone,
  MousePointerClick,
  PlusCircle,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import { KpiCard, KpiGrid, WavyHeader } from '@/components/ui'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import type { AdvertiserChartPoint } from '@/features/marketplace/marketplace.types'
import { formatRupiah } from '@/lib/formatters'

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const c = points[i]
    const n = points[i + 1]
    const cx1 = c.x + (n.x - c.x) * 0.45
    const cx2 = c.x + (n.x - c.x) * 0.55
    d += ` C ${cx1.toFixed(1)},${c.y.toFixed(1)} ${cx2.toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}`
  }
  return d
}

export function AdvertiserOverviewPage() {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { data, isPending, error } = useQuery({
    queryKey: ['adv-overview'],
    queryFn: advertiserApi.getOverview,
  })

  const series: AdvertiserChartPoint[] = useMemo(() => {
    if (!data) return []
    if (range === 'today') return data.trend_today || []
    if (range === '30d') return data.trend_30d || []
    return data.trend_7d || []
  }, [data, range])

  const geom = useMemo(() => {
    const width = 760
    const topY = 26
    const bottomY = 190
    const usableH = bottomY - topY
    const maxVal = Math.max(4, ...series.map((p) => Math.max(p.impressions || 0, p.clicks || 0)))
    const stepX = series.length > 1 ? width / (series.length - 1) : width

    const impPts = series.map((p, i) => ({
      x: i * stepX,
      y: bottomY - ((p.impressions || 0) / maxVal) * usableH,
    }))
    const clkPts = series.map((p, i) => ({
      x: i * stepX,
      y: bottomY - ((p.clicks || 0) / maxVal) * usableH,
    }))
    const impLine = smoothPath(impPts)
    const impArea = impLine ? `${impLine} L ${width},${bottomY} L 0,${bottomY} Z` : ''
    const clkLine = smoothPath(clkPts)
    return { impPts, clkPts, impLine, impArea, clkLine }
  }, [series])

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat ringkasan pengiklan." />

  const rangeImp = series.reduce((acc, p) => acc + p.impressions, 0)
  const rangeSpent = series.reduce((acc, p) => acc + p.spent_idr, 0)

  return (
    <div>
      <WavyHeader
        title="Ringkasan Akun"
        actions={
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link to="/wallet" className="btn btn-secondary">
              <Wallet size={16} /> Top-Up Saldo
            </Link>
            <Link to="/campaigns/new" className="btn btn-primary">
              <PlusCircle size={17} /> Pasang Iklan Baru
            </Link>
          </div>
        }
      />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Saldo Dompet"
            value={formatRupiah(data.wallet_balance_idr)}
            icon={Wallet}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext={`Total terpakai: ${formatRupiah(data.total_spent_idr)}`}
          />
          <KpiCard
            label="Iklan Sedang Tayang"
            value={data.active_campaigns_count}
            icon={Megaphone}
            subtext={`${data.pending_campaigns_count} menunggu persetujuan`}
          />
          <KpiCard
            label="Total Tayangan"
            value={data.total_impressions.toLocaleString('id-ID')}
            icon={Eye}
            iconBoxVariant="secondary"
            subtext="Akumulasi seluruh iklan"
          />
          <KpiCard
            label="Total Klik Promo"
            value={data.total_clicks.toLocaleString('id-ID')}
            icon={MousePointerClick}
            subtext="Kunjungan ke link tujuan"
          />
        </KpiGrid>

        {/* Interactive Trend Chart */}
        <div className="stitch-card-container">
          <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={20} color="#1d4ed8" />
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                  Tren Tayangan &amp; Penggunaan Saldo
                </h3>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '12px', color: '#64748b' }}>
                {rangeImp.toLocaleString('id-ID')} tayangan • {formatRupiah(rangeSpent)} biaya terpakai pada periode ini
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.25rem', background: '#eff4ff', padding: '0.25rem', borderRadius: '8px' }}>
              {[
                { key: 'today', label: 'Hari Ini' },
                { key: '7d', label: '7 Hari' },
                { key: '30d', label: '30 Hari' },
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`preset-btn ${range === b.key ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => {
                    setRange(b.key as typeof range)
                    setHoverIdx(null)
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '1.25rem', background: '#fafcff', display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', fontSize: '12px' }}>
              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1d4ed8' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1d4ed8' }} />
                  Tayangan Iklan
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#059669' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#059669' }} />
                  Klik Promo
                </span>
              </div>

              <Link to="/analytics" style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Lihat Laporan Lengkap <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{ width: '100%', height: '235px', position: 'relative' }}>
              {hoverIdx !== null && series[hoverIdx] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: `${Math.min(82, Math.max(10, (hoverIdx / Math.max(1, series.length - 1)) * 100))}%`,
                    transform: 'translateX(-50%)',
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '6px 11px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{ color: '#93c5fd', fontWeight: 700 }}>{series[hoverIdx].label}</div>
                  <div>Tayangan: {series[hoverIdx].impressions}</div>
                  <div>Klik: {series[hoverIdx].clicks}</div>
                  <div>Biaya: {formatRupiah(series[hoverIdx].spent_idr)}</div>
                </div>
              )}

              <svg style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none" viewBox="0 0 760 215">
                <defs>
                  <linearGradient id="advAreaPrimary" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="40" y2="40" />
                <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="115" y2="115" />
                <line opacity="0.85" stroke="#CBD5E1" strokeWidth="1" x1="0" x2="760" y1="190" y2="190" />

                {geom.impArea && <path d={geom.impArea} fill="url(#advAreaPrimary)" />}
                {geom.impLine && <path d={geom.impLine} fill="none" stroke="#1D4ED8" strokeWidth="2.8" strokeLinecap="round" />}
                {geom.clkLine && <path d={geom.clkLine} fill="none" stroke="#059669" strokeWidth="2.2" strokeDasharray="4 2" strokeLinecap="round" />}

                {geom.impPts.map((pt, idx) => (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={pt.x} cy={pt.y} r={hoverIdx === idx ? 6 : 4} fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="2" />
                    <rect x={pt.x - 30} y={0} width={60} height={200} fill="transparent" />
                  </g>
                ))}
              </svg>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              {series.map((p, idx) => (
                <span key={p.label + idx} style={{ color: hoverIdx === idx ? '#1d4ed8' : '#64748b' }}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
