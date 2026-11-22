import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ClipboardCheck,
  Copy,
  Fingerprint,
  Phone,
  ShieldCheck,
  ShieldOff,
  Table,
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
import {
  useBlockDevice,
  useBlockedDevices,
  useUnblockDevice,
  useVisitors,
} from '@/features/visitors/hooks/use-visitors'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatBytes, formatDate, formatDuration } from '@/lib/formatters'

function formatVisitorStatus(status?: string): string {
  switch (status) {
    case 'CONNECTED':
      return 'Online'
    case 'PENDING':
      return 'Di Portal'
    case 'CLOSED':
      return 'Selesai'
    case 'STALE':
      return 'Terputus'
    default:
      return status || '—'
  }
}

export function VisitorsPage() {
  const { query, searchParams, searchTerm, setSearchTerm, setFilter } = useTableQuery(350)
  const [activeTab, setActiveTab] = useState<'visitors' | 'blocked'>('visitors')
  const [blockTargetMac, setBlockTargetMac] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState('')

  const { data, isPending, error } = useVisitors(query)
  const { data: blockedData, isPending: blockedLoading } = useBlockedDevices({
    page: activeTab === 'blocked' ? query.page : 1,
    per_page: 20,
    search: activeTab === 'blocked' ? query.search : undefined,
  })
  const blockMutation = useBlockDevice()
  const unblockMutation = useUnblockDevice()

  if (isPending) return <LoadingState />
  if (error || !data) return <ErrorState message="Gagal memuat daftar pengunjung." />

  const leadsCount = data.data.filter((v) => Boolean(v.survey_email || v.survey_phone)).length
  const leadsConversionRate = data.data.length > 0 ? ((leadsCount / data.data.length) * 100).toFixed(1) : '0'
  const blockedTotal = blockedData?.meta?.total_items ?? blockedData?.data?.length ?? 0

  const handleConfirmBlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!blockTargetMac) return
    blockMutation.mutate(
      {
        mac: blockTargetMac,
        input: { reason: blockReason.trim() || 'Diblokir oleh admin', disconnect_active: true },
      },
      {
        onSuccess: () => {
          toast.success(`Perangkat ${blockTargetMac} berhasil diblokir`)
          setBlockTargetMac(null)
          setBlockReason('')
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal memblokir perangkat'),
      }
    )
  }

  const handleUnblock = (mac: string) => {
    unblockMutation.mutate(mac, {
      onSuccess: () => toast.success(`Blokir perangkat ${mac} telah dibuka`),
      onError: (err: Error) => toast.error(err.message || 'Gagal membuka blokir'),
    })
  }

  return (
    <div>
      <WavyHeader title="Data Pengunjung" />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Pengunjung"
            value={data.meta?.total_items || data.data.length}
            icon={Fingerprint}
            subtext="Perangkat tercatat"
          />

          <KpiCard
            label="Sedang Online"
            value={data.data.filter((v) => v.status === 'CONNECTED').length}
            icon={Wifi}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Terhubung ke internet"
          />

          <KpiCard
            label="Kontak Terkumpul"
            value={leadsCount}
            icon={ClipboardCheck}
            iconBoxVariant="secondary"
            trend={{ label: `${leadsConversionRate}%` }}
            subtext="Email & nomor WhatsApp"
          />

          <KpiCard
            label="Perangkat Diblokir"
            value={blockedTotal}
            icon={Ban}
            iconColor="#dc2626"
            iconBoxVariant="warning"
            subtext="MAC masuk daftar blokir"
          />
        </KpiGrid>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'visitors' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('visitors')}
          >
            <Table size={15} />
            Daftar Pengunjung
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'blocked' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('blocked')}
          >
            <ShieldOff size={15} />
            Perangkat Diblokir ({blockedTotal})
          </button>
        </div>

        {activeTab === 'visitors' ? (
          <DataTableCard
            title="Daftar Pengunjung & Kontak"
            icon={Table}
            toolbarActions={
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <SearchInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari MAC, IP, atau kode voucher..."
                  style={{ width: '240px' }}
                />

                <select
                  value={query.status || ''}
                  onChange={(e) => setFilter('status', e.target.value)}
                  style={{ padding: '0.65rem 0.85rem' }}
                >
                  <option value="">Semua Status</option>
                  <option value="CONNECTED">Online</option>
                  <option value="PENDING">Di Portal</option>
                  <option value="CLOSED">Selesai</option>
                  <option value="STALE">Terputus</option>
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
                        <th>Perangkat</th>
                        <th>Voucher &amp; Paket</th>
                        <th>Status</th>
                        <th>Waktu Koneksi</th>
                        <th>Berlaku Sampai</th>
                        <th>Pemakaian Data</th>
                        <th>Kontak</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((x) => {
                        const hasContact = Boolean(x.survey_email || x.survey_phone)
                        const isConnected = x.status === 'CONNECTED'
                        return (
                          <tr key={x.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Fingerprint size={18} style={{ color: x.is_blocked ? '#dc2626' : '#1d4ed8', flexShrink: 0 }} />
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0b1c30' }}>
                                      {x.mac}
                                    </strong>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(x.mac)
                                        toast.success('Alamat MAC disalin')
                                      }}
                                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b' }}
                                      title="Salin Alamat MAC"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  </div>
                                  <small style={{ color: '#64748b', fontSize: '11px' }}>
                                    IP: {x.ip || '—'}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <code style={{ fontSize: '12px', background: '#eff4ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, width: 'fit-content' }}>
                                  {x.username || '—'}
                                </code>
                                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                                  {x.profile_name || 'Standar'}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <StatusPill
                                  variant={isConnected ? 'active' : x.status === 'STALE' ? 'expired' : 'neutral'}
                                  dot={isConnected}
                                >
                                  {formatVisitorStatus(x.status)}
                                </StatusPill>
                                {x.is_blocked && (
                                  <StatusPill variant="expired">
                                    Diblokir
                                  </StatusPill>
                                )}
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                                <span style={{ color: isConnected ? '#065f46' : '#475569', fontWeight: isConnected ? 600 : 500 }}>
                                  {isConnected
                                    ? `Mulai: ${formatDate(x.connected_at || x.created_at)}`
                                    : `Selesai: ${formatDate(x.disconnected_at || x.last_accounting_at || x.created_at)}`}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '11px' }}>
                                  Durasi: {formatDuration(x.session_time_seconds)}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0b1c30' }}>
                                {x.voucher_expires_at ? formatDate(x.voucher_expires_at) : '—'}
                              </span>
                            </td>

                            <td>
                              <div style={{ display: 'grid', gap: '0.15rem', fontSize: '12px' }}>
                                <span style={{ color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <ArrowDown size={12} /> {formatBytes(x.output_octets || 0)}
                                </span>
                                <span style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <ArrowUp size={12} /> {formatBytes(x.input_octets || 0)}
                                </span>
                              </div>
                            </td>

                            <td>
                              {hasContact ? (
                                <div style={{ display: 'grid', gap: '0.2rem' }}>
                                  {x.survey_email && (
                                    <span style={{ fontWeight: 600, color: '#0b1c30', fontSize: '12px' }}>
                                      {x.survey_email}
                                    </span>
                                  )}
                                  {x.survey_phone && (
                                    <StatusPill variant="active" icon={Phone} iconSize={11} style={{ width: 'fit-content', fontSize: '11px', padding: '1px 6px' }}>
                                      {x.survey_phone}
                                    </StatusPill>
                                  )}
                                </div>
                              ) : x.survey_skipped ? (
                                <small style={{ color: '#747686' }}>Tanpa Survei</small>
                              ) : (
                                <small style={{ color: '#94a3b8' }}>—</small>
                              )}
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              {x.mac ? (
                                x.is_blocked ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px', color: '#047857', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                                    disabled={unblockMutation.isPending}
                                    onClick={() => handleUnblock(x.mac)}
                                  >
                                    <ShieldCheck size={13} />
                                    Buka Blokir
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px', color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}
                                    onClick={() => {
                                      setBlockTargetMac(x.mac)
                                      setBlockReason('')
                                    }}
                                  >
                                    <Ban size={13} />
                                    Blokir MAC
                                  </button>
                                )
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={data.meta} path="/visitors" search={searchParams} />
              </>
            ) : (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Belum ada pengunjung tercatat." />
              </div>
            )}
          </DataTableCard>
        ) : (
          <DataTableCard
            title="Daftar Perangkat Diblokir (MAC Blocklist)"
            icon={ShieldOff}
            toolbarActions={
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari MAC atau alasan blokir..."
                style={{ width: '260px' }}
              />
            }
          >
            {blockedLoading ? (
              <LoadingState />
            ) : blockedData && blockedData.data.length > 0 ? (
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>MAC Address</th>
                      <th>Cakupan</th>
                      <th>Alasan Blokir</th>
                      <th>Diblokir Oleh</th>
                      <th>Waktu</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedData.data.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#b91c1c' }}>
                            {b.mac}
                          </strong>
                        </td>
                        <td>{b.router_name || 'Global (Semua Router)'}</td>
                        <td>{b.reason || '—'}</td>
                        <td>{b.blocked_by || 'admin'}</td>
                        <td>{formatDate(b.created_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.7rem', fontSize: '12px', color: '#047857', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                            disabled={unblockMutation.isPending}
                            onClick={() => handleUnblock(b.mac)}
                          >
                            <ShieldCheck size={13} />
                            Buka Blokir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Belum ada perangkat yang diblokir." />
              </div>
            )}
          </DataTableCard>
        )}
      </div>

      {/* Block MAC Modal */}
      {blockTargetMac && (
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
          onClick={() => setBlockTargetMac(null)}
        >
          <div
            className="stitch-card-container"
            style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Blokir Perangkat MAC
              </h3>
              <button
                type="button"
                onClick={() => setBlockTargetMac(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 1rem' }}>
              MAC <strong style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{blockTargetMac}</strong> akan ditolak di Captive Portal &amp; RADIUS, serta sesi aktifnya akan segera diputus.
            </p>
            <form onSubmit={handleConfirmBlock} style={{ display: 'grid', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Alasan Pemblokiran
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Contoh: Penyalahgunaan bandwidth / spam portal"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBlockTargetMac(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-danger" disabled={blockMutation.isPending}>
                  <Ban size={14} />
                  {blockMutation.isPending ? 'Memblokir...' : 'Blokir Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
