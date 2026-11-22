import { useMutation } from '@tanstack/react-query'
import { CreditCard, Key, MapPin, Save, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { LoadingState } from '@/components/feedback/query-state'
import { RouterPinPicker } from '@/components/map/router-pin-picker'
import { WavyHeader } from '@/components/ui'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import {
  partnerAuthQueryKey,
  useCurrentPartner,
} from '@/features/partner-portal/hooks/use-current-partner'

export function PartnerProfilePage() {
  const { data: partner, isPending } = useCurrentPartner()

  const [name, setName] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueCategory, setVenueCategory] = useState('Kafe')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [suggestedAddress, setSuggestedAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [bankName, setBankName] = useState('')
  const [bankAccNum, setBankAccNum] = useState('')
  const [bankAccHolder, setBankAccHolder] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (partner) {
      setName(partner.name || '')
      setVenueName(partner.venue_name || '')
      setVenueCategory(partner.venue_category || 'Kafe')
      setPhone(partner.phone || '')
      setAddress(partner.address || '')
      setLatitude(typeof partner.latitude === 'number' ? partner.latitude : null)
      setLongitude(typeof partner.longitude === 'number' ? partner.longitude : null)
      setBankName(partner.bank_name || '')
      setBankAccNum(partner.bank_account_number || '')
      setBankAccHolder(partner.bank_account_holder || '')
    }
  }, [partner])

  const updateProfileMutation = useMutation({
    mutationFn: () => {
      if (latitude === null || longitude === null) {
        throw new Error('Silakan klik pada peta untuk menentukan titik koordinat lokasi Anda')
      }
      if (!address.trim()) {
        throw new Error('Alamat lengkap tempat usaha wajib diisi')
      }
      return partnerApi.updateProfile({
        name: name.trim(),
        venue_name: venueName.trim(),
        venue_category: venueCategory,
        phone: phone.trim(),
        address: address.trim(),
        latitude,
        longitude,
        bank_name: bankName.trim(),
        bank_account_number: bankAccNum.trim(),
        bank_account_holder: bankAccHolder.trim(),
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(partnerAuthQueryKey, updated)
      queryClient.invalidateQueries({ queryKey: ['partner-overview'] })
      queryClient.invalidateQueries({ queryKey: ['partner-routers'] })
      setSuggestedAddress('')
      toast.success('Profil, titik koordinat lokasi, dan rekening berhasil disimpan!')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const passwordMutation = useMutation({
    mutationFn: () =>
      partnerApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      toast.success('Kata sandi berhasil diperbarui')
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending || !partner) return <LoadingState />

  return (
    <div>
      <WavyHeader title="Profil, Titik Peta Lokasi & Rekening" />

      <div className="stitch-page-stage">
        <div className="partner-profile-grid">
          {/* Main Profile & Mandatory Map Coordinates Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              updateProfileMutation.mutate()
            }}
            className="stitch-card-container"
            style={{ background: '#ffffff', padding: '1.6rem', display: 'grid', gap: '1.4rem' }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#0b1c30',
                }}
              >
                <Store size={18} color="#059669" /> Informasi Tempat Usaha &amp; Titik Peta
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                Nama lokasi dan titik peta di bawah ini tampil kepada pengiklan saat memilih lokasi
                penayangan iklan.
              </p>
            </div>

            <div className="partner-field-row">
              <div className="form-field">
                <label>Nama Tempat Usaha / Kafe *</label>
                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Contoh: Kafe Kopi Nusantara"
                  required
                />
              </div>
              <div className="form-field">
                <label>Kategori Tempat *</label>
                <select value={venueCategory} onChange={(e) => setVenueCategory(e.target.value)}>
                  <option value="Kafe">Kafe &amp; Kedai Kopi</option>
                  <option value="Restoran">Restoran &amp; Kuliner</option>
                  <option value="Coworking">Coworking &amp; Kantor</option>
                  <option value="Kampus">Kampus &amp; Sekolah</option>
                  <option value="Area Publik">Area Publik &amp; Komersial</option>
                </select>
              </div>
            </div>

            <div className="partner-field-row">
              <div className="form-field">
                <label>Nama Penanggung Jawab *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Nomor Telepon / WhatsApp</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812..."
                />
              </div>
            </div>

            {/* Mandatory Map Pin + Address Section */}
            <div className="partner-map-section">
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <strong
                  style={{
                    fontSize: '13.5px',
                    color: '#0b1c30',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <MapPin size={16} color="#ea4335" /> Titik Peta &amp; Alamat Lengkap (Wajib) *
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                  Tempel link Google Maps atau cari nama jalan, lalu geser pin merah bila perlu
                  menyesuaikan posisi tepat usaha Anda.
                </span>
              </div>

              <RouterPinPicker
                latitude={latitude}
                longitude={longitude}
                onChange={(lat, lng) => {
                  setLatitude(lat)
                  setLongitude(lng)
                }}
                onAddressFound={(foundAddr) => {
                  if (!address.trim()) {
                    setAddress(foundAddr)
                    setSuggestedAddress('')
                  } else if (foundAddr.trim() !== address.trim()) {
                    setSuggestedAddress(foundAddr)
                  }
                }}
                height={300}
              />

              <div className="form-field">
                <label>Alamat Lengkap Lokasi *</label>
                {suggestedAddress && (
                  <button
                    type="button"
                    className="partner-address-chip"
                    onClick={() => {
                      setAddress(suggestedAddress)
                      setSuggestedAddress('')
                    }}
                  >
                    <MapPin size={13} style={{ flexShrink: 0 }} />
                    <span className="partner-address-chip-text">
                      Gunakan alamat peta: {suggestedAddress}
                    </span>
                  </button>
                )}
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value)
                    if (suggestedAddress) setSuggestedAddress('')
                  }}
                  placeholder="Contoh: Jl. Iskandar Muda No. 45, Kec. Medan Baru, Kota Medan"
                  required
                />
              </div>
            </div>

            {/* Bank Account Section */}
            <div
              style={{
                paddingTop: '1.1rem',
                borderTop: '1px solid #e2e8f0',
                display: 'grid',
                gap: '0.9rem',
              }}
            >
              <strong
                style={{
                  fontSize: '13.5px',
                  color: '#0b1c30',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <CreditCard size={16} color="#059669" /> Rekening Bank Pencairan Pendapatan
              </strong>
              <div className="partner-field-row">
                <div className="form-field">
                  <label>Nama Bank</label>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Contoh: Bank BCA / Mandiri / BRI"
                  />
                </div>
                <div className="form-field">
                  <label>Nomor Rekening</label>
                  <input
                    value={bankAccNum}
                    onChange={(e) => setBankAccNum(e.target.value)}
                    placeholder="Contoh: 1234567890"
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Atas Nama Pemilik Rekening</label>
                <input
                  value={bankAccHolder}
                  onChange={(e) => setBankAccHolder(e.target.value)}
                  placeholder="Sesuai buku tabungan"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updateProfileMutation.isPending}
                style={{ padding: '0.7rem 1.35rem' }}
              >
                <Save size={16} />
                {updateProfileMutation.isPending
                  ? 'Menyimpan...'
                  : 'Simpan Profil & Titik Lokasi'}
              </button>
            </div>
          </form>

          {/* Right Column: Change Password */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              passwordMutation.mutate()
            }}
            className="stitch-card-container partner-security-card"
            style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1.05rem' }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#0b1c30',
                }}
              >
                <Key size={17} color="#059669" /> Keamanan &amp; Kata Sandi
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                Perbarui kata sandi akun portal mitra Anda secara berkala.
              </p>
            </div>
            <div className="form-field">
              <label>Username / Email Akun Mitra</label>
              <input
                value={partner.username || partner.email || '-'}
                disabled
                style={{ background: '#f8fafc', color: '#64748b' }}
              />
            </div>
            <div className="form-field">
              <label>Kata Sandi Saat Ini</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="form-field">
              <label>Kata Sandi Baru (Min. 6 Karakter)</label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={passwordMutation.isPending}
              style={{ marginTop: '0.25rem' }}
            >
              {passwordMutation.isPending ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
