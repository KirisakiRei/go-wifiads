import { useState } from 'react'
import {
  Archive,
  Ban,
  CheckCircle2,
  Download,
  Layers,
  PlusCircle,
  Printer,
  Ticket,
  Wifi,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { useProfiles } from '@/features/profiles/hooks/use-profiles'
import { useRouters } from '@/features/routers/use-routers'
import { VoucherConfigCard } from '@/features/vouchers/components/voucher-config-card'
import {
  useCreateVoucherBatch,
  useRevokeVoucher,
  useVouchers,
  useVoucherSummary,
} from '@/features/vouchers/hooks/use-vouchers'
import type { VoucherBatchCreatedResult } from '@/features/vouchers/types/voucher.types'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDate, formatDuration } from '@/lib/formatters'

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
    case 'REVOKED':
      return 'Dicabut'
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
  const { data: summary } = useVoucherSummary()
  const { data: routers = [] } = useRouters()
  const { data: profiles = [] } = useProfiles()
  const revokeMutation = useRevokeVoucher()
  const batchMutation = useCreateVoucherBatch()

  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [batchRouterId, setBatchRouterId] = useState('')
  const [batchProfileId, setBatchProfileId] = useState('')
  const [batchPrefix, setBatchPrefix] = useState('VIP-')
  const [batchQuantity, setBatchQuantity] = useState(20)
  const [batchDigits, setBatchDigits] = useState(6)
  const [batchNumericOnly, setBatchNumericOnly] = useState(false)
  const [batchResult, setBatchResult] = useState<VoucherBatchCreatedResult | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat daftar voucher." />

  const totalVouchers = summary?.total ?? data.meta?.total_items ?? data.data.length
  const activeCount = summary?.active ?? data.data.filter((v) => v.status === 'ACTIVE').length
  const issuedCount = summary?.issued ?? data.data.filter((v) => v.status === 'ISSUED').length
  const usedCount = summary?.used ?? data.data.filter((v) => v.status === 'USED').length
  const revokedCount = summary?.revoked ?? data.data.filter((v) => v.status === 'REVOKED').length

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    batchMutation.mutate(
      {
        name: batchName.trim() || `Batch ${new Date().toLocaleDateString('id-ID')}`,
        router_id: batchRouterId || undefined,
        profile_id: batchProfileId || undefined,
        prefix: batchPrefix.trim() || undefined,
        quantity: Number(batchQuantity),
        digit_count: Number(batchDigits),
        numeric_only: batchNumericOnly,
      },
      {
        onSuccess: (res) => {
          setShowBatchModal(false)
          setBatchResult(res)
          setBatchName('')
          toast.success(`${res.vouchers.length} voucher berhasil dibuat!`)
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal membuat batch voucher'),
      }
    )
  }

  const handleDownloadCsv = (res: VoucherBatchCreatedResult) => {
    const header = 'username,password,profile,router,session_timeout_seconds,expires_at\n'
    const rows = res.vouchers
      .map(
        (v) =>
          `"${v.username}","${v.password}","${v.profile_name || ''}","${res.batch.router_name || ''}",${v.session_timeout_seconds},"${v.expires_at}"`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `voucher-batch-${res.batch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintCards = (res: VoucherBatchCreatedResult) => {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) {
      toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak voucher.')
      return
    }
    const cardsHtml = res.vouchers
      .map(
        (v) => `
      <div class="card">
        <div class="top">${res.batch.router_name || 'WiFiAds Hotspot'}</div>
        <div class="pkg">${v.profile_name || 'Standar'} &bull; ${formatDuration(v.session_timeout_seconds)}</div>
        <div class="cred">
          <div><span>Kode / User</span><strong>${v.username}</strong></div>
          <div><span>Password</span><strong>${v.password}</strong></div>
        </div>
        <div class="exp">Berlaku s/d ${formatDate(v.expires_at)}</div>
      </div>`
      )
      .join('')
    w.document.write(`<!DOCTYPE html><html><head><title>Cetak Voucher - ${res.batch.name}</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;padding:16px;color:#0f172a}
        h2{margin:0 0 12px;font-size:16px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .card{border:1px dashed #64748b;border-radius:8px;padding:10px;page-break-inside:avoid}
        .top{font-weight:700;font-size:12px;color:#1d4ed8}
        .pkg{font-size:11px;color:#475569;margin:2px 0 8px}
        .cred{display:grid;gap:4px;background:#f8fafc;padding:6px 8px;border-radius:6px;font-size:12px}
        .cred div{display:flex;justify-content:space-between}
        .cred span{color:#64748b;font-size:11px}
        .cred strong{font-family:monospace;font-size:13px}
        .exp{font-size:10px;color:#64748b;margin-top:6px;text-align:right}
        @media print { .no-print { display:none } }
      </style></head><body>
      <div class="no-print" style="margin-bottom:12px"><button onclick="window.print()">Cetak Sekarang</button></div>
      <h2>Batch: ${res.batch.name} (${res.vouchers.length} Voucher)</h2>
      <div class="grid">${cardsHtml}</div>
      </body></html>`)
    w.document.close()
  }

  const handleRevoke = (voucherId: string) => {
    revokeMutation.mutate(voucherId, {
      onSuccess: () => {
        setConfirmRevokeId(null)
        toast.success('Voucher berhasil dicabut')
      },
      onError: (err: Error) => toast.error(err.message || 'Gagal mencabut voucher'),
    })
  }

  return (
    <div>
      <WavyHeader
        title="Manajemen Voucher"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!batchRouterId && routers.length > 0) setBatchRouterId(routers[0].id)
              if (!batchProfileId && profiles.length > 0) setBatchProfileId(profiles[0].id)
              setShowBatchModal(true)
            }}
          >
            <Layers size={16} />
            Generate Massal (Batch)
          </button>
        }
      />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Voucher"
            value={totalVouchers}
            icon={PlusCircle}
            subtext={`Selesai: ${usedCount} • Dicabut: ${revokedCount}`}
          />

          <KpiCard
            label="Siap Pakai (Issued)"
            value={issuedCount}
            icon={Archive}
            iconBoxVariant="secondary"
            subtext="Belum digunakan login"
          />

          <KpiCard
            label="Sedang Aktif"
            value={activeCount}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Sesi internet berjalan"
          />

          <KpiCard
            label="Selesai / Dicabut"
            value={usedCount + revokedCount}
            icon={CheckCircle2}
            subtext={`Kedaluwarsa: ${summary?.expired ?? 0}`}
          />
        </KpiGrid>

        <VoucherConfigCard />

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
                <option value="REVOKED">Dicabut</option>
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
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((x) => {
                      const isActive = x.status === 'ACTIVE'
                      const isIssued = x.status === 'ISSUED'
                      const canRevoke = isActive || isIssued
                      const isConfirming = confirmRevokeId === x.id
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
                          <td>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              {formatDate(x.created_at)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#0b1c30' }}>
                              {formatDate(x.expires_at)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#0b1c30' }}>
                              {formatDuration(x.session_timeout_seconds)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {x.note || x.created_by || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {canRevoke ? (
                              isConfirming ? (
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '11px' }}
                                    disabled={revokeMutation.isPending}
                                    onClick={() => handleRevoke(x.id)}
                                  >
                                    Ya, Cabut
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.55rem', fontSize: '11px' }}
                                    onClick={() => setConfirmRevokeId(null)}
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '11px', color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}
                                  onClick={() => setConfirmRevokeId(x.id)}
                                >
                                  <Ban size={12} />
                                  Cabut
                                </button>
                              )
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                            )}
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
              <EmptyState title="Belum ada voucher tercatat." />
            </div>
          )}
        </DataTableCard>
      </div>

      {/* Modal Generate Batch Voucher */}
      {showBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 60,
          }}
          onClick={() => setShowBatchModal(false)}
        >
          <div
            className="stitch-card-container"
            style={{ width: '100%', maxWidth: '500px', padding: '1.5rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Generate Voucher Massal (Batch)
              </h3>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleBatchSubmit} style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="form-field">
                <label>Nama Batch</label>
                <input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Contoh: Tamu VIP Event Seminar"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label>Router</label>
                  <select value={batchRouterId} onChange={(e) => setBatchRouterId(e.target.value)}>
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Profil Paket</label>
                  <select value={batchProfileId} onChange={(e) => setBatchProfileId(e.target.value)}>
                    <option value="">Default Router</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label>Jumlah (1–500)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Prefix</label>
                  <input
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    maxLength={16}
                    placeholder="VIP-"
                  />
                </div>
                <div className="form-field">
                  <label>Panjang Digit</label>
                  <input
                    type="number"
                    min={4}
                    max={12}
                    value={batchDigits}
                    onChange={(e) => setBatchDigits(Number(e.target.value))}
                  />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={batchNumericOnly}
                  onChange={(e) => setBatchNumericOnly(e.target.checked)}
                />
                Hanya gunakan angka (Numeric Only)
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={batchMutation.isPending}>
                  <Layers size={14} />
                  {batchMutation.isPending ? 'Membuat...' : `Buat ${batchQuantity} Voucher`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hasil Batch (Download CSV / Print) */}
      {batchResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 65,
          }}
        >
          <div
            className="stitch-card-container"
            style={{ width: '100%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', background: '#fff', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Batch "{batchResult.batch.name}" Siap Dicetak!
                </h3>
                <small style={{ color: '#b45309' }}>
                  Simpan CSV atau cetak sekarang — password plaintext hanya ditampilkan satu kali ini.
                </small>
              </div>
              <button
                type="button"
                onClick={() => setBatchResult(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => handleDownloadCsv(batchResult)}>
                <Download size={14} />
                Download CSV
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => handlePrintCards(batchResult)}>
                <Printer size={14} />
                Cetak Kartu Voucher
              </button>
            </div>
            <div className="table-wrapper" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Kode / Username</th>
                    <th>Password</th>
                    <th>Berlaku Sampai</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.vouchers.map((v, idx) => (
                    <tr key={v.id}>
                      <td>{idx + 1}</td>
                      <td><code style={{ fontWeight: 700 }}>{v.username}</code></td>
                      <td><code style={{ fontWeight: 700, color: '#047857' }}>{v.password}</code></td>
                      <td style={{ fontSize: '12px' }}>{formatDate(v.expires_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
