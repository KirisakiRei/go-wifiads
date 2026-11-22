import { CheckCircle2, Play, ShieldCheck, Wifi } from 'lucide-react'
import { useState } from 'react'

type StepKey = 'welcome' | 'ad' | 'connected'

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'welcome', label: '1. Masuk Wi-Fi' },
  { key: 'ad', label: '2. Tayangan Iklan' },
  { key: 'connected', label: '3. Terhubung' },
]

export function CaptivePhonePreview() {
  const [step, setStep] = useState<StepKey>('welcome')

  return (
    <div>
      <div className="pub-phone-shell" aria-label="Simulasi layar Captive Portal HP">
        <div className="pub-phone-screen">
          <div className="pub-phone-bar">
            <span>Wi-Fi Gratis · Kafe Mitra</span>
            <span>09:41</span>
          </div>

          {step === 'welcome' && (
            <div className="pub-phone-body">
              <div>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0037b0, #00668a)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Wifi size={22} />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0b1c30', lineHeight: 1.25 }}>
                  Selamat Datang di Wi-Fi Gratis
                </div>
                <p style={{ fontSize: '12.5px', color: '#475569', marginTop: '8px', lineHeight: 1.55 }}>
                  Tonton tayangan sponsor singkat 10 detik untuk langsung terhubung ke internet
                  berkecepatan tinggi tanpa password rumit.
                </p>
              </div>

              <div
                style={{
                  background: '#eef4ff',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#1e3a8a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} />
                <span>Aman & cepat, kompatibel Android & iPhone</span>
              </div>

              <button
                type="button"
                className="pub-btn pub-btn-primary"
                style={{ width: '100%' }}
                onClick={() => setStep('ad')}
              >
                Hubungkan Sekarang
              </button>
            </div>
          )}

          {step === 'ad' && (
            <div className="pub-phone-body" style={{ background: '#0b1c30', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.14)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                  }}
                >
                  Sponsor · 10 dtk
                </span>
                <span style={{ fontSize: '11px', color: '#93c5fd' }}>100% Viewability</span>
              </div>

              <div
                style={{
                  flex: 1,
                  borderRadius: '14px',
                  background: 'linear-gradient(155deg, #1d4ed8 0%, #00668a 100%)',
                  padding: '20px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Play size={22} fill="#fff" />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800 }}>Promo Brand Lokal Anda</div>
                <div style={{ fontSize: '12px', color: '#e0f2fe', lineHeight: 1.5 }}>
                  Tampil layar penuh saat pengunjung baru terhubung, dengan durasi diverifikasi
                  server.
                </div>
              </div>

              <button
                type="button"
                className="pub-btn"
                style={{ width: '100%', background: '#10b981', color: '#fff' }}
                onClick={() => setStep('connected')}
              >
                Lanjut ke Internet →
              </button>
            </div>
          )}

          {step === 'connected' && (
            <div className="pub-phone-body">
              <div style={{ textAlign: 'center', paddingTop: '14px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '999px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <CheckCircle2 size={28} />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0b1c30' }}>
                  Anda Sudah Online!
                </div>
                <p style={{ fontSize: '12.5px', color: '#475569', marginTop: '6px' }}>
                  Voucher RADIUS aktif otomatis · Bagi hasil langsung tercatat ke dompet mitra.
                </p>
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: '#64748b' }}>Sisa Waktu</div>
                  <div style={{ fontWeight: 700, marginTop: '2px' }}>59 mnt</div>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Kecepatan</div>
                  <div style={{ fontWeight: 700, marginTop: '2px' }}>Up to 20 Mbps</div>
                </div>
              </div>

              <button
                type="button"
                className="pub-btn pub-btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setStep('welcome')}
              >
                Ulangi Simulasi
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="pub-step-tabs" role="tablist" aria-label="Langkah simulasi Captive Portal">
        {STEPS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={step === s.key}
            className={`pub-step-pill${step === s.key ? ' active' : ''}`}
            onClick={() => setStep(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
