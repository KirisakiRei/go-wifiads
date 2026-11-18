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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* Main Profile & Mandatory Map Coordinates Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              updateProfileMutation.mutate()
            }}
            className="stitch-card-container"
            style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1.25rem' }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Store size={18} color="#059669" /> Informasi Tempat Usaha &amp; Titik Peta
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                Nama lokasi dan titik koordinat peta di bawah ini akan ditampilkan kepada para
                pengiklan saat memilih lokasi penayangan iklan.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
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
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '13px',
                padding: '1.1rem',
                display: 'grid',
                gap: '0.85rem',
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: '13px',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <MapPin size={16} color="#ea4335" /> Titik Koordinat Peta &amp; Alamat Lengkap (Wajib) *
                </strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Cari nama jalan atau klik tombol Lokasi Saya, lalu klik/geser pin merah tepat pada
                  posisi tempat usaha Anda.
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
                  }
                }}
                height={280}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label>Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude ?? ''}
                    onChange={(e) =>
                      setLatitude(e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="Klik pada peta di atas"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude ?? ''}
                    onChange={(e) =>
                      setLongitude(e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="Klik pada peta di atas"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Alamat Lengkap Lokasi *</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Iskandar Muda No. 45, Kec. Medan Baru, Kota Medan"
                  required
                />
              </div>
            </div>

            {/* Bank Account Section */}
            <div
              style={{
                paddingTop: '0.5rem',
                borderTop: '1px solid #e2e8f0',
                display: 'grid',
                gap: '0.85rem',
              }}
            >
              <strong
                style={{
                  fontSize: '13px',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <CreditCard size={16} color="#059669" /> Rekening Bank Pencairan Pendapatan
              </strong>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
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

            <div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: '#059669' }}
                disabled={updateProfileMutation.isPending}
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
            className="stitch-card-container"
            style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1rem' }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Key size={17} color="#2563eb" /> Keamanan &amp; Kata Sandi
            </h3>

            <div className="form-field">
              <label>Email Akun Mitra</label>
              <input value={partner.email} disabled style={{ background: '#f8fafc' }} />
            </div>

            <div className="form-field">
              <label>Kata Sandi Saat Ini</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
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
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-secondary"
              disabled={passwordMutation.isPending}
            >
              {passwordMutation.isPending ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
