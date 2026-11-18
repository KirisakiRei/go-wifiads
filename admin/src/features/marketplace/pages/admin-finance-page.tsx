import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  MapPin,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import { formatDate, formatRupiah } from '@/lib/formatters'

function buildSmoothPath(points: { x: number; y: number }[]): string {
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

export function AdminFinancePage() {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('30d')
  const [tab, setTab] = useState<'routers' | 'ledger'>('routers')
  const [txPage, setTxPage] = useState(1)
  const [txType, setTxType] = useState('')

  const { data: finance, isPending } = useQuery({
    queryKey: ['admin-finance', range],
    queryFn: () => adminMarketplaceApi.getFinanceSummary(range),
  })

  const { data: ledgerRes } = useQuery({
    queryKey: ['admin-global-ledger', txPage, txType],
    queryFn: () =>
      adminMarketplaceApi.listGlobalTransactions({
        page: txPage,
        per_page: 20,
        type: txType || undefined,
      }),
    enabled: tab === 'ledger',
  })

  const chartData = useMemo(() => {
    const series = finance?.series || []
    const width = 760
    const topY = 24
    const bottomY = 185
    const usable = bottomY - topY
    const maxVal = Math.max(
      100,
      ...series.map((p) => Math.max(p.gross_ad_spend_idr, p.net_platform_idr, p.partner_share_idr))
    )
    const stepX = series.length > 1 ? width / (series.length - 1) : width

    const grossPts = series.map((p, idx) => ({
      x: idx * stepX,
      y: bottomY - (p.gross_ad_spend_idr / maxVal) * usable,
      label: p.label,
      gross: p.gross_ad_spend_idr,
      net: p.net_platform_idr,
      partner: p.partner_share_idr,
    }))
    const netPts = series.map((p, idx) => ({
      x: idx * stepX,
      y: bottomY - (p.net_platform_idr / maxVal) * usable,
    }))
    const partnerPts = series.map((p, idx) => ({
      x: idx * stepX,
      y: bottomY - (p.partner_share_idr / maxVal) * usable,
    }))

    const grossLine = buildSmoothPath(grossPts)
    const netLine = buildSmoothPath(netPts)
    const netArea = netLine ? `${netLine} L ${width},${bottomY} L 0,${bottomY} Z` : ''
    const partnerLine = buildSmoothPath(partnerPts)

    return { width, bottomY, grossPts, grossLine, netLine, netArea, partnerLine }
  }, [finance])

  if (isPending || !finance) return <LoadingState />

  const ledgerItems = ledgerRes?.data || []
  const ledgerMeta = ledgerRes?.meta

  return (
    <div>
      <WavyHeader
        title="Laporan Keuangan Platform"
        actions={
          <div
            style={{
              display: 'inline-flex',
              background: '#ffffff',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
            }}
          >
            {[
              { k: 'today', label: 'Hari Ini' },
              { k: '7d', label: '7 Hari' },
              { k: '30d', label: '30 Hari' },
            ].map((item) => (
              <button
                key={item.k}
                type="button"
                onClick={() => setRange(item.k as 'today' | '7d' | '30d')}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: range === item.k ? '#2563eb' : 'transparent',
                  color: range === item.k ? '#ffffff' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="stitch-page-stage">
        {/* Core Revenue & Payout KPIs */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Kas Masuk Top-Up"
            value={formatRupiah(finance.total_topup_paid_idr)}
            icon={ArrowDownLeft}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext={`Periode ini: ${formatRupiah(finance.period_topup_paid_idr)}`}
          />
          <KpiCard
            label="Total Belanja Tayang (Kotor)"
            value={formatRupiah(finance.total_gross_ad_spend_idr)}
            icon={TrendingUp}
            subtext={`Periode ini: ${formatRupiah(finance.period_gross_ad_spend_idr)}`}
          />
          <KpiCard
            label="Bagian Mitra (Pengeluaran)"
            value={formatRupiah(finance.total_partner_share_idr)}
            icon={Store}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            subtext={`Sudah dicairkan: ${formatRupiah(finance.total_withdrawals_paid_idr)}`}
          />
          <KpiCard
            label="Pendapatan Bersih Platform"
            value={formatRupiah(finance.total_net_platform_idr)}
            icon={Landmark}
            iconBoxVariant="secondary"
            subtext={`Periode ini: ${formatRupiah(finance.period_net_platform_idr)}`}
          />
        </KpiGrid>

        {/* Chart + Liability Strip */}
        <div
          className="stitch-card-container"
          style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1.15rem' }}
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
                Grafik Arus Pendapatan Tayangan Iklan
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Perbandingan belanja iklan kotor, bagi hasil mitra lokasi, dan pendapatan bersih platform.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }}
                />
                Bersih Platform
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8' }}
                />
                Belanja Kotor
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}
                />
                Bagian Mitra
              </span>
            </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox="0 0 760 215" style={{ width: '100%', minWidth: '520px', height: '215px' }}>
              <defs>
                <linearGradient id="netRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
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

              {chartData.netArea && <path d={chartData.netArea} fill="url(#netRevGrad)" />}
              {chartData.grossLine && (
                <path
                  d={chartData.grossLine}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              )}
              {chartData.partnerLine && (
                <path d={chartData.partnerLine} fill="none" stroke="#f59e0b" strokeWidth="2.2" />
              )}
              {chartData.netLine && (
                <path d={chartData.netLine} fill="none" stroke="#2563eb" strokeWidth="3" />
              )}

              {chartData.grossPts.map((pt, i) => (
                <text
                  key={i}
                  x={pt.x}
                  y={206}
                  fontSize="11"
                  fill="#64748b"
                  textAnchor={
                    i === 0 ? 'start' : i === chartData.grossPts.length - 1 ? 'end' : 'middle'
                  }
                >
                  {pt.label}
                </text>
              ))}
            </svg>
          </div>

          {/* Deposit & Liability Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '0.8rem 1rem',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#64748b', display: 'block' }}>
                Sisa Deposit Dompet Pengiklan
              </span>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                {formatRupiah(finance.total_client_wallet_idr)}
              </strong>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '0.8rem 1rem',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#64748b', display: 'block' }}>
                Saldo Siap Cair Dompet Mitra
              </span>
              <strong style={{ fontSize: '15px', color: '#065f46' }}>
                {formatRupiah(finance.total_partner_wallet_idr)}
              </strong>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '0.8rem 1rem',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#64748b', display: 'block' }}>
                Antrean Pencairan Mitra ({finance.pending_withdrawals_count})
              </span>
              <strong style={{ fontSize: '15px', color: '#d97706' }}>
                {formatRupiah(finance.pending_withdrawals_idr)}
              </strong>
            </div>
          </div>
        </div>

        {/* Sub-Tabs: Router Revenue Breakdown vs Global Wallet Ledger */}
        <div
          style={{
            display: 'flex',
            gap: '0.45rem',
            background: '#ffffff',
            padding: '0.4rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'fit-content',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('routers')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'routers' ? '#2563eb' : 'transparent',
              color: tab === 'routers' ? '#ffffff' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Pendapatan per Lokasi / Mitra
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'ledger' ? '#2563eb' : 'transparent',
              color: tab === 'ledger' ? '#ffffff' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Buku Mutasi Saldo Pengiklan
          </button>
        </div>

        {tab === 'routers' ? (
          <DataTableCard title="Rekap Pendapatan per Titik Lokasi Router" icon={MapPin}>
            {finance.by_router.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Belum ada realisasi tayangan iklan berbayar pada periode ini." />
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Lokasi / Mitra</th>
                      <th>Rank</th>
                      <th>Tayang &amp; Klik</th>
                      <th>Belanja Kotor</th>
                      <th>Bagian Mitra</th>
                      <th style={{ textAlign: 'right' }}>Bersih Platform</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.by_router.map((r) => (
                      <tr key={r.router_id}>
                        <td>
                          <strong style={{ display: 'block', color: '#0f172a' }}>
                            {r.venue_name}
                          </strong>
                          <small style={{ color: '#64748b' }}>
                            Router: {r.router_name}
                            {r.partner_name ? ` • Mitra: ${r.partner_name}` : ' • Tanpa Mitra'}
                          </small>
                        </td>
                        <td>
                          <StatusPill variant="basic">{r.tier_name}</StatusPill>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <strong>{r.impressions.toLocaleString('id-ID')}</strong> tayang •{' '}
                          {r.clicks} klik
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatRupiah(r.gross_ad_spend_idr)}</td>
                        <td style={{ color: '#b45309', fontWeight: 600 }}>
                          {formatRupiah(r.partner_share_idr)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#065f46' }}>
                          {formatRupiah(r.net_platform_idr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataTableCard>
        ) : (
          <DataTableCard
            title="Buku Mutasi Saldo Seluruh Pengiklan"
            icon={Wallet}
            toolbarActions={
              <select
                value={txType}
                onChange={(e) => {
                  setTxType(e.target.value)
                  setTxPage(1)
                }}
                style={{ padding: '0.5rem 0.85rem' }}
              >
                <option value="">Semua Jenis Transaksi</option>
                <option value="TOPUP">Top-Up Masuk</option>
                <option value="AD_IMPRESSION">Potongan Tayang Iklan</option>
                <option value="ADMIN_ADJUSTMENT">Penyesuaian Admin</option>
              </select>
            }
          >
            {ledgerItems.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Belum ada riwayat mutasi saldo." />
              </div>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Pengiklan</th>
                        <th>Keterangan</th>
                        <th>Nominal</th>
                        <th style={{ textAlign: 'right' }}>Saldo Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerItems.map((tx) => {
                        const isCredit = tx.amount_idr >= 0
                        return (
                          <tr key={tx.id}>
                            <td style={{ fontSize: '12px', color: '#64748b' }}>
                              {formatDate(tx.created_at)}
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              <strong>{tx.advertiser_name || 'Pengiklan'}</strong>
                              {tx.advertiser_company && (
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {tx.advertiser_company}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: '12px' }}>{tx.description}</td>
                            <td>
                              <strong
                                style={{
                                  color: isCredit ? '#16a34a' : '#dc2626',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                {isCredit ? (
                                  <ArrowDownLeft size={13} />
                                ) : (
                                  <ArrowUpRight size={13} />
                                )}
                                {isCredit ? '+' : ''}
                                {formatRupiah(tx.amount_idr)}
                              </strong>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatRupiah(tx.balance_after_idr)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {ledgerMeta && ledgerMeta.total_pages > 1 && (
                  <Pagination meta={ledgerMeta} onPageChange={setTxPage} />
                )}
              </>
            )}
          </DataTableCard>
        )}
      </div>
    </div>
  )
}
