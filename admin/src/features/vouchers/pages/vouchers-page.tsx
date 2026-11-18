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

function formatVoucherStatus(status?: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Aktif'
    case 'ISSUED':
      return 'Siap Pakai'
    case 'USED':
      return 'Selesai'
    case 'EXPIRED':
      return 'Kedaluwarsa'
    default:
      return status || '—'
  }
}

function formatBwLabel(kbps?: number): string {
  if (!kbps || kbps <= 0) return ''
  if (kbps >= 1024) {
    const mb = kbps / 1024
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)} Mbps`
  }
  return `${kbps} Kbps`
}

export function VouchersPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const { data, isPending, error } = useVouchers(query)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat daftar voucher." />

  const totalVouchers = data.meta?.total_items || data.data.length
  const claimedCount = data.data.filter((v) => v.status === 'USED' || v.status === 'ACTIVE').length
  const activeCount = data.data.filter((v) => v.status === 'ACTIVE').length
  const issuedCount = data.data.filter((v) => v.status === 'ISSUED').length
  const claimedPercent = totalVouchers > 0 ? Math.round((claimedCount / totalVouchers) * 100) : 0

  return (
    <div>
      <WavyHeader title="Manajemen Voucher" />

      <div className="stitch-page-stage">
        {/* KPI Cards */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Voucher"
            value={totalVouchers}
            icon={PlusCircle}
            progressBar={{ percent: 100, color: '#1d4ed8' }}
            subtext="Seluruh kode voucher"
          />

          <KpiCard
            label="Voucher Terpakai"
            value={claimedCount}
            icon={CheckCircle2}
            iconBoxVariant="secondary"
            trend={{ label: `${claimedPercent}%` }}
            progressBar={{ percent: claimedPercent, color: '#00668a' }}
            subtext="Telah digunakan login"
          />

          <KpiCard
            label="Sedang Aktif"
            value={activeCount}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            progressBar={{
              percent: totalVouchers > 0 ? (activeCount / totalVouchers) * 100 : 0,
              color: '#10b981',
            }}
            subtext="Sesi internet berjalan"
          />

          <KpiCard
            label="Siap Pakai"
            value={issuedCount}
            icon={Archive}
            progressBar={{
              percent: totalVouchers > 0 ? (issuedCount / totalVouchers) * 100 : 0,
              color: '#545c72',
            }}
            subtext="Belum digunakan"
          />
        </KpiGrid>

        {/* Router Voucher Format Configuration */}
        <VoucherConfigCard />

        {/* Main Vouchers Table */}
        <DataTableCard
          title="Riwayat Voucher"
          icon={Ticket}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari kode voucher..."
                style={{ width: '220px' }}
              />

              <select
                value={query.status || ''}
                onChange={(e) => setFilter('status', e.target.value)}
                style={{ padding: '0.65rem 0.85rem' }}
              >
                <option value="">Semua Status</option>
                <option value="ISSUED">Siap Pakai</option>
                <option value="ACTIVE">Aktif</option>
                <option value="USED">Selesai</option>
                <option value="EXPIRED">Kedaluwarsa</option>
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
                      <th>Kode Voucher</th>
                      <th>Paket</th>
                      <th>Status</th>
                      <th>Waktu Dibuat</th>
                      <th>Berlaku Sampai</th>
                      <th>Durasi</th>
                      <th>Keterangan</th>
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
                                {x.profile_name || 'Standar'}
                              </strong>
                              {x.bandwidth_down_kbps ? (
                                <small style={{ color: '#065f46', fontWeight: 600 }}>
                                  ↓ {formatBwLabel(x.bandwidth_down_kbps)} / ↑ {formatBwLabel(x.bandwidth_up_kbps)}
                                </small>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <StatusPill
                              variant={isActive ? 'active' : isIssued ? 'basic' : 'expired'}
                              dot={isActive}
                            >
                              {formatVoucherStatus(x.status)}
                            </StatusPill>
                          </td>
                          <td>{formatDate(x.created_at)}</td>
                          <td>{formatDate(x.expires_at)}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                              {formatDuration(x.session_timeout_seconds)}
                            </span>
                          </td>
                          <td>
                            {(() => {
                              const rawNote = (x.note || '').trim()
                              if (!rawNote || rawNote.toLowerCase() === 'issued by portal session') {
                                return (
                                  <span style={{ fontSize: '12px', color: '#475569' }}>
                                    {x.expected_mac ? `Perangkat ${x.expected_mac}` : 'Pengunjung Wi-Fi'}
                                  </span>
                                )
                              }
                              const cleaned = rawNote
                                .replace(/^Klaim Captive Portal\s*•\s*/i, '')
                                .replace(/Skip Survey/gi, 'Tanpa Survei')
                                .replace(/Isi Survey/gi, 'Isi Survei')
                              return (
                                <span style={{ fontSize: '12px', color: '#334155' }}>
                                  {cleaned}
                                </span>
                              )
                            })()}
                          </td>
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
              <EmptyState title="Belum ada voucher yang sesuai pencarian." />
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
