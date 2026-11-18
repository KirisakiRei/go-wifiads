import { useMutation } from '@tanstack/react-query'
import {
  CheckCircle2,
  Cpu,
  Gauge,
  Hash,
  Layers,
  RefreshCw,
  Router,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { useProfiles } from '@/features/profiles/hooks/use-profiles'
import { routersApi } from '@/features/routers/routers.api'
import type { UpdateRouterVoucherConfigInput } from '@/features/routers/types'
import { useRouters } from '@/features/routers/use-routers'

const DIGIT_PRESETS = [
  { label: '4 Karakter', val: 4 },
  { label: '6 Karakter', val: 6 },
  { label: '8 Karakter', val: 8 },
  { label: '10 Karakter', val: 10 },
]

export function VoucherConfigCard() {
  const { data: profiles = [] } = useProfiles()
  const { data: routers = [], isLoading: isLoadingRouters } = useRouters()

  const [selectedRouterId, setSelectedRouterId] = useState<string>('')
  const [prefix, setPrefix] = useState<string>('MK1-')
  const [digitCount, setDigitCount] = useState<number>(6)
  const [numericOnly, setNumericOnly] = useState<boolean>(true)

  useEffect(() => {
    if (routers.length > 0 && !selectedRouterId) {
      setSelectedRouterId(routers[0].id)
    }
  }, [routers, selectedRouterId])

  const currentRouter = useMemo(
    () => routers.find((r) => r.id === selectedRouterId) || routers[0],
    [routers, selectedRouterId]
  )

  useEffect(() => {
    if (currentRouter) {
      setPrefix(currentRouter.voucher_prefix || 'MK1-')
      setDigitCount(currentRouter.voucher_digit_count || 6)
      setNumericOnly(currentRouter.voucher_numeric_only ?? true)
    }
  }, [currentRouter])

  const sampleVoucherCode = useMemo(() => {
    const chars = numericOnly ? '0123456789' : '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let sample = ''
    for (let i = 0; i < digitCount; i++) {
      sample += chars[(i * 7 + 3) % chars.length]
    }
    return `${prefix || ''}${sample}`
  }, [prefix, digitCount, numericOnly])

  const defaultProfile = useMemo(
    () => profiles.find((p) => p.is_default) || profiles[0],
    [profiles]
  )

  const premiumProfile = useMemo(
    () => profiles.find((p) => !p.is_default),
    [profiles]
  )

  const updateMutation = useMutation({
    mutationFn: (input: UpdateRouterVoucherConfigInput) =>
      routersApi.updateVoucherConfig(selectedRouterId, input),
    onSuccess: () => {
      toast.success('Format kode voucher berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['routers'] })
    },
    onError: (err: Error) => {
      toast.error('Gagal menyimpan format voucher', {
        description: err.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRouterId) {
      toast.error('Pilih router terlebih dahulu')
      return
    }

    updateMutation.mutate({
      voucher_prefix: prefix.trim(),
      voucher_digit_count: Number(digitCount),
      voucher_numeric_only: Boolean(numericOnly),
      default_profile_id: currentRouter?.default_profile_id || undefined,
      survey_profile_id: currentRouter?.survey_profile_id || undefined,
      voucher_ttl_seconds: currentRouter?.voucher_ttl_seconds || 86400,
      session_timeout_seconds: currentRouter?.session_timeout_seconds || 3600,
    })
  }

  if (isLoadingRouters) {
    return (
      <div className="stitch-card-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#64748b' }}>
          <RefreshCw size={20} className="animate-spin" />
          <span>Memuat format kode voucher...</span>
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
              Format Kode Voucher per Router
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              Atur awalan kode dan jumlah karakter voucher untuk setiap router.
            </p>
          </div>
        </div>

        <Link
          to="/profiles"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '9999px',
            background: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <Gauge size={14} />
          Atur Kecepatan di Profil Paket &rarr;
        </Link>
      </div>

      {/* Body Form */}
      <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#fafcff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.15rem' }}>
          {/* Target Router */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Router size={14} color="#0037b0" />
              Pilih Router
            </label>
            <select
              value={selectedRouterId}
              onChange={(e) => setSelectedRouterId(e.target.value)}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 600,
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.nas_identifier})
                </option>
              ))}
            </select>
          </div>

          {/* Prefix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Hash size={14} color="#64748b" />
              Awalan Kode (Prefix)
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
          </div>

          {/* Digit Count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={14} color="#64748b" />
              Panjang Karakter Acak
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
          </div>

          {/* Charset Format */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} color="#64748b" />
              Jenis Karakter
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
                }}
              >
                Angka
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
                }}
              >
                Huruf &amp; Angka
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Box & Save Button */}
        <div
          style={{
            borderRadius: '14px',
            border: '1px solid #bfdbfe',
            background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
            padding: '1.15rem 1.4rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1d4ed8', display: 'block' }}>
                Contoh Kode Voucher
              </span>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '0.3rem',
                  fontSize: '20px',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  color: '#0f172a',
                  background: '#ffffff',
                  padding: '0.3rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid #93c5fd',
                }}
              >
                {sampleVoucherCode}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>
                  <strong>Tanpa Kontak:</strong> Paket{' '}
                  <strong>{defaultProfile?.display_name || 'Standar'}</strong>
                </span>
              </div>
              {premiumProfile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                  <ShieldCheck size={14} color="#2563eb" />
                  <span>
                    <strong>Isi Kontak:</strong> Paket{' '}
                    <strong>{premiumProfile.display_name}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn btn-primary"
            style={{
              padding: '0.7rem 1.35rem',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '10px',
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
                Simpan Format Kode
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
