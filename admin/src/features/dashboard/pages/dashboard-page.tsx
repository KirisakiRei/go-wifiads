import { useState } from 'react'
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

export function DashboardPage() {
  const { data, isPending, error } = useOverview()
  const { data: adsData } = useAdvertisements()
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today')

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat ringkasan operasional." />

  const voucherClaimRate = data.total_vouchers > 0
    ? ((data.used_vouchers / data.total_vouchers) * 100).toFixed(1)
    : '0'

  const activeAds = adsData || []

  return (
    <div>
      <WavyHeader
        title="Dashboard"
      />

      <div className="stitch-page-stage">
        {/* 4 Main KPI Cards */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Perangkat Hotspot Aktif"
            value={data.active_devices}
            icon={Smartphone}
            trend={{ label: 'Live Online', variant: 'success' }}
            footerLeft="Perangkat terhubung portal"
            footerRight="MikroTik Active"
          />

          <KpiCard
            label="Sesi Pengunjung Menunggu Iklan"
            value={data.pending_devices}
            icon={Hourglass}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            trend={{ label: 'Splash Screen', variant: 'warning' }}
            footerLeft="Tahap tayang iklan / survey"
            footerRight="Captive Portal"
          />

          <KpiCard
            label="Voucher Terklaim & Digunakan"
            value={data.used_vouchers}
            icon={CheckCircle2}
            iconBoxVariant="secondary"
            trend={{ label: `${voucherClaimRate}% Claimed` }}
            footerLeft="Tingkat utilisasi portal"
            footerRight={`Total ${data.total_vouchers} Voucher`}
          />

          <KpiCard
            label="Sesi Pengguna Aktif"
            value={data.active_sessions}
            icon={Activity}
            trend={{ label: 'Terhubung', variant: 'success' }}
            footerLeft="Layanan Autentikasi Aktif"
            footerRight="Waktu Nyata"
          />
        </KpiGrid>

        {/* Visual Charts & Top Performing Campaigns Grid (Stitch 65% / 35% Layout) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* LEFT: Hourly Impressions & Peak Hours Area Chart */}
          <div className="stitch-card-container" style={{ gridColumn: 'span 2', minWidth: '320px' }}>
            <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={20} style={{ color: '#1d4ed8' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>
                    Tren Tayangan Iklan &amp; Login Pengunjung Hotspot
                  </h3>
                  <span className="live-badge" style={{ background: '#dce1ff', color: '#0037b0' }}>
                    24 Jam Terakhir
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.25rem' }}>
                  Analisis beban traffic jam sibuk (Peak Hours) penayangan video splash &amp; web login captive portal
                </p>
              </div>

              {/* Time Range Selector */}
              <div style={{ display: 'flex', gap: '0.25rem', background: '#eff4ff', padding: '0.25rem', borderRadius: '8px' }}>
                <button
                  type="button"
                  className={`preset-btn ${timeRange === 'today' ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => setTimeRange('today')}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  className={`preset-btn ${timeRange === '7d' ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => setTimeRange('7d')}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  className={`preset-btn ${timeRange === '30d' ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '12px' }}
                  onClick={() => setTimeRange('30d')}
                >
                  30 Hari
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem', background: '#fafcff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Legend & Peak Hour Telemetry Strip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1d4ed8' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1d4ed8' }}></span>
                    Tayangan Iklan Hotspot
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#00668a' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#00668a' }}></span>
                    Login Sesi Baru
                  </span>
                </div>

                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '11px' }}>
                  Puncak Traffic: 11:30 - 13:30 &amp; 19:00 - 21:00 WIB
                </span>
              </div>

              {/* Responsive SVG Area Chart from Google Stitch */}
              <div style={{ width: '100%', height: '240px', position: 'relative' }}>
                <svg
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  preserveAspectRatio="none"
                  viewBox="0 0 760 220"
                >
                  <defs>
                    <linearGradient id="stitchPrimaryArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.3"></stop>
                      <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0"></stop>
                    </linearGradient>
                    <linearGradient id="stitchSecondaryArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#00668A" stopOpacity="0.25"></stop>
                      <stop offset="100%" stopColor="#00668A" stopOpacity="0.0"></stop>
                    </linearGradient>
                  </defs>

                  {/* Grid reference lines */}
                  <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="40" y2="40"></line>
                  <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="90" y2="90"></line>
                  <line opacity="0.4" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="760" y1="140" y2="140"></line>
                  <line opacity="0.8" stroke="#CBD5E1" strokeWidth="1" x1="0" x2="760" y1="190" y2="190"></line>

                  {/* Highlight Peak Hour 1: Makan Siang 11:00-14:00 (x approx 300 to 410) */}
                  <rect fill="#E0F2FE" height="170" opacity="0.5" rx="6" width="110" x="300" y="20"></rect>
                  {/* Highlight Peak Hour 2: Malam 18:00-21:00 (x approx 540 to 660) */}
                  <rect fill="#E0F2FE" height="180" opacity="0.5" rx="6" width="120" x="540" y="10"></rect>

                  {/* Area Fill 1: Impressions Curve */}
                  <path
                    d="M 0,170 C 60,165 120,175 180,160 C 240,140 280,70 340,55 C 390,45 420,110 480,115 C 530,120 570,35 630,25 C 680,20 720,80 760,95 L 760,190 L 0,190 Z"
                    fill="url(#stitchPrimaryArea)"
                  ></path>

                  {/* Stroke Line 1: Tayangan Iklan */}
                  <path
                    d="M 0,170 C 60,165 120,175 180,160 C 240,140 280,70 340,55 C 390,45 420,110 480,115 C 530,120 570,35 630,25 C 680,20 720,80 760,95"
                    fill="none"
                    stroke="#1D4ED8"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  ></path>

                  {/* Stroke Line 2: Login Sesi Baru */}
                  <path
                    d="M 0,182 C 60,180 120,185 180,175 C 240,160 280,115 340,98 C 390,90 420,135 480,140 C 530,145 570,85 630,68 C 680,60 720,120 760,135"
                    fill="none"
                    stroke="#00668A"
                    strokeDasharray="4 2"
                    strokeLinecap="round"
                    strokeWidth="2"
                  ></path>

                  {/* Interactive Peak Dots */}
                  <circle cx="340" cy="55" fill="#1D4ED8" r="4.5" stroke="#FFFFFF" strokeWidth="2"></circle>
                  <circle cx="630" cy="25" fill="#1D4ED8" r="5" stroke="#FFFFFF" strokeWidth="2.5"></circle>
                </svg>
              </div>

              {/* Bottom Time Axis */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span style={{ color: '#1d4ed8', fontWeight: 700 }}>11:30 (Makan Siang)</span>
                <span>15:00</span>
                <span style={{ color: '#1d4ed8', fontWeight: 700 }}>19:30 (Malam)</span>
                <span>23:59</span>
              </div>

              {/* 3 Telemetry Summary Metric Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginTop: '0.5rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <Timer size={22} style={{ color: '#00668a' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Rerata Durasi Tayang</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>14.6 Detik</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <ShieldCheck size={22} style={{ color: '#1d4ed8' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Validasi Login Sukses</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>99.41%</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <Gauge size={22} style={{ color: '#00668a' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Throughput Fleet</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>438 Mbps</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Top Performing Campaigns Card */}
          <div className="stitch-card-container">
            <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>
                  Kampanye Iklan Aktif
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Materi promosi tayang di captive portal
                </span>
              </div>

              <Link to="/advertisements" style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'none' }}>
                Lihat Semua <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeAds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  <Sparkles size={24} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Belum ada materi iklan terpasang.</p>
                  <Link to="/advertisements/new" className="btn btn-secondary" style={{ marginTop: '0.75rem', display: 'inline-flex', fontSize: '12px' }}>
                    + Pasang Iklan Pertama
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
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0b1c30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ad.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <StatusPill variant={ad.is_active ? 'active' : 'neutral'} dot={ad.is_active} style={{ fontSize: '10px', padding: '1px 6px' }}>
                          {ad.is_active ? 'Aktif' : 'Draft'}
                        </StatusPill>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {ad.duration_seconds || 15}s • {ad.layout_mode}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Fleet & Voucher Status Container */}
        <div className="stitch-card-container">
          <div className="table-toolbar">
            <div className="table-toolbar-title">
              <Router size={20} style={{ color: '#1d4ed8' }} />
              <h3>Status Router &amp; Distribusi Voucher Hotspot</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <StatusPill variant="active">Jaringan Router Aktif</StatusPill>
              <StatusPill variant="basic">Pencatatan Sesi Berjalan</StatusPill>
            </div>
          </div>

          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span className="kpi-label">Stok Voucher Siap Pakai</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0b1c30', marginTop: '0.4rem' }}>
                {data.issued_vouchers}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>
                Voucher telah digenerate dan siap login sebelum masa kedaluwarsa TTL habis.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span className="kpi-label">Voucher Sedang Aktif di Router</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#166534', marginTop: '0.4rem' }}>
                {data.active_vouchers}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>
                User saat ini sedang terhubung dan mengonsumsi kuota bandwidth sesuai profil paket.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span className="kpi-label">Total Volume Voucher</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8', marginTop: '0.4rem' }}>
                {data.total_vouchers}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>
                Akumulasi seluruh voucher yang pernah diterbitkan oleh portal atau admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
