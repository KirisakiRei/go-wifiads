import { useMutation } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronUp,
  Download,
  FastForward,
  Gauge,
  Layers,
  Pencil,
  Plus,
  PlusCircle,
  Router,
  Save,
  Sparkles,
  Timer,
  Upload,
  Wifi,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  KpiCard,
  KpiGrid,
  PolicyCard,
  PresetInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { formatDuration } from '@/lib/formatters'
import { profilesApi } from '@/features/profiles/api/profiles.api'
import { profilesQueryKey, useProfiles } from '@/features/profiles/hooks/use-profiles'
import type { ConnectProfile, UpdateProfilePayload } from '@/features/profiles/types/profile.types'
import { routersApi } from '@/features/routers/routers.api'
import type { UpdateRouterVoucherConfigInput } from '@/features/routers/types'
import { useRouters } from '@/features/routers/use-routers'

function formatBw(kbps: number): string {
  if (!kbps || kbps <= 0) return 'Tidak Terbatas'
  if (kbps >= 1024) {
    const mb = kbps / 1024
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)} Mbps`
  }
  return `${kbps} Kbps`
}

function liveDescBw(kbps: number): string {
  if (!kbps || kbps <= 0) return 'Tidak ada batasan kecepatan'
  if (kbps >= 1024) {
    const mb = (kbps / 1024).toFixed(1).replace('.0', '')
    return `≈ ${mb} Mbps (${kbps} Kbps)`
  }
  return `${kbps} Kbps`
}

function liveDescDuration(sec: number): string {
  if (!sec || sec <= 0) return 'Tidak terbatas'
  const hours = Math.floor(sec / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} Jam`)
  if (mins > 0) parts.push(`${mins} Menit`)
  if (parts.length === 0) parts.push(`${sec} Detik`)
  return `≈ ${parts.join(' ')} (${sec} detik)`
}

const BW_DOWN_PRESETS = [
  { label: '512 Kbps', val: 512 },
  { label: '1 Mbps (1024)', val: 1024 },
  { label: '2 Mbps (2048)', val: 2048 },
  { label: '5 Mbps (5120)', val: 5120 },
  { label: '10 Mbps (10240)', val: 10240 },
]

const BW_UP_PRESETS = [
  { label: '256 Kbps', val: 256 },
  { label: '512 Kbps', val: 512 },
  { label: '1 Mbps (1024)', val: 1024 },
  { label: '2 Mbps (2048)', val: 2048 },
]

const DURATION_PRESETS = [
  { label: '30 Menit (1800)', val: 1800 },
  { label: '1 Jam (3600)', val: 3600 },
  { label: '2 Jam (7200)', val: 7200 },
  { label: '6 Jam (21600)', val: 21600 },
  { label: '24 Jam (86400)', val: 86400 },
]

interface ProfileEditState {
  displayName: string
  description: string
  downKbps: number
  upKbps: number
  timeoutSeconds: number
  isActive: boolean
}

interface ProfileEditFormProps {
  profile: ConnectProfile
  onToggle: () => void
  onSave: (payload: UpdateProfilePayload) => void
  isSaving: boolean
}

