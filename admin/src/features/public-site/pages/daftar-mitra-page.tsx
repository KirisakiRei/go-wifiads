import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Send, Store } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
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
      <div className="pub-container" style={{ maxWidth: '760px' }}>
        <div style={{ marginBottom: '26px' }}>
          <span className="pub-eyebrow">
            <Store size={14} /> Formulir Calon Mitra Lokasi
          </span>
          <h1 className="pub-h2" style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}>
            Daftarkan Lokasi Usaha Anda
          </h1>
          <p style={{ color: 'var(--pub-muted)', fontSize: '15px' }}>
            Isi informasi singkat di bawah ini. Tim kami akan menghubungi via WhatsApp dan
            mengirimkan tautan undangan aktivasi Portal Mitra.
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
