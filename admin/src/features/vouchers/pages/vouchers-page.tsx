import {
  Archive,
  CheckCircle2,
  PlusCircle,
  Ticket,
  Wifi,
} from 'lucide-react'
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
import { formatDate, formatDuration } from '@/lib/formatters'
import { useTableQuery } from '@/hooks/use-table-query'
import { VoucherConfigCard } from '@/features/vouchers/components/voucher-config-card'
import { useVouchers } from '@/features/vouchers/hooks/use-vouchers'

export function VouchersPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const { data, isPending, error } = useVouchers(query)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat voucher." />

  const totalVouchers = data.meta?.total_items || data.data.length
  const claimedCount = data.data.filter((v) => v.status === 'USED' || v.status === 'ACTIVE').length
  const activeCount = data.data.filter((v) => v.status === 'ACTIVE').length
  const issuedCount = data.data.filter((v) => v.status === 'ISSUED').length
  const claimedPercent = totalVouchers > 0 ? Math.round((claimedCount / totalVouchers) * 100) : 0

  return (
    <div>
      <WavyHeader
        title="Manajemen Voucher"
      />

      <div className="stitch-page-stage">
        {/* Telemetry KPI Cards with Stitch Progress Bars */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Voucher Dibuat"
            value={totalVouchers}
            icon={PlusCircle}
            trend={{ label: 'Total Pool' }}
            progressBar={{ percent: 100, color: '#1d4ed8' }}
            footerLeft="Penyimpanan Data Voucher"
            footerRight="Active Tokens"
          />

          <KpiCard
            label="Voucher Terpakai (Claimed)"
            value={claimedCount}
            icon={CheckCircle2}
            iconBoxVariant="secondary"
            trend={{ label: `${claimedPercent}% Claimed` }}
            progressBar={{ percent: claimedPercent, color: '#00668a' }}
            footerLeft="Tingkat utilisasi portal"
            footerRight="Claimed Sessions"
          />

          <KpiCard
            label="Voucher Sedang Aktif"
            value={activeCount}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            trend={{ label: 'Online Now', variant: 'success' }}
            progressBar={{
              percent: totalVouchers > 0 ? (activeCount / totalVouchers) * 100 : 0,
              color: '#10b981',
            }}
            footerLeft="User sedang terkoneksi"
            footerRight="MikroTik DHCP"
          />

          <KpiCard
            label="Siap Pakai (Issued)"
            value={issuedCount}
            icon={Archive}
            trend={{ label: 'Menunggu Login' }}
            progressBar={{
              percent: totalVouchers > 0 ? (issuedCount / totalVouchers) * 100 : 0,
              color: '#545c72',
            }}
            footerLeft="Belum digunakan"
            footerRight="Stok Pool"
          />
        </KpiGrid>

        {/* Router Automated Voucher Policy Configuration */}
        <VoucherConfigCard />

        {/* Main Vouchers Table */}
        <DataTableCard
          title="Daftar Token Voucher Hotspot & Riwayat Sesi"
          icon={Ticket}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari username voucher..."
                style={{ width: '220px' }}
              />

              <select
                value={query.status || ''}
                onChange={(e) => setFilter('status', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Status</option>
                <option value="ISSUED">Issued (Siap Pakai)</option>
                <option value="ACTIVE">Active (Online)</option>
                <option value="USED">Used (Selesai)</option>
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
                      <th>Username Voucher</th>
                      <th>Profil Paket Hotspot</th>
                      <th>Status</th>
                      <th>Dibuat</th>
                      <th>Kedaluwarsa</th>
                      <th>Timeout Sesi</th>
                      <th>Catatan / Peruntukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((x) => {
                      const isActive = x.status === 'ACTIVE'
                      const isIssued = x.status === 'ISSUED'
                      return (
                        <tr key={x.id}>
                          <td>
                            <code style={{ fontSize: '13px', background: '#eff4ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                              {x.username}
                            </code>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontSize: '13px', color: '#0b1c30' }}>
                                {x.profile_name || 'Profil Standar'}
                              </strong>
                              {x.bandwidth_down_kbps ? (
                                <small style={{ color: '#065f46', fontWeight: 600 }}>
                                  ↓ {Math.round(x.bandwidth_down_kbps / 1024)}M / ↑ {Math.round(x.bandwidth_up_kbps || 0) / 1024}M
                                </small>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <StatusPill
                              variant={isActive ? 'active' : isIssued ? 'basic' : 'expired'}
                              dot={isActive}
                            >
                              {x.status}
                            </StatusPill>
                          </td>
                          <td>{formatDate(x.created_at)}</td>
                          <td>{formatDate(x.expires_at)}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                              {formatDuration(x.session_timeout_seconds)}
                            </span>
                          </td>
                          <td>{x.note || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} path="/vouchers" search={searchParams} />
            </>
          ) : (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada voucher yang cocok dengan kriteria pencarian." />
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
