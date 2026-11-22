import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, MapPin, Megaphone, Send, Store } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { RouterPinPicker } from '@/components/map/router-pin-picker'
import { publicSiteApi } from '../public.api'

const CATEGORIES = [
  'Kafe / Coffee Shop',
  'Restoran / Rumah Makan',
  'Coworking Space',
  'Hotel / Penginapan',
  'Barbershop / Salon',
  'Klinik / Ruang Tunggu',
  'Kampus / Sekolah',
  'Lainnya',
]

export function DaftarMitraPage() {
  const [venueName, setVenueName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [dailyTraffic, setDailyTraffic] = useState(100)
  const [contactName, setContactName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [notes, setNotes] = useState('')
  const [submittedVenue, setSubmittedVenue] = useState<string | null>(null)

  const submitMutation = useMutation({
    mutationFn: () =>
      publicSiteApi.submitPartnerLead({
        venue_name: venueName.trim(),
        category,
        city: city.trim(),
        address: address.trim(),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        daily_traffic_estimate: Number(dailyTraffic) || 50,
        contact_name: contactName.trim(),
        whatsapp: whatsapp.trim(),
        notes: notes.trim(),
      }),
    onSuccess: (res) => {
      setSubmittedVenue(res.venue_name)
      toast.success('Pendaftaran berhasil dikirim!')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!venueName.trim() || !city.trim() || !contactName.trim() || !whatsapp.trim()) {
      toast.error('Mohon lengkapi semua kolom wajib terlebih dahulu')
      return
    }
    submitMutation.mutate()
  }

  return (
    <section className="pub-section">
      <div className="pub-container" style={{ maxWidth: '820px' }}>
        {/* Role Picker (Legacy Onboarding UX adapted cleanly) */}
        <div className="pub-grid-2" style={{ gap: '14px', marginBottom: '26px' }}>
          <div
            className="pub-card"
            style={{
              border: '2px solid var(--pub-primary)',
              background: '#f0f5ff',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '11px',
                background: 'var(--pub-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Store size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#0b1c30' }}>
                Saya Pemilik Lokasi (Mitra)
              </div>
              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                Pasang Wi-Fi iklan & terima bagi hasil otomatis
              </div>
            </div>
          </div>

          <a
            href="/advertiser/login"
            className="pub-card pub-card-hover"
            style={{
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '11px',
                  background: '#e0f2fe',
                  color: '#00668a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Megaphone size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#0b1c30' }}>
                  Saya Ingin Beriklan
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  Daftar langsung di Portal Pengiklan mandiri
                </div>
              </div>
            </div>
            <ArrowRight size={17} color="#0037b0" />
          </a>
        </div>

        <div style={{ marginBottom: '22px' }}>
          <span className="pub-eyebrow">
            <Store size={14} /> Formulir Calon Mitra Lokasi
          </span>
          <h1 className="pub-h2" style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}>
            Daftarkan Lokasi Usaha Anda
          </h1>
          <p style={{ color: 'var(--pub-muted)', fontSize: '15px' }}>
            Isi informasi singkat & tandai titik Google Maps lokasi Anda. Tim kami akan menghubungi
            via WhatsApp beserta link aktivasi Portal Mitra.
          </p>
        </div>

        {submittedVenue ? (
          <div className="pub-card" style={{ textAlign: 'center', padding: '40px 28px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '999px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <h2 className="pub-h2" style={{ fontSize: '22px' }}>
              Terima Kasih, Pendaftaran Diterima!
            </h2>
            <p style={{ color: 'var(--pub-muted)', maxWidth: '480px', margin: '8px auto 22px' }}>
              Data lokasi <strong>{submittedVenue}</strong> sudah masuk ke tim kemitraan kami. Kami
              akan menghubungi nomor WhatsApp Anda dalam 1×24 jam kerja beserta panduan setup router.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Link to="/" className="pub-btn pub-btn-primary">
                Kembali ke Beranda
              </Link>
              <button
                type="button"
                className="pub-btn pub-btn-secondary"
                onClick={() => {
                  setSubmittedVenue(null)
                  setVenueName('')
                  setAddress('')
                  setLatitude(null)
                  setLongitude(null)
                  setNotes('')
                }}
              >
                Daftarkan Lokasi Lain
              </button>
            </div>
          </div>
        ) : (
          <form
            className="pub-card"
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div className="pub-grid-2" style={{ gap: '16px' }}>
              <div className="pub-field">
                <label htmlFor="lead-venue">Nama Lokasi / Usaha *</label>
                <input
                  id="lead-venue"
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Contoh: Kopi Senja Medan"
                />
              </div>

              <div className="pub-field">
                <label htmlFor="lead-cat">Kategori Lokasi</label>
                <select
                  id="lead-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pub-grid-2" style={{ gap: '16px' }}>
              <div className="pub-field">
                <label htmlFor="lead-city">Kota / Kabupaten *</label>
                <input
                  id="lead-city"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Contoh: Medan"
                />
              </div>

              <div className="pub-field">
                <label htmlFor="lead-traffic">Estimasi Pengunjung Wi-Fi / Hari *</label>
                <input
                  id="lead-traffic"
                  type="number"
                  required
                  min={1}
                  max={100000}
                  value={dailyTraffic}
                  onChange={(e) => setDailyTraffic(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="pub-field">
              <label htmlFor="lead-address">Alamat Lengkap</label>
              <input
                id="lead-address"
                type="text"
                maxLength={255}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Merdeka No. 12, Kecamatan..."
              />
            </div>

            {/* Optional Map Pin Picker */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} color="#0037b0" /> Tandai Titik Lokasi di Peta (Opsional)
                </label>
                {latitude != null && longitude != null && (
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#059669' }}>
                    Koordinat tersimpan ({latitude.toFixed(5)}, {longitude.toFixed(5)})
                  </span>
                )}
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
                onPlaceNameFound={(place) => {
                  if (!venueName.trim()) setVenueName(place)
                }}
                height={240}
                accentColor="#0037b0"
              />
            </div>

            <div className="pub-grid-2" style={{ gap: '16px' }}>
              <div className="pub-field">
                <label htmlFor="lead-contact">Nama Pemilik / PIC *</label>
                <input
                  id="lead-contact"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nama lengkap Anda"
                />
              </div>

              <div className="pub-field">
                <label htmlFor="lead-wa">Nomor WhatsApp Aktif *</label>
                <input
                  id="lead-wa"
                  type="tel"
                  required
                  minLength={8}
                  maxLength={32}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="0812xxxxxxxx"
                />
              </div>
            </div>

            <div className="pub-field">
              <label htmlFor="lead-notes">Catatan Tambahan (Opsional)</label>
              <textarea
                id="lead-notes"
                rows={3}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sudah pakai router MikroTik / butuh bantuan perangkat / jam operasional..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
              <button
                type="submit"
                className="pub-btn pub-btn-primary pub-btn-lg"
                disabled={submitMutation.isPending}
              >
                <Send size={16} />
                {submitMutation.isPending ? 'Mengirim...' : 'Kirim Pendaftaran Mitra'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
