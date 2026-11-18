import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Key,
  MapPin,
  Pencil,
  PlusCircle,
  Router,
  Save,
  Store,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import { RouterPinPicker } from '@/components/map/router-pin-picker'
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
import { formatRupiah } from '@/lib/formatters'

export function AdminPartnersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPartner, setEditingPartner] = useState<AdminPartnerItem | null>(null)
  const [passwordPartner, setPasswordPartner] = useState<AdminPartnerItem | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Form State
  const [name, setName] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueCategory, setVenueCategory] = useState('Kafe')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [sharePercent, setSharePercent] = useState<number>(20)
  const [bankName, setBankName] = useState('')
  const [bankAccNum, setBankAccNum] = useState('')
  const [bankAccHolder, setBankAccHolder] = useState('')
  const [isActive, setIsActive] = useState(true)

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

  const openCreateModal = () => {
    setEditingPartner(null)
    setName('')
    setVenueName('')
    setVenueCategory('Kafe')
    setEmail('')
    setPhone('')
    setPassword('')
    setAddress('')
    setLatitude(null)
    setLongitude(null)
    setSharePercent(settingsData?.default_partner_share_percent ?? 20)
    setBankName('')
    setBankAccNum('')
    setBankAccHolder('')
    setIsActive(true)
    setShowModal(true)
  }

  const openEditModal = (p: AdminPartnerItem) => {
    setEditingPartner(p)
    setName(p.name)
    setVenueName(p.venue_name)
    setVenueCategory(p.venue_category || 'Kafe')
    setEmail(p.email)
    setPhone(p.phone || '')
    setPassword('')
    setAddress(p.address || '')
    setLatitude(typeof p.latitude === 'number' ? p.latitude : null)
    setLongitude(typeof p.longitude === 'number' ? p.longitude : null)
    setSharePercent(p.revenue_share_percent ?? 20)
    setBankName(p.bank_name || '')
    setBankAccNum(p.bank_account_number || '')
    setBankAccHolder(p.bank_account_holder || '')
    setIsActive(p.is_active)
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingPartner) {
        return adminMarketplaceApi.updatePartner(editingPartner.id, {
          name: name.trim(),
          venue_name: venueName.trim(),
          venue_category: venueCategory,
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          latitude,
          longitude,
          revenue_share_percent: Number(sharePercent),
          bank_name: bankName.trim(),
          bank_account_number: bankAccNum.trim(),
          bank_account_holder: bankAccHolder.trim(),
          is_active: isActive,
        })
      }
      return adminMarketplaceApi.createPartner({
        name: name.trim(),
        venue_name: venueName.trim(),
        venue_category: venueCategory,
        email: email.trim(),
        phone: phone.trim(),
        password,
        address: address.trim(),
        latitude,
        longitude,
        revenue_share_percent: Number(sharePercent),
        bank_name: bankName.trim(),
        bank_account_number: bankAccNum.trim(),
        bank_account_holder: bankAccHolder.trim(),
        is_active: isActive,
      })
    },
    onSuccess: () => {
      toast.success(
        editingPartner ? 'Data mitra berhasil diperbarui' : 'Mitra lokasi berhasil didaftarkan'
      )
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['admin-partners-select'] })
      queryClient.invalidateQueries({ queryKey: ['routers'] })
      setShowModal(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const passwordMutation = useMutation({
    mutationFn: () => adminMarketplaceApi.changePartnerPassword(passwordPartner!.id, newPassword),
    onSuccess: () => {
      toast.success('Kata sandi mitra berhasil diperbarui')
      setPasswordPartner(null)
      setNewPassword('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: adminMarketplaceApi.deletePartner,
    onSuccess: () => {
      toast.success('Akun mitra berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['admin-partners-select'] })
      queryClient.invalidateQueries({ queryKey: ['routers'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />

  const partners = partnersRes?.data || []
  const meta = partnersRes?.meta
  const totalLinkedRouters = partners.reduce((acc, p) => acc + (p.routers_count || 0), 0)
  const totalWallet = partners.reduce((acc, p) => acc + (p.wallet_balance_idr || 0), 0)
  const totalEarned = partners.reduce((acc, p) => acc + (p.total_earned_idr || 0), 0)

  return (
    <div>
      <WavyHeader
        title="Daftar Mitra Lokasi"
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <PlusCircle size={18} />
            Daftarkan Mitra Baru
          </button>
        }
      />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Mitra Lokasi"
            value={meta?.total_items || partners.length}
            icon={Store}
            subtext="Pemilik kafe & tempat usaha"
          />
          <KpiCard
            label="Router Terhubung"
            value={totalLinkedRouters}
            icon={Router}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Terpasang di lokasi mitra"
          />
          <KpiCard
            label="Saldo Siap Cair"
            value={formatRupiah(totalWallet)}
            icon={Wallet}
            iconBoxVariant="secondary"
            subtext="Belum ditarik mitra"
          />
          <KpiCard
            label="Akumulasi Bagi Hasil"
            value={formatRupiah(totalEarned)}
            icon={TrendingUp}
            subtext="Total pendapatan mitra"
          />
        </KpiGrid>

        <DataTableCard
          title="Manajemen Akun Mitra & Bagi Hasil"
          icon={Store}
          toolbarActions={
            <SearchInput
              placeholder="Cari nama kafe, pemilik, atau email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ width: '260px' }}
            />
          }
        >
          {partners.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState
                title="Belum ada mitra lokasi yang terdaftar"
                description="Daftarkan akun mitra pemilik kafe/lokasi lalu hubungkan dengan perangkat Router MikroTik."
                action={
                  <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                    <PlusCircle size={16} /> Daftarkan Mitra Pertama
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nama Lokasi / Kafe</th>
                      <th>Pemilik &amp; Kontak</th>
                      <th>Router Terhubung</th>
                      <th>Porsi Bagi Hasil</th>
                      <th>Saldo &amp; Total</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p) => {
                      const hasPin =
                        typeof p.latitude === 'number' && typeof p.longitude === 'number'
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong style={{ display: 'block', color: '#0f172a' }}>
                              {p.venue_name}
                            </strong>
                            <small style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={11} color={hasPin ? '#16a34a' : '#f59e0b'} />
                              {hasPin
                                ? p.address || `${p.latitude}, ${p.longitude}`
                                : 'Titik peta belum diisi'}
                            </small>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            <div>
                              <strong>{p.name}</strong>
                            </div>
                            <small style={{ color: '#64748b' }}>
                              {p.email}
                              {p.phone ? ` • ${p.phone}` : ''}
                            </small>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {p.routers_count > 0 ? (
                              <div>
                                <strong>{p.routers_count} router</strong>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {p.router_names.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Belum dikaitkan</span>
                            )}
                          </td>
                          <td>
                            <StatusPill variant="basic">{p.revenue_share_percent}%</StatusPill>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            <strong style={{ color: '#065f46', display: 'block' }}>
                              {formatRupiah(p.wallet_balance_idr)}
                            </strong>
                            <small style={{ color: '#64748b' }}>
                              Total: {formatRupiah(p.total_earned_idr)}
                            </small>
                          </td>
                          <td>
                            {p.is_active ? (
                              <StatusPill variant="active" dot>
                                Aktif
                              </StatusPill>
                            ) : (
                              <StatusPill variant="expired">Nonaktif</StatusPill>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                                onClick={() => openEditModal(p)}
                              >
                                <Pencil size={13} /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                                onClick={() => {
                                  setPasswordPartner(p)
                                  setNewPassword('')
                                }}
                              >
                                <Key size={13} /> Sandi
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                                onClick={() => {
                                  if (window.confirm(`Hapus mitra "${p.venue_name}"?`)) {
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

      {/* Modal: Create / Edit Partner */}
      {showModal && (
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                {editingPartner
                  ? `Edit Mitra: ${editingPartner.venue_name}`
                  : 'Daftarkan Mitra Lokasi Baru'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-field">
                  <label>Nama Lokasi / Kafe (Tampil ke Pengiklan) *</label>
                  <input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Contoh: Kafe Kopi Nusantara"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Kategori Lokasi</label>
                  <select
                    value={venueCategory}
                    onChange={(e) => setVenueCategory(e.target.value)}
                  >
                    <option value="Kafe">Kafe</option>
                    <option value="Restoran">Restoran</option>
                    <option value="Coworking">Coworking</option>
                    <option value="Kampus">Kampus</option>
                    <option value="Area Publik">Area Publik</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-field">
                  <label>Nama Pemilik / Penanggung Jawab *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Nomor Telepon / WhatsApp</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08123456789"
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: editingPartner ? '1fr 1fr' : '1fr 1fr 1fr',
                  gap: '0.85rem',
                }}
              >
                <div className="form-field">
                  <label>Email Login Mitra *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mitra@kafeanda.id"
                    required
                  />
                </div>
                {!editingPartner && (
                  <div className="form-field">
                    <label>Kata Sandi Awal *</label>
                    <input
                      type="password"
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      required
                    />
                  </div>
                )}
                <div className="form-field">
                  <label>Porsi Bagi Hasil Mitra (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={95}
                    step="0.5"
                    value={sharePercent}
                    onChange={(e) => setSharePercent(Number(e.target.value))}
                    required
                  />
                  <span className="helper-text">
                    Hanya terlihat oleh Admin (Mitra hanya melihat nominal Rp).
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'grid',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                    Titik Peta &amp; Alamat Lokasi
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Dapat diisi sekarang oleh Admin atau dilengkapi mandiri oleh Mitra di menu Profil Mitra.
                  </span>
                </div>

                <div className="form-field">
                  <label>Alamat Lengkap</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Contoh: Jl. Merdeka No. 10, Medan"
                  />
                </div>

                <RouterPinPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lng) => {
                    setLatitude(lat)
                    setLongitude(lng)
                  }}
                  onAddressFound={(addr) => {
                    if (!address.trim()) setAddress(addr)
                  }}
                  height={220}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.75rem',
                }}
              >
                <div className="form-field">
                  <label>Nama Bank Pencairan</label>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Contoh: BCA / Mandiri"
                  />
                </div>
                <div className="form-field">
                  <label>Nomor Rekening</label>
                  <input
                    value={bankAccNum}
                    onChange={(e) => setBankAccNum(e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div className="form-field">
                  <label>Atas Nama Rekening</label>
                  <input
                    value={bankAccHolder}
                    onChange={(e) => setBankAccHolder(e.target.value)}
                    placeholder="Budi Santoso"
                  />
                </div>
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
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>
                  <strong>Akun Mitra Aktif</strong> (berhak menerima bagi hasil penayangan iklan)
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  <Save size={16} />
                  {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Data Mitra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Partner Password */}
      {passwordPartner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
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
              padding: '1.4rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Ubah Sandi Mitra: {passwordPartner.venue_name}
            </h3>
            <div className="form-field">
              <label>Kata Sandi Baru</label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
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
                Simpan Sandi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