function ProfileInlineEditor({
  profile,
  onToggle,
  onSave,
  isSaving,
}: ProfileEditFormProps) {
  const [form, setForm] = useState<ProfileEditState>({
    displayName: profile.display_name,
    description: profile.description || '',
    downKbps: profile.bandwidth_down_kbps,
    upKbps: profile.bandwidth_up_kbps,
    timeoutSeconds: profile.session_timeout_seconds,
    isActive: profile.is_active,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      display_name: form.displayName,
      description: form.description,
      bandwidth_down_kbps: Number(form.downKbps),
      bandwidth_up_kbps: Number(form.upKbps),
      session_timeout_seconds: Number(form.timeoutSeconds),
      is_default: profile.is_default,
      is_active: form.isActive,
    })
  }

  return (
    <div style={{ padding: '1.75rem', background: '#fafcff' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={16} />
          </div>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30', margin: 0 }}>
              Edit Master Profil: {profile.display_name}
            </h4>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Identifikasi Paket: <code>{profile.name}</code> • Kuota Kecepatan Jaringan
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
        <div className="form-grid-2col">
          {/* LEFT COLUMN: Metadata */}
          <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
            <div className="form-field">
              <label>Nama Tampilan Profil</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Misal: Paket Cepat 5 Mbps"
                required
              />
              <span className="helper-text">
                Nama paket yang mudah dikenali oleh pengelola.
              </span>
            </div>

            <div className="form-field">
              <label>Keterangan Paket</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Misal: Kecepatan standar untuk browsing umum"
              />
              <span className="helper-text">
                Catatan peruntukan profil agar pengelola tidak salah alokasi.
              </span>
            </div>

            <div className="form-field">
              <label className="no-between">Status Profil</label>
              <PolicyCard
                title="Aktifkan Profil Ini"
                description="Profil yang aktif dapat dipilih pada alokasi metode akses router."
                checked={form.isActive}
                onChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Bandwidth & Duration Controls */}
          <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
            <PresetInput
              label="Batas Kecepatan Unduh / Download (Kbps)"
              icon={Download}
              iconColor="#065f46"
              value={form.downKbps}
              onChange={(downKbps) => setForm({ ...form, downKbps })}
              badgeText={liveDescBw(form.downKbps)}
              helperText="1024 Kbps = 1 Mbps, 5120 Kbps = 5 Mbps."
              min={128}
              max={102400}
              presets={BW_DOWN_PRESETS}
              required
            />

            <PresetInput
              label="Batas Kecepatan Unggah / Upload (Kbps)"
              icon={Upload}
              iconColor="#0369a1"
              value={form.upKbps}
              onChange={(upKbps) => setForm({ ...form, upKbps })}
              badgeText={liveDescBw(form.upKbps)}
              helperText="512 Kbps = 0.5 Mbps, 1024 Kbps = 1 Mbps."
              min={128}
              max={51200}
              presets={BW_UP_PRESETS}
              required
            />

            <PresetInput
              label="Batas Durasi Sesi Pengguna (Detik)"
              icon={Timer}
              value={form.timeoutSeconds}
              onChange={(timeoutSeconds) => setForm({ ...form, timeoutSeconds })}
              badgeText={liveDescDuration(form.timeoutSeconds)}
              helperText="Waktu akses internet yang diberikan kepada pengguna."
              min={60}
              max={604800}
              presets={DURATION_PRESETS}
              required
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
            alignItems: 'center',
          }}
        >
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onToggle}>
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * RouterMethodAssignmentCard
 * Section khusus untuk alokasi metode akses hotspot per router MikroTik
 */
