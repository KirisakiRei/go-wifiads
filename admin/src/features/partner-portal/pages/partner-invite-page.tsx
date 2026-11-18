import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  Store,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { LoadingState } from '@/components/feedback/query-state'
import { RouterPinPicker } from '@/components/map/router-pin-picker'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import { partnerAuthQueryKey } from '@/features/partner-portal/hooks/use-current-partner'

const STEPS = [
  { num: 1, title: 'Akun Login', subtitle: 'Username & kata sandi' },
  { num: 2, title: 'Lokasi Usaha', subtitle: 'Link Maps & alamat' },
  { num: 3, title: 'Rekening & Selesai', subtitle: 'Opsional & aktivasi' },
]

export function PartnerInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1: Account Credentials
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Step 2: Venue & Map Location
  const [venueName, setVenueName] = useState('')
  const [venueCategory, setVenueCategory] = useState('Kafe')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [hydratedInvite, setHydratedInvite] = useState(false)

  // Step 3: Optional Bank Info
  const [bankName, setBankName] = useState('')
  const [bankAccNum, setBankAccNum] = useState('')
  const [bankAccHolder, setBankAccHolder] = useState('')

  const {
    data: inviteInfo,
    isPending,
    error,
  } = useQuery({
    queryKey: ['partner-invite-info', token],
    queryFn: () => partnerApi.getInviteInfo(token!),
    enabled: Boolean(token),
    retry: false,
  })

  useEffect(() => {
    if (inviteInfo && !hydratedInvite) {
      setVenueName(inviteInfo.venue_name || '')
      setVenueCategory(inviteInfo.venue_category || 'Kafe')
      setHydratedInvite(true)
    }
  }, [inviteInfo, hydratedInvite])

  const activateMutation = useMutation({
    mutationFn: () => {
      if (latitude === null || longitude === null) {
        throw new Error('Silakan tentukan titik lokasi usaha Anda melalui link Google Maps atau peta')
      }
      return partnerApi.activateInvite(token!, {
        username: username.trim().toLowerCase(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        name: ownerName.trim(),
        password,
        venue_name: venueName.trim(),
        venue_category: venueCategory,
        address: address.trim(),
        latitude,
        longitude,
        bank_name: bankName.trim() || undefined,
        bank_account_number: bankAccNum.trim() || undefined,
        bank_account_holder: bankAccHolder.trim() || undefined,
      })
    },
    onSuccess: (res) => {
      queryClient.setQueryData(partnerAuthQueryKey, res.partner)
      toast.success(`Selamat bergabung, ${res.partner.venue_name}! Akun mitra Anda telah aktif.`)
      navigate('/dashboard', { replace: true })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const goNextFromStep1 = () => {
    const cleanUser = username.trim().toLowerCase()
    if (cleanUser.length < 3) {
      toast.error('Username minimal 3 karakter')
      return
    }
    if (!/^[a-z0-9._-]+$/.test(cleanUser)) {
      toast.error('Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung (tanpa spasi)')
      return
    }
    if (!ownerName.trim()) {
      toast.error('Nama penanggung jawab wajib diisi')
      return
    }
    if (password.length < 6) {
      toast.error('Kata sandi minimal 6 karakter')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok')
      return
    }
    setStep(2)
  }

  const goNextFromStep2 = () => {
    if (!venueName.trim()) {
      toast.error('Nama tempat usaha / kafe wajib diisi')
      return
    }
    if (latitude === null || longitude === null) {
      toast.error('Silakan tempel link Share Google Maps atau pilih titik lokasi tempat usaha Anda pada peta')
      return
    }
    if (address.trim().length < 5) {
      toast.error('Alamat lengkap tempat usaha wajib diisi')
      return
    }
    setStep(3)
  }

  if (isPending) {
    return (
      <div className="partner-theme" style={{ minHeight: '100vh', background: '#f6fbf9' }}>
        <LoadingState />
      </div>
    )
  }

  if (error || !inviteInfo) {
    return (
      <div
        className="partner-theme"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #f6fbf9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div
          className="stitch-card-container"
          style={{
            maxWidth: '460px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            display: 'grid',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: '#fef3c7',
              color: '#b45309',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <Store size={26} />
          </div>
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>
            Tautan Undangan Tidak Aktif
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            {error instanceof Error
              ? error.message
              : 'Tautan undangan ini sudah digunakan atau masa berlakunya telah habis.'}
          </p>
          <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
            Ke Halaman Login Mitra
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="partner-theme"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f6fbf9 100%)',
        padding: '2rem 1rem 3rem',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'grid', gap: '1.35rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: '#059669',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.65rem',
              boxShadow: '0 8px 20px rgba(5, 150, 105, 0.25)',
            }}
          >
            <Store size={24} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Pendaftaran Mitra Lokasi Wi-Fi
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
            Lengkapi akun dan titik lokasi untuk <strong>{inviteInfo.venue_name}</strong> dalam 3
            langkah singkat.
          </p>
        </div>

        {/* Stepper Bar */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #d1fae5',
            borderRadius: '16px',
            padding: '1rem 1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          {STEPS.map((s) => {
            const isDone = step > s.num
            const isCurrent = step === s.num
            return (
              <div
                key={s.num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  opacity: isDone || isCurrent ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '999px',
                    background: isDone ? '#059669' : isCurrent ? '#d1fae5' : '#f1f5f9',
                    color: isDone ? '#ffffff' : isCurrent ? '#065f46' : '#64748b',
                    border: isCurrent ? '2px solid #059669' : 'none',
                    fontWeight: 800,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isDone ? <Check size={15} /> : s.num}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 800,
                      color: isCurrent ? '#065f46' : '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{s.subtitle}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step Content Card */}
        <div
          className="stitch-card-container"
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '1.75rem',
            boxShadow: '0 14px 36px rgba(15, 23, 42, 0.06)',
          }}
        >
          {/* STEP 1: ACCOUNT */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: '1.1rem' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <User size={18} color="#059669" /> Langkah 1: Buat Akun Login Mitra
                </h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
                  Tentukan username dan kata sandi Anda sendiri untuk mengakses Portal Mitra.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div className="form-field">
                  <label>Username Login *</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="contoh: kopinusantara"
                    required
                  />
                  <small style={{ fontSize: '11px', color: '#64748b' }}>
                    Huruf kecil &amp; angka tanpa spasi.
                  </small>
                </div>

                <div className="form-field">
                  <label>Nama Penanggung Jawab / Pemilik *</label>
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div className="form-field">
                  <label>Nomor WhatsApp Aktif</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812xxxx"
                  />
                </div>

                <div className="form-field">
                  <label>Email (Opsional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@kafeanda.id"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div className="form-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={13} /> Kata Sandi *
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                  />
                </div>

                <div className="form-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={13} /> Ulangi Kata Sandi *
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" className="btn btn-primary" onClick={goNextFromStep1}>
                  Lanjut ke Lokasi Usaha <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: VENUE & GOOGLE MAPS SHARE LINK / MAP */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: '1.1rem' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <MapPin size={18} color="#059669" /> Langkah 2: Informasi &amp; Titik Lokasi Usaha
                </h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
                  Cukup tempel <strong>Link Share Google Maps</strong> tempat usaha Anda atau cari
                  nama jalan — tidak perlu memasukkan angka koordinat manual.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '0.9rem' }}>
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

              <div
                style={{
                  background: '#f6fbf9',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '14px',
                  padding: '1rem',
                }}
              >
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
                  onPlaceNameFound={(foundPlace) => {
                    if (!venueName.trim()) {
                      setVenueName(foundPlace)
                    }
                  }}
                  height={270}
                  accentColor="#059669"
                />
              </div>

              <div className="form-field">
                <label>Alamat Lengkap Lokasi Usaha *</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Iskandar Muda No. 45, Kec. Medan Baru, Kota Medan"
                  required
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Kembali
                </button>
                <button type="button" className="btn btn-primary" onClick={goNextFromStep2}>
                  Lanjut ke Konfirmasi <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: OPTIONAL BANK & ACTIVATE */}
          {step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                activateMutation.mutate()
              }}
              style={{ display: 'grid', gap: '1.15rem' }}
            >
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CreditCard size={18} color="#059669" /> Langkah 3: Rekening Pencairan (Opsional)
                </h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
                  Rekening tujuan pencairan pendapatan iklan. Anda juga dapat mengosongkannya sekarang dan melengkapinya nanti di menu Profil.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div className="form-field">
                  <label>Nama Bank (Opsional)</label>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Contoh: Bank BCA / Mandiri / BRI"
                  />
                </div>
                <div className="form-field">
                  <label>Nomor Rekening (Opsional)</label>
                  <input
                    value={bankAccNum}
                    onChange={(e) => setBankAccNum(e.target.value)}
                    placeholder="Contoh: 1234567890"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Atas Nama Pemilik Rekening (Opsional)</label>
                <input
                  value={bankAccHolder}
                  onChange={(e) => setBankAccHolder(e.target.value)}
                  placeholder="Sesuai buku tabungan"
                />
              </div>

              {/* Confirmation Summary */}
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '13px',
                  padding: '1rem 1.1rem',
                  fontSize: '12.5px',
                  color: '#064e3b',
                  display: 'grid',
                  gap: '5px',
                }}
              >
                <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                  <CheckCircle2 size={16} color="#059669" /> Ringkasan Aktivasi Akun Mitra
                </div>
                <div>
                  • <strong>Username Login:</strong> @{username.trim().toLowerCase()} ({ownerName})
                </div>
                <div>
                  • <strong>Tempat Usaha:</strong> {venueName} ({venueCategory})
                </div>
                <div>
                  • <strong>Alamat Lokasi:</strong> {address}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Kembali
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={activateMutation.isPending}
                >
                  <CheckCircle2 size={16} />
                  {activateMutation.isPending ? 'Mengaktifkan Akun...' : 'Aktifkan Akun Mitra Sekarang'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
