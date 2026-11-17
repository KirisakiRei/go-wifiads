import { useMutation } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  Cpu,
  Hash,
  Layers,
  RefreshCw,
  Router,
  Save,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { useProfiles } from '@/features/profiles/hooks/use-profiles'
import { routersApi } from '@/features/routers/routers.api'
import type { UpdateRouterVoucherConfigInput } from '@/features/routers/types'
import { useRouters } from '@/features/routers/use-routers'

const DIGIT_PRESETS = [
  { label: '4 Digit', val: 4 },
  { label: '6 Digit (Standar)', val: 6 },
  { label: '8 Digit (Aman)', val: 8 },
  { label: '10 Digit', val: 10 },
]

const TTL_PRESETS = [
  { label: '1 Jam', val: 3600 },
  { label: '6 Jam', val: 21600 },
  { label: '12 Jam', val: 43200 },
  { label: '24 Jam (1 Hari)', val: 86400 },
  { label: '7 Hari', val: 604800 },
]

const TIMEOUT_PRESETS = [
  { label: '30 Menit', val: 1800 },
  { label: '1 Jam', val: 3600 },
  { label: '2 Jam', val: 7200 },
  { label: '4 Jam', val: 14400 },
  { label: '1 Hari', val: 86400 },
]

export function VoucherConfigCard() {
  const { data: profiles = [] } = useProfiles()
  const { data: routers = [], isLoading: isLoadingRouters } = useRouters()

  const [selectedRouterId, setSelectedRouterId] = useState<string>('')
  const [prefix, setPrefix] = useState<string>('MK1-')
  const [digitCount, setDigitCount] = useState<number>(6)
  const [numericOnly, setNumericOnly] = useState<boolean>(true)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [ttl, setTtl] = useState<number>(86400)
  const [sessionTimeout, setSessionTimeout] = useState<number>(3600)

  // Populate first router when loaded
  useEffect(() => {
    if (routers.length > 0 && !selectedRouterId) {
      setSelectedRouterId(routers[0].id)
    }
  }, [routers, selectedRouterId])

  // Current active router
  const currentRouter = useMemo(
    () => routers.find((r) => r.id === selectedRouterId) || routers[0],
    [routers, selectedRouterId]
  )

  // Populate config from selected router
  useEffect(() => {
    if (currentRouter) {
      setPrefix(currentRouter.voucher_prefix || 'MK1-')
      setDigitCount(currentRouter.voucher_digit_count || 6)
      setNumericOnly(currentRouter.voucher_numeric_only ?? true)
      if (currentRouter.default_profile_id) {
        setSelectedProfileId(currentRouter.default_profile_id)
      } else if (profiles.length > 0) {
        const def = profiles.find((p) => p.is_default) || profiles[0]
        if (def) setSelectedProfileId(def.id)
      }
      setTtl(currentRouter.voucher_ttl_seconds || 86400)
      setSessionTimeout(currentRouter.session_timeout_seconds || 3600)
    }
  }, [currentRouter, profiles])

  // Generate a mock sample preview code
  const sampleVoucherCode = useMemo(() => {
    const chars = numericOnly ? '0123456789' : '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let sample = ''
    for (let i = 0; i < digitCount; i++) {
      sample += chars[(i * 7 + 3) % chars.length]
    }
    return `${prefix || ''}${sample}`
  }, [prefix, digitCount, numericOnly])

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  )

  // Mutation to save router voucher config
  const updateMutation = useMutation({
    mutationFn: (input: UpdateRouterVoucherConfigInput) =>
      routersApi.updateVoucherConfig(selectedRouterId, input),
    onSuccess: () => {
      toast.success('Konfigurasi voucher berhasil disimpan dan tersinkron ke router!', {
        description: `Format voucher ${prefix} (${digitCount} digit) aktif untuk autentikasi hotspot.`,
      })
      queryClient.invalidateQueries({ queryKey: ['routers'] })
    },
    onError: (err: Error) => {
      toast.error('Gagal menyimpan konfigurasi voucher', {
        description: err.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRouterId) {
      toast.error('Pilih router MikroTik terlebih dahulu!')
      return
    }

    updateMutation.mutate({
      voucher_prefix: prefix.trim(),
      voucher_digit_count: Number(digitCount),
      voucher_numeric_only: Boolean(numericOnly),
      default_profile_id: selectedProfileId || undefined,
      survey_profile_id: currentRouter?.survey_profile_id || undefined,
      voucher_ttl_seconds: Number(ttl),
      session_timeout_seconds: Number(sessionTimeout),
    })
  }

  if (isLoadingRouters) {
    return (
      <div className="stitch-card-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#64748b' }}>
          <RefreshCw size={20} className="animate-spin" />
          <span>Memuat konfigurasi router MikroTik...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="stitch-card-container" style={{ marginBottom: '1.75rem' }}>
      {/* Header Bar */}
      <div className="table-toolbar" style={{ padding: '1.25rem 1.5rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="table-toolbar-title" style={{ gap: '0.85rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#0037b0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #dbeafe',
            }}
          >
            <Cpu size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0b1c30' }}>
              Konfigurasi Voucher Otomatis (Per Router MikroTik)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              Atur format voucher dan profil QoS yang otomatis diterbitkan saat user klaim akses di captive portal.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={13} color="#10b981" />
            Tersinkron ke MikroTik Hotspot
          </span>
        </div>
      </div>

      {/* Body Form */}
      <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fafcff' }}>
        {/* 1. Target Router Selector */}
        <div style={{ background: '#ffffff', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.65rem' }}>
            <label
              htmlFor="select-target-router"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                margin: 0,
              }}
            >
              <Router size={16} color="#0037b0" />
              Pilih Target Router MikroTik
            </label>

            {currentRouter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>
                  NAS ID: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{currentRouter.nas_identifier}</strong>
                </span>
                <span style={{ color: '#64748b' }}>
                  IP: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{currentRouter.ip_address || '10.10.0.1'}</strong>
                </span>
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: currentRouter.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                    color: currentRouter.status === 'ACTIVE' ? '#065f46' : '#991b1b',
                  }}
                >
                  {currentRouter.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            )}
          </div>

          {routers.length === 0 ? (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#9f1239',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Router size={16} />
              <span>Belum ada router MikroTik yang terdaftar di database.</span>
            </div>
          ) : (
            <select
              id="select-target-router"
              value={selectedRouterId}
              onChange={(e) => setSelectedRouterId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                color: '#0f172a',
                background: '#ffffff',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {routers.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name} — NAS: {router.nas_identifier} (IP: {router.ip_address || '10.10.0.1'})
                </option>
              ))}
            </select>
          )}
          <span style={{ display: 'block', marginTop: '0.45rem', fontSize: '11px', color: '#64748b' }}>
            Setiap perubahan konfigurasi di bawah akan disimpan dan disinkronkan ke router MikroTik yang dipilih ini.
          </span>
        </div>

        {/* 2. Controls Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Prefix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Hash size={14} color="#64748b" />
              Prefix Kode Voucher
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Contoh: MK1-, CAFE-, LOBBY-"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'monospace',
                background: '#ffffff',
                outline: 'none',
              }}
              required
            />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Awalan penanda asal router / lokasi</span>
          </div>

          {/* Digit Count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={14} color="#64748b" />
              Panjang Digit Kode
            </label>
            <select
              value={digitCount}
              onChange={(e) => setDigitCount(Number(e.target.value))}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {DIGIT_PRESETS.map((p) => (
                <option key={p.val} value={p.val}>
                  {p.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Jumlah digit acak setelah prefix</span>
          </div>

          {/* Charset Format */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} color="#64748b" />
              Tipe Karakter Voucher
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', height: '39px' }}>
              <button
                type="button"
                onClick={() => setNumericOnly(true)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.5rem',
                  borderRadius: '10px',
                  border: numericOnly ? '2px solid #0037b0' : '1px solid #cbd5e1',
                  background: numericOnly ? '#eff6ff' : '#ffffff',
                  color: numericOnly ? '#0037b0' : '#475569',
                  fontWeight: numericOnly ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Hanya Angka (0-9)
              </button>
              <button
                type="button"
                onClick={() => setNumericOnly(false)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.5rem',
                  borderRadius: '10px',
                  border: !numericOnly ? '2px solid #0037b0' : '1px solid #cbd5e1',
                  background: !numericOnly ? '#eff6ff' : '#ffffff',
                  color: !numericOnly ? '#0037b0' : '#475569',
                  fontWeight: !numericOnly ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Alfanumerik (A-Z, 0-9)
              </button>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Hanya angka lebih mudah diketik di HP</span>
          </div>

          {/* Default Profile QoS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Wifi size={14} color="#64748b" />
              Profil Paket Internet (QoS)
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {profiles.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.display_name} ({prof.bandwidth_down_kbps / 1000}M / {prof.bandwidth_up_kbps / 1000}M)
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Bandwidth limit & durasi paket user</span>
          </div>
        </div>

        {/* 3. Secondary Row: TTL & Session Timeout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} color="#64748b" />
              Masa Berlaku Voucher Sebelum Dipakai (TTL)
            </label>
            <select
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {TTL_PRESETS.map((p) => (
                <option key={p.val} value={p.val}>
                  {p.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Voucher kadaluarsa jika tidak dipakai dalam batas waktu ini
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} color="#64748b" />
              Batas Durasi Sesi Internet (Session-Timeout)
            </label>
            <select
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(Number(e.target.value))}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {TIMEOUT_PRESETS.map((p) => (
                <option key={p.val} value={p.val}>
                  {p.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Durasi koneksi internet yang diberikan ke perangkat setelah login
            </span>
          </div>
        </div>

        {/* 4. Live Preview Box & Save Button */}
        <div
          style={{
            borderRadius: '14px',
            border: '1px solid #bfdbfe',
            background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1d4ed8' }}>
                Live Preview Kode Voucher yang Akan Digenerate
              </span>
              <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'baseline', gap: '0.85rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '22px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    color: '#0f172a',
                    background: '#ffffff',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #93c5fd',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {sampleVoucherCode}
                </span>
                {selectedProfile && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Paket: <strong style={{ color: '#0037b0' }}>{selectedProfile.display_name}</strong> (
                    {selectedProfile.bandwidth_down_kbps / 1000} Mbps Down /{' '}
                    {selectedProfile.bandwidth_up_kbps / 1000} Mbps Up)
                  </span>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0, 55, 176, 0.25)',
                }}
              >
                {updateMutation.isPending ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Simpan &amp; Sinkronkan Konfigurasi
                  </>
                )}
              </button>
            </div>
          </div>

          <div
            style={{
              paddingTop: '0.85rem',
              borderTop: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              fontSize: '12px',
              color: '#334155',
              lineHeight: 1.5,
            }}
          >
            <ShieldCheck size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span>
              <strong>Smart Deduplication &amp; Reuse Aktif:</strong> Jika user gagal login atau mengalami gangguan koneksi dari perangkat yang sama (MAC &amp; IP terdaftar), sistem tidak akan menghasilkan voucher baru yang menyampah. Voucher yang masih valid (status ISSUED) akan otomatis dicoba kembali. Voucher baru hanya diterbitkan jika voucher lama telah kadaluarsa.
            </span>
          </div>
        </div>
      </form>
    </div>
  )
}