function RouterMethodAssignmentCard({ profiles }: { profiles: ConnectProfile[] }) {
  const { data: routers = [], isLoading: isLoadingRouters } = useRouters()
  const [selectedRouterId, setSelectedRouterId] = useState<string>('')
  const [skipProfileId, setSkipProfileId] = useState<string>('')
  const [surveyProfileId, setSurveyProfileId] = useState<string>('')

  // Set default selected router
  useEffect(() => {
    if (routers.length > 0 && !selectedRouterId) {
      setSelectedRouterId(routers[0].id)
    }
  }, [routers, selectedRouterId])

  const currentRouter = useMemo(
    () => routers.find((r) => r.id === selectedRouterId) || routers[0],
    [routers, selectedRouterId]
  )

  // Sync profile assignment from selected router
  useEffect(() => {
    if (currentRouter) {
      // 1. Skip survey profile (default_profile_id)
      if (currentRouter.default_profile_id) {
        setSkipProfileId(currentRouter.default_profile_id)
      } else if (profiles.length > 0) {
        const def = profiles.find((p) => p.is_default) || profiles[0]
        if (def) setSkipProfileId(def.id)
      }

      // 2. Completed survey profile (survey_profile_id)
      if (currentRouter.survey_profile_id) {
        setSurveyProfileId(currentRouter.survey_profile_id)
      } else if (profiles.length > 0) {
        const surveyProf = profiles.find((p) => !p.is_default && p.is_active) || profiles[profiles.length - 1]
        if (surveyProf) setSurveyProfileId(surveyProf.id)
      }
    }
  }, [currentRouter, profiles])

  const activeProfiles = useMemo(() => profiles.filter((p) => p.is_active), [profiles])

  const selectedSkipProfile = useMemo(
    () => profiles.find((p) => p.id === skipProfileId),
    [profiles, skipProfileId]
  )

  const selectedSurveyProfile = useMemo(
    () => profiles.find((p) => p.id === surveyProfileId),
    [profiles, surveyProfileId]
  )

  const updateMutation = useMutation({
    mutationFn: (input: UpdateRouterVoucherConfigInput) =>
      routersApi.updateVoucherConfig(selectedRouterId, input),
    onSuccess: () => {
      toast.success('Kebijakan metode akses router berhasil disimpan!', {
        description: `Profil berhasil dialokasikan untuk ${currentRouter?.name || 'Router'}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['routers'] })
    },
    onError: (err: Error) => {
      toast.error('Gagal menyimpan kebijakan metode akses', {
        description: err.message,
      })
    },
  })

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRouterId) {
      toast.error('Pilih router MikroTik terlebih dahulu!')
      return
    }
    if (!currentRouter) return

    updateMutation.mutate({
      voucher_prefix: currentRouter.voucher_prefix || 'MK1-',
      voucher_digit_count: currentRouter.voucher_digit_count || 6,
      voucher_numeric_only: currentRouter.voucher_numeric_only ?? true,
      default_profile_id: skipProfileId || undefined,
      survey_profile_id: surveyProfileId || undefined,
      voucher_ttl_seconds: currentRouter.voucher_ttl_seconds || 86400,
      session_timeout_seconds: currentRouter.session_timeout_seconds || 3600,
    })
  }

  if (isLoadingRouters) {
    return (
      <div className="stitch-card-container" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.75rem' }}>
        <span style={{ fontSize: '13px', color: '#64748b' }}>Memuat konfigurasi router...</span>
      </div>
    )
  }

  return (
    <div className="stitch-card-container" style={{ marginBottom: '2rem' }}>
      {/* Header Toolbar */}
      <div
        className="table-toolbar"
        style={{
          padding: '1.25rem 1.5rem',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
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
            <Router size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0b1c30' }}>
              Alokasi Metode Akses Hotspot (Per Router MikroTik)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              Pilih profil master yang otomatis diberikan saat pengguna melewati survei atau mengisi survei data kontak.
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
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <Sparkles size={13} color="#1d4ed8" />
            Distribusi Otomatis Aktif
          </span>
        </div>
      </div>

      <form onSubmit={handleSavePolicy} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fafcff' }}>
        {/* Router Target Selector */}
        <div style={{ background: '#ffffff', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.65rem' }}>
            <label
              htmlFor="select-policy-router"
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
              Target Router MikroTik
            </label>

            {currentRouter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>
                  Lokasi: <strong style={{ color: '#0f172a' }}>{currentRouter.name}</strong>
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
            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '12px' }}>
              Belum ada router MikroTik yang terdaftar di database.
            </div>
          ) : (
            <select
              id="select-policy-router"
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
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — NAS: {r.nas_identifier} (IP: {r.ip_address || '10.10.0.1'})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 2-Method Grid Allocation Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* METHOD 1: SKIP SURVEY */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FastForward size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#0b1c30' }}>
                  Metode: Lewati (Skip) Survey
                </h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Akses langsung tanpa mengisi form kontak
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Pilih Master Profil Internet:
              </label>
              <select
                value={skipProfileId}
                onChange={(e) => setSkipProfileId(e.target.value)}
                style={{
                  padding: '0.7rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff',
                }}
              >
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} (↓ {formatBw(p.bandwidth_down_kbps)} / ↑ {formatBw(p.bandwidth_up_kbps)} — {formatDuration(p.session_timeout_seconds)})
                  </option>
                ))}
              </select>
            </div>

            {selectedSkipProfile && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>Kecepatan: <strong>↓ {formatBw(selectedSkipProfile.bandwidth_down_kbps)}</strong></span>
                <span>Durasi: <strong>{formatDuration(selectedSkipProfile.session_timeout_seconds)}</strong></span>
              </div>
            )}
          </div>

          {/* METHOD 2: COMPLETED SURVEY */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '2px solid #bfdbfe',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 2px 8px rgba(29, 78, 216, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>
                  Metode: Selesai Mengisi Survey
                </h4>
                <span style={{ fontSize: '11px', color: '#1d4ed8' }}>
                  Reward akses lebih cepat untuk pengunjung yang mengisi kontak (Leads)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Pilih Master Profil Internet:
              </label>
              <select
                value={surveyProfileId}
                onChange={(e) => setSurveyProfileId(e.target.value)}
                style={{
                  padding: '0.7rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #93c5fd',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff',
                }}
              >
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} (↓ {formatBw(p.bandwidth_down_kbps)} / ↑ {formatBw(p.bandwidth_up_kbps)} — {formatDuration(p.session_timeout_seconds)})
                  </option>
                ))}
              </select>
            </div>

            {selectedSurveyProfile && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#1e40af',
                }}
              >
                <span>Kecepatan: <strong>↓ {formatBw(selectedSurveyProfile.bandwidth_down_kbps)}</strong></span>
                <span>Durasi: <strong>{formatDuration(selectedSurveyProfile.session_timeout_seconds)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Submit Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingTop: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: '#64748b' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Router akan menerapkan profil secara otomatis sesuai tombol aksi yang ditekan pengunjung di layar captive portal.</span>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending || !selectedRouterId}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
          >
            <Save size={16} />
            {updateMutation.isPending ? 'Menyimpan Kebijakan...' : 'Terapkan Kebijakan ke Router Ini'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ProfilesPage() {
  const { data: profiles, isPending, error } = useProfiles()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state (pure QoS template)
  const [createName, setCreateName] = useState('')
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createDown, setCreateDown] = useState(5120)
  const [createUp, setCreateUp] = useState(2048)
  const [createTimeout, setCreateTimeout] = useState(7200)

  const createMutation = useMutation({
    mutationFn: profilesApi.create,
    onSuccess: () => {
      toast.success('Master profil berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: profilesQueryKey })
      setShowCreate(false)
      setCreateName('')
      setCreateDisplayName('')
      setCreateDesc('')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menambahkan profil')
    },
  })

  const updateMutation = useMutation({
    mutationFn: profilesApi.update,
    onSuccess: () => {
      toast.success('Perubahan profil berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: profilesQueryKey })
      setExpandedId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal memperbarui profil')
    },
  })

  if (isPending) return <LoadingState />
  if (error || !profiles) return <ErrorState message="Tidak dapat menampilkan data profil paket saat ini." />

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      name: createName.trim().toLowerCase().replace(/\s+/g, '-'),
      display_name: createDisplayName,
      description: createDesc,
      bandwidth_down_kbps: Number(createDown) || 1024,
      bandwidth_up_kbps: Number(createUp) || 512,
      session_timeout_seconds: Number(createTimeout) || 3600,
      is_default: false,
      is_active: true,
    })
  }

  const maxDown = profiles.length > 0 ? Math.max(...profiles.map((p) => p.bandwidth_down_kbps)) : 0

  return (
    <div>
      <WavyHeader
        title="Manajemen Profil &amp; Kebijakan Akses"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            {showCreate ? 'Tutup Form' : 'Tambah Master Profil Baru'}
          </button>
        }
      />

      <div className="stitch-page-stage">
        {/* Telemetry Cards from Stitch */}
        <KpiGrid columns={3}>
          <KpiCard
            label="Master Profil Terdaftar"
            value={profiles.length}
            icon={Layers}
            trend={{ label: 'Template Aktif', variant: 'success' }}
            footerLeft="Standar Kecepatan Jaringan"
            footerRight="Template Bandwidth"
          />

          <KpiCard
            label="Rata-rata Durasi Sesi"
            value={
              profiles.length > 0
                ? formatDuration(
                    Math.round(
                      profiles.reduce((acc, p) => acc + p.session_timeout_seconds, 0) /
                        profiles.length
                    )
                  )
                : '0s'
            }
            icon={Timer}
            iconBoxVariant="secondary"
            trend={{ label: 'Durasi Sesi' }}
            footerLeft="Durasi voucher standar"
            footerRight="Koneksi Otomatis"
          />

          <KpiCard
            label="Alokasi Bandwidth Maks"
            value={formatBw(maxDown)}
            icon={Gauge}
            trend={{ label: 'Kecepatan Tertinggi', variant: 'success' }}
            footerLeft="Alokasi Kecepatan Utama"
            footerRight="Pengaturan Bandwidth"
          />
        </KpiGrid>

        {/* SECTION 1: Router Method Assignment Card */}
        <RouterMethodAssignmentCard profiles={profiles} />

        {/* Modal Popup: Tambah Master Profil Baru */}
        {showCreate && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 28, 48, 0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreate(false)
            }}
          >
            <div
              className="stitch-card-container"
              style={{
                width: '100%',
                maxWidth: '860px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
                borderRadius: '16px',
                border: '1px solid #bfdbfe',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
                <div className="table-toolbar-title">
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0b1c30' }}>Tambah Master Profil Baru</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Konfigurasi batas bandwidth dan durasi sesi internet hotspot
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem', borderRadius: '8px' }}
                  onClick={() => setShowCreate(false)}
                  title="Tutup Modal"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} style={{ padding: '1.75rem', display: 'grid', gap: '1.5rem', background: '#ffffff' }}>
                <div className="form-grid-2col">
                  {/* LEFT COLUMN: Identitas Profil */}
                  <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
                    <div className="form-field">
                      <label>Kode Unik Sistem</label>
                      <input
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Misal: paket-10mbps"
                        required
                      />
                      <span className="helper-text">Identifikasi sistem (huruf kecil, tanpa spasi).</span>
                    </div>

                    <div className="form-field">
                      <label>Nama Tampilan Paket</label>
                      <input
                        value={createDisplayName}
                        onChange={(e) => setCreateDisplayName(e.target.value)}
                        placeholder="Misal: Paket Cepat 10 Mbps"
                        required
                      />
                      <span className="helper-text">Nama paket yang tampil pada daftar profil admin.</span>
                    </div>

                    <div className="form-field">
                      <label>Keterangan / Catatan</label>
                      <input
                        value={createDesc}
                        onChange={(e) => setCreateDesc(e.target.value)}
                        placeholder="Misal: Kecepatan tinggi untuk survei lengkap"
                      />
                      <span className="helper-text">Catatan opsional untuk membedakan paket.</span>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Bandwidth & Duration Controls */}
                  <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
                    <PresetInput
                      label="Batas Kecepatan Unduh (Kbps)"
                      icon={Download}
                      iconColor="#065f46"
                      value={createDown}
                      onChange={setCreateDown}
                      badgeText={liveDescBw(createDown)}
                      helperText="Kecepatan download yang dialokasikan ke perangkat pengguna."
                      presets={BW_DOWN_PRESETS}
                      min={0}
                      max={100000}
                    />

                    <PresetInput
                      label="Batas Kecepatan Unggah (Kbps)"
                      icon={Upload}
                      iconColor="#0369a1"
                      value={createUp}
                      onChange={setCreateUp}
                      badgeText={liveDescBw(createUp)}
                      helperText="Kecepatan upload yang dialokasikan ke perangkat pengguna."
                      presets={BW_UP_PRESETS}
                      min={0}
                      max={100000}
                    />

                    <PresetInput
                      label="Durasi Sesi Internet (Detik)"
                      icon={Timer}
                      iconColor="#00668a"
                      value={createTimeout}
                      onChange={setCreateTimeout}
                      badgeText={liveDescDuration(createTimeout)}
                      helperText="Waktu countdown sebelum sesi voucher diputus otomatis."
                      presets={DURATION_PRESETS}
                      min={60}
                      max={604800}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreate(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createMutation.isPending}
                  >
                    <Save size={16} />
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Master Profil'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 2: Master QoS Profiles Table */}
        <div className="stitch-card-container">
          <div className="table-toolbar">
            <div className="table-toolbar-title">
              <Layers size={20} style={{ color: '#1d4ed8' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Daftar Master Profil Internet (QoS)</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Template kecepatan bandwidth dan durasi sesi yang siap dialokasikan ke router hotspot
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span className="status-pill active">{profiles.length} Profil Terdaftar</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '240px' }}>Kode &amp; Nama Paket</th>
                  <th>Kecepatan Unduh</th>
                  <th>Kecepatan Unggah</th>
                  <th>Batas Waktu Sesi</th>
                  <th>Deskripsi Paket</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const isExpanded = expandedId === p.id
                  return (
                    <Fragment key={p.id}>
                      <tr
                        style={{
                          background: isExpanded ? '#f0f7ff' : undefined,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Wifi size={18} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <code
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: '#e0e7ff',
                                    color: '#3730a3',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {p.name}
                                </code>
                                <strong style={{ fontSize: '14px', color: '#0b1c30' }}>
                                  {p.display_name}
                                </strong>
                              </div>
                              <small style={{ color: '#64748b', fontSize: '12px' }}>
                                {p.description || 'Tidak ada deskripsi tambahan.'}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#065f46' }}>
                              ↓ {formatBw(p.bandwidth_down_kbps)}
                            </span>
                            <span style={{ fontSize: '11px', color: '#747686' }}>
                              {p.bandwidth_down_kbps} Kbps
                            </span>
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                              ↑ {formatBw(p.bandwidth_up_kbps)}
                            </span>
                            <span style={{ fontSize: '11px', color: '#747686' }}>
                              {p.bandwidth_up_kbps} Kbps
                            </span>
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0b1c30' }}>
                              {formatDuration(p.session_timeout_seconds)}
                            </span>
                            <span style={{ fontSize: '11px', color: '#747686' }}>
                              {p.session_timeout_seconds} dtk
                            </span>
                          </div>
                        </td>

                        <td style={{ fontSize: '13px', color: '#434655' }}>
                          {p.description || '—'}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {p.is_active ? (
                            <StatusPill variant="active" dot>Aktif</StatusPill>
                          ) : (
                            <StatusPill variant="expired">Nonaktif</StatusPill>
                          )}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontSize: '12px',
                              background: isExpanded ? '#1d4ed8' : '#eff6ff',
                              color: isExpanded ? '#ffffff' : '#1d4ed8',
                              borderColor: isExpanded ? '#1d4ed8' : '#bfdbfe',
                            }}
                            onClick={() => handleToggle(p.id)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <Pencil size={14} />}
                            {isExpanded ? 'Tutup' : 'Edit'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '2px solid #1d4ed8' }}>
                            <ProfileInlineEditor
                              profile={p}
                              onToggle={() => handleToggle(p.id)}
                              onSave={(data) => updateMutation.mutate({ id: p.id, data })}
                              isSaving={updateMutation.isPending}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '0.85rem 1.25rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            <span>Menampilkan {profiles.length} master profil paket</span>
            <span>Standar Alokasi Kecepatan Hotspot</span>
          </div>
        </div>
      </div>
    </div>
  )
}
