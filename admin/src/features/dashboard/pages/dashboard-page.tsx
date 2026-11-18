import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Film,
  Gauge,
  Hourglass,
  Image as ImageIcon,
  Router,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import { KpiCard, KpiGrid, StatusPill, WavyHeader } from '@/components/ui'
import { useAdvertisements } from '@/features/advertisements/hooks/use-advertisements'
import { useOverview } from '@/features/dashboard/hooks/use-overview'
import type { ChartPoint } from '@/features/dashboard/types/overview.types'
import { formatBytes } from '@/lib/formatters'

function buildSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`
  let path = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const cpX1 = curr.x + (next.x - curr.x) * 0.45
    const cpY1 = curr.y
    const cpX2 = curr.x + (next.x - curr.x) * 0.55
    const cpY2 = next.y
    path += ` C ${cpX1.toFixed(1)},${cpY1.toFixed(1)} ${cpX2.toFixed(1)},${cpY2.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`
  }
  return path
}

export function DashboardPage() {
  const { data, isPending, error } = useOverview()
  const { data: adsData } = useAdvertisements()
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const activeSeries: ChartPoint[] = useMemo(() => {
    if (!data) return []
    if (timeRange === '7d' && data.trend_7d?.length) return data.trend_7d
    if (timeRange === '30d' && data.trend_30d?.length) return data.trend_30d
    if (data.trend_today?.length) return data.trend_today
    return [
      { label: '00:00', impressions: 0, logins: 0 },
      { label: '03:00', impressions: 0, logins: 0 },
      { label: '06:00', impressions: 0, logins: 0 },
      { label: '09:00', impressions: 0, logins: 0 },
      { label: '12:00', impressions: 0, logins: 0 },
      { label: '15:00', impressions: 0, logins: 0 },
      { label: '18:00', impressions: 0, logins: 0 },
      { label: '21:00', impressions: 0, logins: 0 },
    ]
  }, [data, timeRange])

  const chartGeometry = useMemo(() => {
    const width = 760
    const topY = 26
    const bottomY = 190
    const usableHeight = bottomY - topY

    const maxVal = Math.max(
      4,
      ...activeSeries.map((p) => Math.max(p.impressions || 0, p.logins || 0))
    )

    const count = activeSeries.length
    const stepX = count > 1 ? width / (count - 1) : width

    const impPoints = activeSeries.map((p, idx) => ({
      x: idx * stepX,
      y: bottomY - ((p.impressions || 0) / maxVal) * usableHeight,
      val: p.impressions || 0,
      label: p.label,
    }))

    const loginPoints = activeSeries.map((p, idx) => ({
      x: idx * stepX,
      y: bottomY - ((p.logins || 0) / maxVal) * usableHeight,
      val: p.logins || 0,
      label: p.label,
    }))

    const impLine = buildSmoothSvgPath(impPoints)
    const impArea = impLine ? `${impLine} L ${width},${bottomY} L 0,${bottomY} Z` : ''
    const loginLine = buildSmoothSvgPath(loginPoints)
    const loginArea = loginLine ? `${loginLine} L ${width},${bottomY} L 0,${bottomY} Z` : ''

    return {
      maxVal,
      bottomY,
      impPoints,
      loginPoints,
      impLine,
      impArea,
      loginLine,
      loginArea,
    }
  }, [activeSeries])

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat ringkasan dashboard." />

  const claimedTotal = (data.used_vouchers || 0) + (data.active_vouchers || 0)
  const voucherClaimRate =
    data.total_vouchers > 0 ? ((claimedTotal / data.total_vouchers) * 100).toFixed(1) : '0'

  const activeAds = adsData || []
  const avgAdSeconds =
    activeAds.length > 0
      ? Math.round(activeAds.reduce((acc, a) => acc + (a.duration_seconds || 15), 0) / activeAds.length)
      : data.avg_ad_duration_seconds || 10

  const totalTrafficBytes = (data.total_input_octets || 0) + (data.total_output_octets || 0)
  const totalImpressionsInRange = activeSeries.reduce((acc, p) => acc + p.impressions, 0)
  const totalLoginsInRange = activeSeries.reduce((acc, p) => acc + p.logins, 0)

  return (
    <div>
      <WavyHeader title="Dashboard" />

      <div className="stitch-page-stage">
        {/* 4 Main KPI Cards */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Perangkat Terhubung"
            value={data.active_devices}
            icon={Smartphone}
            subtext="Sedang menggunakan Wi-Fi"
          />

          <KpiCard
            label="Menunggu di Portal"
            value={data.pending_devices}
            icon={Hourglass}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            subtext="Sedang menonton iklan"
          />

          <KpiCard
            label="Voucher Terpakai"
            value={claimedTotal}
            icon={CheckCircle2}
            iconBoxVariant="secondary"
            trend={{ label: `${voucherClaimRate}%` }}
            subtext={`Dari total ${data.total_vouchers} voucher`}
          />

          <KpiCard
            label="Sesi Aktif"
            value={data.active_sessions}
            icon={Activity}
            subtext="Sesi internet sedang berjalan"
          />
        </KpiGrid>

        {/* Visual Charts & Active Ads Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* LEFT: Live Area Chart */}
          <div className="stitch-card-container" style={{ gridColumn: 'span 2', minWidth: '320px' }}>
            <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <TrendingUp size={20} style={{ color: '#1d4ed8' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>
                    Statistik Tayangan Iklan &amp; Login Pengguna
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.25rem' }}>
                  Total {totalImpressionsInRange} tayangan iklan dan {totalLoginsInRange} sesi login pada periode ini
                </p>
              </div>

              {/* Time Range Selector */}
              <div style={{ display: 'flex', gap: '0.25rem', background: '#eff4ff', padding: '0.25rem', borderRadius: '8px' }}>
                <button
                  type="button"
                  className={`preset-btn ${timeRange === 'today' ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => {
                    setTimeRange('today')
                    setHoveredIdx(null)
                  }}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  className={`preset-btn ${timeRange === '7d' ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => {
                    setTimeRange('7d')
                    setHoveredIdx(null)
                  }}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  className={`preset-btn ${timeRange === '30d' ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => {
                    setTimeRange('30d')
                    setHoveredIdx(null)
                  }}
                >
                  30 Hari
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem', background: '#fafcff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Legend & Peak Hour Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1d4ed8' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1d4ed8' }}></span>
                    Tayangan Iklan ({totalImpressionsInRange})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#00668a' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#00668a' }}></span>
                    Sesi Login ({totalLoginsInRange})
                  </span>
                </div>

                {data.peak_window_label && (
                  <span
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '11px',
                    }}
                  >
                    Waktu Ramai: {data.peak_window_label}
                  </span>
                )}
              </div>

              {/* Dynamic Interactive SVG Area Chart */}
              <div style={{ width: '100%', height: '240px', position: 'relative' }}>
                {hoveredIdx !== null && activeSeries[hoveredIdx] && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: `${Math.min(82, Math.max(8, (hoveredIdx / Math.max(1, activeSeries.length - 1)) * 100))}%`,
                      transform: 'translateX(-50%)',
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '6px 11px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.25)',
                      pointerEvents: 'none',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ color: '#93c5fd', fontWeight: 700, marginBottom: '2px' }}>
                      {activeSeries[hoveredIdx].label}
                    </div>
                    <div>Tayangan Iklan: {activeSeries[hoveredIdx].impressions}</div>
                    <div>Sesi Login: {activeSeries[hoveredIdx].logins}</div>
                  </div>
                )}

                <svg
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  preserveAspectRatio="none"
                  viewBox="0 0 760 215"
                >
                  <defs>
                    <linearGradient id="stitchPrimaryArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.32"></stop>
                      <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0"></stop>
                    </linearGradient>
                    <linearGradient id="stitchSecondaryArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#00668A" stopOpacity="0.24"></stop>
                      <stop offset="100%" stopColor="#00668A" stopOpacity="0.0"></stop>
                    </linearGradient>
                  </defs>

                  <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="35" y2="35"></line>
                  <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="86" y2="86"></line>
                  <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="138" y2="138"></line>
                  <line opacity="0.85" stroke="#CBD5E1" strokeWidth="1" x1="0" x2="760" y1="190" y2="190"></line>

                  {chartGeometry.impArea && (
                    <path
                      d={chartGeometry.impArea}
                      fill="url(#stitchPrimaryArea)"
                      style={{ transition: 'd 0.35s ease' }}
                    />
                  )}
                  {chartGeometry.loginArea && (
                    <path
                      d={chartGeometry.loginArea}
                      fill="url(#stitchSecondaryArea)"
                      style={{ transition: 'd 0.35s ease' }}
                    />
                  )}

                  {chartGeometry.impLine && (
                    <path
                      d={chartGeometry.impLine}
                      fill="none"
                      stroke="#1D4ED8"
                      strokeLinecap="round"
                      strokeWidth="2.8"
                      style={{ transition: 'd 0.35s ease' }}
                    />
                  )}
                  {chartGeometry.loginLine && (
                    <path
                      d={chartGeometry.loginLine}
                      fill="none"
                      stroke="#00668A"
                      strokeDasharray="4 2"
                      strokeLinecap="round"
                      strokeWidth="2.2"
                      style={{ transition: 'd 0.35s ease' }}
                    />
                  )}

                  {chartGeometry.impPoints.map((pt, idx) => {
                    const loginPt = chartGeometry.loginPoints[idx]
                    const isHovered = hoveredIdx === idx
                    return (
                      <g
                        key={pt.label + idx}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {isHovered && (
                          <line
                            x1={pt.x}
                            x2={pt.x}
                            y1={20}
                            y2={190}
                            stroke="#93c5fd"
                            strokeDasharray="3 3"
                            strokeWidth="1.5"
                          />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4}
                          fill="#1D4ED8"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        {loginPt && (
                          <circle
                            cx={loginPt.x}
                            cy={loginPt.y}
                            r={isHovered ? 5 : 3.5}
                            fill="#00668A"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        )}
                        <rect
                          x={pt.x - 30}
                          y={0}
                          width={60}
                          height={200}
                          fill="transparent"
                        />
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Dynamic Bottom X-Axis Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                {activeSeries.map((pt, idx) => (
                  <span
                    key={pt.label + idx}
                    style={{
                      color: hoveredIdx === idx ? '#1d4ed8' : '#64748b',
                      fontWeight: hoveredIdx === idx ? 800 : 600,
                    }}
                  >
                    {pt.label}
                  </span>
                ))}
              </div>

              {/* 3 Summary Metric Tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.85rem',
                  marginTop: '0.5rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <Timer size={22} style={{ color: '#00668a' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Rata-rata Durasi Iklan</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>{avgAdSeconds} Detik</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <ShieldCheck size={22} style={{ color: '#1d4ed8' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Keberhasilan Login</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>
                      {(data.login_success_rate ?? 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <Gauge size={22} style={{ color: '#00668a' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Total Pemakaian Data</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>
                      {formatBytes(totalTrafficBytes)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Active Ads Card */}
          <div className="stitch-card-container">
            <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>Iklan Aktif</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Materi iklan yang sedang tayang
                </span>
              </div>

              <Link
                to="/advertisements"
                style={{
                  fontSize: '12px',
                  color: '#1d4ed8',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  textDecoration: 'none',
                }}
              >
                Lihat Semua <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeAds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  <Sparkles size={24} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Belum ada materi iklan terpasang.</p>
                  <Link
                    to="/advertisements/new"
                    className="btn btn-secondary"
                    style={{ marginTop: '0.75rem', display: 'inline-flex', fontSize: '12px' }}
                  >
                    + Tambah Iklan
                  </Link>
                </div>
              ) : (
                activeAds.slice(0, 4).map((ad) => (
                  <div
                    key={ad.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '8px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {ad.media_type === 'video' ? <Film size={20} /> : <ImageIcon size={20} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#0b1c30',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ad.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <StatusPill
                          variant={ad.is_active ? 'active' : 'neutral'}
                          dot={ad.is_active}
                          style={{ fontSize: '10px', padding: '1px 6px' }}
                        >
                          {ad.is_active ? 'Aktif' : 'Nonaktif'}
                        </StatusPill>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Urutan #{ad.sort_order} • {ad.duration_seconds || 15} dtk
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ringkasan Voucher Container */}
        <div className="stitch-card-container">
          <div className="table-toolbar">
            <div className="table-toolbar-title">
              <Router size={20} style={{ color: '#1d4ed8' }} />
              <h3>Ringkasan Voucher</h3>
            </div>
          </div>

          <div
            style={{
              padding: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span className="kpi-label">Voucher Siap Pakai</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0b1c30', marginTop: '0.4rem' }}>
                {data.issued_vouchers}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>
                Kode voucher sudah diterbitkan dan siap digunakan untuk login.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span className="kpi-label">Voucher Sedang Aktif</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#166534', marginTop: '0.4rem' }}>
                {data.active_vouchers}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>
                Pengguna sedang terhubung ke internet menggunakan voucher ini.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span className="kpi-label">Total Voucher Diterbitkan</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8', marginTop: '0.4rem' }}>
                {data.total_vouchers}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>
                Keseluruhan voucher yang pernah dibuat di sistem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
