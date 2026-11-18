import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Copy,
  Key,
  Link2,
  MapPin,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Router,
  Save,
  Sliders,
  Store,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import type { AdminPartnerItem } from '@/features/marketplace/marketplace.types'
import { formatDate, formatRupiah } from '@/lib/formatters'

function buildInviteUrl(token?: string): string {
  if (!token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://wifiads.smartscales.web.id'
  return `${origin}/partner/invite/${token}`
}

export function AdminPartnersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Create Invite Modal
  const [showInviteFormModal, setShowInviteFormModal] = useState(false)
  const [inviteVenueLabel, setInviteVenueLabel] = useState('')
  const [inviteSharePercent, setInviteSharePercent] = useState<number>(20)

  // Generated Invite Link Share Modal
  const [activeInvitePartner, setActiveInvitePartner] = useState<AdminPartnerItem | null>(null)

  // Settings / Detail Modal (Admin edits Share % & Active toggle; views Partner info read-only)
  const [settingsPartner, setSettingsPartner] = useState<AdminPartnerItem | null>(null)
  const [editVenueLabel, setEditVenueLabel] = useState('')
  const [editSharePercent, setEditSharePercent] = useState<number>(20)
  const [editIsActive, setEditIsActive] = useState<boolean>(true)

  // Emergency Password Reset Modal (for active partners who forgot password)
  const [passwordPartner, setPasswordPartner] = useState<AdminPartnerItem | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: settingsData } = useQuery({
    queryKey: ['admin-mkt-settings'],
    queryFn: adminMarketplaceApi.getSettings,
  })

  const { data: partnersRes, isPending } = useQuery({
    queryKey: ['admin-partners', page, search],
    queryFn: () =>
      adminMarketplaceApi.listPartners({
        page,
        per_page: 20,
        search: search || undefined,
      }),
  })

  const openCreateInviteModal = () => {
    setInviteVenueLabel('')
    setInviteSharePercent(settingsData?.default_partner_share_percent ?? 20)
    setShowInviteFormModal(true)
  }

  const openSettingsModal = (p: AdminPartnerItem) => {
    setSettingsPartner(p)
    setEditVenueLabel(p.venue_name || '')
    setEditSharePercent(p.revenue_share_percent ?? 20)
    setEditIsActive(p.is_active)
  }

  const createInviteMutation = useMutation({
    mutationFn: () =>
      adminMarketplaceApi.createPartnerInvite({
        venue_name: inviteVenueLabel.trim(),
        revenue_share_percent: Number(inviteSharePercent),
      }),
    onSuccess: (created) => {
      toast.success('Tautan undangan mitra berhasil dibuat!')
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['admin-partners-select'] })
      setShowInviteFormModal(false)
      setActiveInvitePartner(created)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const regenerateInviteMutation = useMutation({
    mutationFn: (id: string) => adminMarketplaceApi.regeneratePartnerInvite(id),
    onSuccess: (updated) => {
      toast.success('Tautan undangan baru berhasil diperbarui!')
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      setActiveInvitePartner(updated)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      adminMarketplaceApi.updatePartnerSettings(settingsPartner!.id, {
        venue_name: settingsPartner!.status === 'INVITED' ? editVenueLabel.trim() : undefined,
        revenue_share_percent: Number(editSharePercent),
        is_active: editIsActive,
      }),
    onSuccess: () => {
      toast.success('Pengaturan bagi hasil & status mitra berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['admin-partners-select'] })
      setSettingsPartner(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const passwordMutation = useMutation({
    mutationFn: () =>
      adminMarketplaceApi.changePartnerPassword(passwordPartner!.id, newPassword),
    onSuccess: () => {
      toast.success('Kata sandi akun mitra berhasil direset')
      setPasswordPartner(null)
      setNewPassword('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: adminMarketplaceApi.deletePartner,
    onSuccess: () => {
      toast.success('Data mitra berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['admin-partners-select'] })
      queryClient.invalidateQueries({ queryKey: ['routers'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const copyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val)
      toast.success(`${label} berhasil disalin`)
    } catch {
      toast.error('Gagal menyalin ke clipboard')
    }
  }

  if (isPending) return <LoadingState />

  const partners = partnersRes?.data || []
  const meta = partnersRes?.meta

  const activeCount = partners.filter((p) => p.status === 'ACTIVE' && p.is_active).length
  const invitedCount = partners.filter((p) => p.status === 'INVITED').length
  const totalRouters = partners.reduce((acc, p) => acc + p.routers_count, 0)
  const totalPartnerBalance = partners.reduce((acc, p) => acc + p.wallet_balance_idr, 0)

  return (
    <div>
      <WavyHeader
        title="Daftar Mitra Lokasi"
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreateInviteModal}>
            <PlusCircle size={17} /> Buat Undangan Mitra
          </button>
        }
      />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Mitra Aktif"
            value={activeCount}
            icon={Store}
            iconBoxVariant="success"
            subtext={`Total ${meta?.total_items || partners.length} slot mitra`}
          />
          <KpiCard
            label="Menunggu Aktivasi"
            value={invitedCount}
            icon={Link2}
            iconBoxVariant="warning"
            subtext="Tautan undangan terkirim"
          />
          <KpiCard
            label="Perangkat Terhubung"
            value={totalRouters}
            icon={Router}
            iconBoxVariant="secondary"
            subtext="Router di lokasi mitra"
          />
          <KpiCard
            label="Saldo Dompet Mitra"
            value={formatRupiah(totalPartnerBalance)}
            icon={Wallet}
            subtext="Siap dicairkan mitra"
          />
        </KpiGrid>

        <DataTableCard
          title="Manajemen Undangan, Akun & Porsi Bagi Hasil Mitra"
          icon={Store}
          toolbarActions={
            <SearchInput
              value={search}
              onSearchChange={(val) => {
                setSearch(val)
                setPage(1)
              }}
              placeholder="Cari nama kafe, username, atau WA mitra..."
            />
          }
        >
          {partners.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState
                title="Belum ada mitra lokasi terdaftar"
                description="Klik 'Buat Undangan Mitra' untuk menghasilkan tautan pendaftaran mandiri bagi pemilik kafe/lokasi."
              />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Tempat Usaha / Label</th>
                      <th>Akun Mitra</th>
                      <th>Status Lokasi Peta</th>
                      <th>Router</th>
                      <th>Bagi Hasil (Internal)</th>
                      <th>Saldo / Total</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p) => {
                      const isInvited = p.status === 'INVITED'
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.venue_name}</div>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {p.venue_category || 'Kafe'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {isInvited ? (
                              <span style={{ color: '#b45309', fontWeight: 600 }}>
                                Menunggu mitra registrasi via link
                              </span>
                            ) : (
                              <>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                  {p.name || '-'}
                                  {p.username ? (
                                    <span style={{ color: '#059669', marginLeft: '5px' }}>
                                      (@{p.username})
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '11px' }}>
                                  {p.phone || p.email || '—'}
                                </div>
                              </>
                            )}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {p.has_coordinates ? (
                              <div>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                  }}
                                >
                                  <CheckCircle2 size={13} /> Lokasi Aktif
                                </span>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: '#64748b',
                                    maxWidth: '210px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={p.address}
                                >
                                  {p.address}
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#b45309',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                <MapPin size={12} /> Belum diatur mitra
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {p.routers_count > 0 ? (
                              <div>
                                <strong>{p.routers_count} Router</strong>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {p.router_names.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                                Belum dikaitkan
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.22rem 0.6rem',
                                borderRadius: '999px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontWeight: 800,
                                fontSize: '12px',
                              }}
                            >
                              {p.revenue_share_percent}%
                            </span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            <strong style={{ color: '#059669' }}>
                              {formatRupiah(p.wallet_balance_idr)}
                            </strong>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Total: {formatRupiah(p.total_earned_idr)}
                            </div>
                          </td>
                          <td>
                            {!p.is_active ? (
                              <StatusPill variant="expired">Nonaktif</StatusPill>
                            ) : isInvited ? (
                              <StatusPill variant="basic" dot>
                                Menunggu Aktivasi
                              </StatusPill>
                            ) : (
                              <StatusPill variant="active" dot>
                                Aktif
                              </StatusPill>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                gap: '0.35rem',
                                justifyContent: 'flex-end',
                              }}
                            >
                              {isInvited && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '0.38rem 0.65rem',
                                    fontSize: '11px',
                                    color: '#059669',
                                    borderColor: '#a7f3d0',
                                    background: '#ecfdf5',
                                  }}
                                  title="Lihat & Salin Link Undangan"
                                  onClick={() => setActiveInvitePartner(p)}
                                >
                                  <Link2 size={13} /> Link Undangan
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.38rem 0.6rem', fontSize: '11px' }}
                                title="Atur Bagi Hasil & Detail Mitra"
                                onClick={() => openSettingsModal(p)}
                              >
                                <Sliders size={13} /> Bagi Hasil
                              </button>

                              {!isInvited && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.38rem 0.55rem', fontSize: '11px' }}
                                  title="Reset Kata Sandi Darurat"
                                  onClick={() => {
                                    setPasswordPartner(p)
                                    setNewPassword('')
                                  }}
                                >
                                  <Key size={13} />
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '0.38rem 0.55rem',
                                  fontSize: '11px',
                                  color: '#dc2626',
                                }}
                                title="Hapus Mitra"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Hapus mitra "${p.venue_name}"? Router yang terhubung akan otomatis dilepas dari mitra ini.`
                                    )
                                  ) {
                                    deleteMutation.mutate(p.id)
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {meta && meta.total_pages > 1 && <Pagination meta={meta} onPageChange={setPage} />}
            </>
          )}
        </DataTableCard>
      </div>

      {/* Modal 1: Create Lightweight Partner Invite */}
      {showInviteFormModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createInviteMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1.1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Buat Undangan Mitra Lokasi</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Hasilkan link undangan agar mitra mendaftarkan akun &amp; lokasinya sendiri.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setShowInviteFormModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-field">
              <label>Nama / Label Calon Mitra *</label>
              <input
                value={inviteVenueLabel}
                onChange={(e) => setInviteVenueLabel(e.target.value)}
                placeholder="Contoh: Kafe Kopi Nusantara"
                required
              />
              <small style={{ fontSize: '11px', color: '#64748b' }}>
                Digunakan sebagai penanda awal di Admin &amp; pilihan Router. Mitra dapat memperbarui nama tempat resminya saat aktivasi.
              </small>
            </div>

            <div className="form-field">
              <label>Persentase Bagi Hasil Mitra (%) *</label>
              <input
                type="number"
                min={0}
                max={95}
                step={0.5}
                value={inviteSharePercent}
                onChange={(e) => setInviteSharePercent(Number(e.target.value))}
                required
              />
              <small style={{ fontSize: '11px', color: '#64748b' }}>
                Angka persentase ini bersifat rahasia internal Admin (Mitra hanya melihat nominal Rupiah pendapatan mereka).
              </small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowInviteFormModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createInviteMutation.isPending}
              >
                <Link2 size={15} />
                {createInviteMutation.isPending ? 'Membuat Link...' : 'Buat Link Undangan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Share Invite Link */}
      {activeInvitePartner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1.1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Tautan Undangan — {activeInvitePartner.venue_name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Kirim tautan sekali pakai ini kepada pemilik lokasi untuk membuat akun &amp; mengatur lokasi usaha.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setActiveInvitePartner(null)}
              >
                <X size={16} />
              </button>
            </div>

            {activeInvitePartner.invite_token ? (
              <>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '11px',
                    padding: '0.85rem',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                    LINK AKTIVASI MITRA (BERLAKU 7 HARI)
                  </div>
                  <code
                    style={{
                      fontSize: '12px',
                      color: '#065f46',
                      wordBreak: 'break-all',
                      fontWeight: 700,
                    }}
                  >
                    {buildInviteUrl(activeInvitePartner.invite_token)}
                  </code>
                  {activeInvitePartner.invite_expires_at && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Berlaku hingga: {formatDate(activeInvitePartner.invite_expires_at)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      copyText(buildInviteUrl(activeInvitePartner.invite_token), 'Link undangan')
                    }
                  >
                    <Copy size={15} /> Salin Link Undangan
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, color: '#065f46', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                    onClick={() => {
                      const url = buildInviteUrl(activeInvitePartner.invite_token)
                      const msg = `Halo Mitra *${activeInvitePartner.venue_name}*,\n\nSilakan klik tautan resmi berikut untuk mengaktifkan akun Portal Mitra Wi-Fi Lokasi Anda serta melengkapi titik lokasi usaha:\n${url}\n\nTerima kasih.`
                      copyText(msg, 'Pesan undangan WhatsApp')
                    }}
                  >
                    <MessageSquare size={15} /> Salin Pesan WhatsApp
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Tautan sebelumnya sudah kedaluwarsa atau belum tersedia. Silakan klik tombol di bawah untuk membuat tautan baru.
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '12px' }}
                disabled={regenerateInviteMutation.isPending}
                onClick={() => regenerateInviteMutation.mutate(activeInvitePartner.id)}
              >
                <RefreshCw size={14} />
                {regenerateInviteMutation.isPending ? 'Memperbarui...' : 'Buat Ulang Link Baru'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveInvitePartner(null)}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Partner Revenue Share Settings + Read-Only Partner Info */}
      {settingsPartner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveSettingsMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1.1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Pengaturan Mitra — {settingsPartner.venue_name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Data profil, alamat, &amp; rekening dikelola mandiri oleh Mitra.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setSettingsPartner(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Read-Only Summary of Partner's Own Data */}
            {settingsPartner.status === 'ACTIVE' && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '11px',
                  padding: '0.9rem',
                  fontSize: '12px',
                  display: 'grid',
                  gap: '5px',
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Akun Mitra:</span>{' '}
                  <strong>
                    {settingsPartner.name} (@{settingsPartner.username})
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Kontak:</span>{' '}
                  {settingsPartner.phone || '—'} {settingsPartner.email ? `• ${settingsPartner.email}` : ''}
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Alamat Lokasi:</span>{' '}
                  {settingsPartner.address || 'Belum diatur'}
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Rekening Pencairan:</span>{' '}
                  {settingsPartner.bank_name
                    ? `${settingsPartner.bank_name} — ${settingsPartner.bank_account_number} (a.n. ${settingsPartner.bank_account_holder})`
                    : 'Belum diisi oleh mitra'}
                </div>
              </div>
            )}

            {settingsPartner.status === 'INVITED' && (
              <div className="form-field">
                <label>Label Calon Mitra</label>
                <input
                  value={editVenueLabel}
                  onChange={(e) => setEditVenueLabel(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label>Persentase Bagi Hasil untuk Mitra Ini (%) *</label>
              <input
                type="number"
                min={0}
                max={95}
                step={0.5}
                value={editSharePercent}
                onChange={(e) => setEditSharePercent(Number(e.target.value))}
                required
              />
              <small style={{ fontSize: '11px', color: '#64748b' }}>
                Hanya tampil di Admin. Mitra hanya melihat nominal Rupiah bersih yang masuk ke saldo mereka.
              </small>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
              />
              <span>
                <strong>Akun mitra aktif</strong> (dapat masuk portal &amp; menerima pembagian pendapatan iklan)
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSettingsPartner(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saveSettingsMutation.isPending}
              >
                <Save size={15} />
                {saveSettingsMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 4: Emergency Password Reset */}
      {passwordPartner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              passwordMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '420px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Reset Sandi Darurat</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {passwordPartner.venue_name} (@{passwordPartner.username})
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setPasswordPartner(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-field">
              <label>Kata Sandi Sementara (Min. 6 Karakter)</label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mitra dapat menggantinya kembali setelah masuk"
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPasswordPartner(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={passwordMutation.isPending}
              >
                <Save size={15} />
                {passwordMutation.isPending ? 'Menyimpan...' : 'Simpan Sandi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
