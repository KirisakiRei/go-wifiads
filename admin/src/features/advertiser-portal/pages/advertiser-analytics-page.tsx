import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Download,
  Eye,
  MapPin,
  MousePointerClick,
  Percent,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import { DataTableCard, KpiCard, KpiGrid, WavyHeader } from '@/components/ui'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import { formatRupiah } from '@/lib/formatters'

function smoothSvg(points: { x: number; y: number }[]): string {
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

export function AdvertiserAnalyticsPage() {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  const [campaignId, setCampaignId] = useState('')
  const [routerId, setRouterId] = useState('')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { data: campaignsRes } = useQuery({
    queryKey: ['adv-campaigns-all'],
    queryFn: () => advertiserApi.listCampaigns({ page: 1, per_page: 100 }),
  })
  const { data: mapRouters = [] } = useQuery({
    queryKey: ['adv-map-routers'],
    queryFn: advertiserApi.listMapRouters,
  })
  const { data, isPending } = useQuery({
    queryKey: ['adv-analytics', range, campaignId, routerId],
    queryFn: () =>
      advertiserApi.getAnalytics({
        range,
        campaign_id: campaignId || undefined,
        router_id: routerId || undefined,
      }),
  })

  const series = data?.series || []
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
    const impLine = smoothSvg(impPts)
    const impArea = impLine ? `${impLine} L ${width},${bottomY} L 0,${bottomY} Z` : ''
    const clkLine = smoothSvg(clkPts)
    return { impPts, impLine, impArea, clkLine }
  }, [series])

  if (isPending || !data) return <LoadingState />

  const handleExportCsv = () => {
    const headers = ['Lokasi Router', 'Kategori', 'Alamat', 'Tayangan', 'Klik Promo', 'CTR (%)', 'Biaya Terpakai (Rp)']
    const rows = data.by_router.map((r) => [
      `"${r.router_name.replace(/"/g, '""')}"`,
      `"${r.venue_category || ''}"`,
      `"${(r.location_address || '').replace(/"/g, '""')}"`,
      r.impressions,
      r.clicks,
      r.ctr_percent,
      r.spent_idr,
    ])
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-iklan-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <WavyHeader
        title="Laporan & Statistik"
        actions={
          <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={16} /> Unduh Laporan CSV
          </button>
        }
      />

      <div className="stitch-page-stage">
        {/* Filter Bar */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.3rem', background: '#eff4ff', padding: '0.25rem', borderRadius: '8px' }}>
            {[
              { key: 'today', label: 'Hari Ini' },
              { key: '7d', label: '7 Hari Terakhir' },
              { key: '30d', label: '30 Hari Terakhir' },
            ].map((b) => (
              <button
                key={b.key}
                type="button"
                className={`preset-btn ${range === b.key ? 'active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '12px' }}
                onClick={() => setRange(b.key as typeof range)}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '13px' }}
            >
              <option value="">Semua Iklan Saya</option>
              {(campaignsRes?.data || []).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            <select
              value={routerId}
              onChange={(e) => setRouterId(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '13px' }}
            >
              <option value="">Semua Lokasi Router</option>
              {mapRouters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 KPI Summary */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Tayangan Periode Ini"
            value={data.total_impressions.toLocaleString('id-ID')}
            icon={Eye}
            subtext={`Klik: ${data.total_clicks.toLocaleString('id-ID')} (CTR ${data.ctr_percent}%)`}
          />
          <KpiCard
            label="Tonton Selesai"
            value={`${data.completion_rate_percent ?? 0}%`}
            icon={Percent}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext={
              (data.total_completions ?? 0) > 0
                ? `${(data.total_completions ?? 0).toLocaleString('id-ID')} selesai · rata-rata ${data.avg_watch_seconds ?? 0} dtk`
                : 'Belum ada data selesai tonton'
            }
          />
          <KpiCard
            label="Klik Promo"
            value={data.total_clicks.toLocaleString('id-ID')}
            icon={MousePointerClick}
            iconBoxVariant="secondary"
            subtext={`Rasio klik (CTR) ${data.ctr_percent}%`}
          />
          <KpiCard
            label="Biaya Terpakai"
            value={formatRupiah(data.total_spent_idr)}
            icon={Wallet}
            subtext="Sesuai periode & filter"
          />
        </KpiGrid>

        {/* Visual Area Chart */}
        <div className="stitch-card-container">
          <div className="table-toolbar">
            <div className="table-toolbar-title">
              <BarChart3 size={20} color="#1d4ed8" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>Grafik Tayangan &amp; Klik Promo</h3>
            </div>
          </div>

          <div style={{ padding: '1.25rem', background: '#fafcff', display: 'grid', gap: '0.85rem' }}>
            <div style={{ width: '100%', height: '230px', position: 'relative' }}>
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
                  <linearGradient id="anaGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="40" y2="40" />
                <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="115" y2="115" />
                <line opacity="0.85" stroke="#CBD5E1" strokeWidth="1" x1="0" x2="760" y1="190" y2="190" />

                {geom.impArea && <path d={geom.impArea} fill="url(#anaGrad)" />}
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
                <span key={p.label + idx}>{p.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown by Router Location */}
        <DataTableCard title="Rincian Performa per Lokasi Router" icon={MapPin}>
          {data.by_router.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada data tayangan pada periode dan filter ini." />
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Lokasi Router</th>
                    <th>Kategori</th>
                    <th>Tayangan</th>
                    <th>Klik Promo</th>
                    <th>Rasio Klik</th>
                    <th>Biaya Terpakai</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_router.map((r) => (
                    <tr key={r.router_id}>
                      <td>
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{r.router_name}</strong>
                        {r.location_address && <small style={{ color: '#64748b' }}>{r.location_address}</small>}
                      </td>
                      <td>{r.venue_category || 'Kafe'}</td>
                      <td><strong>{r.impressions.toLocaleString('id-ID')}</strong></td>
                      <td><strong>{r.clicks.toLocaleString('id-ID')}</strong></td>
                      <td>{r.ctr_percent}%</td>
                      <td><strong style={{ color: '#065f46' }}>{formatRupiah(r.spent_idr)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
