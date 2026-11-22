import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CloudUpload,
  Crosshair,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Save,
  Send,
  Users,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import { RouterClusterMap } from '@/components/map/router-cluster-map'
import { AdPortalPreview, SearchInput, WavyHeader } from '@/components/ui'
import { useCurrentAdvertiser } from '@/features/advertiser-portal/hooks/use-current-advertiser'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import { formatBytes, formatRupiah } from '@/lib/formatters'

const STEPS = [
  { num: 1, title: 'Materi Iklan', subtitle: 'Unggah foto atau video' },
  { num: 2, title: 'Lokasi Router', subtitle: 'Pilih titik di peta' },
  { num: 3, title: 'Jadwal & Harga', subtitle: 'Jam tayang & anggaran' },
  { num: 4, title: 'Konfirmasi', subtitle: 'Tinjau & simpan' },
]

const DAYS_OPTIONS = [
  { key: '1', label: 'Sen' },
  { key: '2', label: 'Sel' },
  { key: '3', label: 'Rab' },
  { key: '4', label: 'Kam' },
  { key: '5', label: 'Jum' },
  { key: '6', label: 'Sab' },
  { key: '7', label: 'Min' },
]

function toDateInputValue(iso?: string): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function AdvertiserCampaignWizardPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: advertiser } = useCurrentAdvertiser()

  const { data: configData, isPending: isLoadingConfig } = useQuery({
    queryKey: ['adv-config'],
    queryFn: advertiserApi.getConfig,
  })
  const { data: mapRouters = [], isPending: isLoadingRouters } = useQuery({
    queryKey: ['adv-map-routers'],
    queryFn: advertiserApi.listMapRouters,
  })
  const {
    data: existingCampaign,
    isPending: isLoadingExisting,
    error: existingError,
  } = useQuery({
    queryKey: ['adv-campaign', id],
    queryFn: () => advertiserApi.getCampaign(id!),
    enabled: isEdit,
  })

  const initialStepParam = Number(searchParams.get('step'))
  const [step, setStep] = useState<1 | 2 | 3 | 4>(
    initialStepParam >= 1 && initialStepParam <= 4 ? (initialStepParam as 1 | 2 | 3 | 4) : 1
  )

  // Step 1: Creative
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')
  const localBlobRef = useRef<string>('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [layoutMode, setLayoutMode] = useState<'landscape' | 'portrait'>('landscape')
  const [durationSeconds, setDurationSeconds] = useState<number>(15)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [totalBytes, setTotalBytes] = useState(0)
  const [uploadedFileName, setUploadedFileName] = useState('')

  // Step 2: Router Map Selection
  const [selectedRouterIds, setSelectedRouterIds] = useState<string[]>([])
  const [routerSearch, setRouterSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [focusRouterId, setFocusRouterId] = useState<string | null>(null)
  const [focusSeq, setFocusSeq] = useState(0)

  // Step 3: Schedule & Budget
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(22)
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5', '6', '7'])
  const [dailyBudget, setDailyBudget] = useState<number>(25000)
  const [totalBudget, setTotalBudget] = useState<number>(150000)
  const [hydratedId, setHydratedId] = useState<string>('')

  useEffect(() => {
    return () => {
      if (localBlobRef.current) {
        URL.revokeObjectURL(localBlobRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isEdit && existingCampaign && hydratedId !== existingCampaign.id) {
      setTitle(existingCampaign.title || '')
      setBody(existingCampaign.body || '')
      setTargetUrl(existingCampaign.target_url || '')
      setMediaUrl(existingCampaign.image_url || '')
      setMediaType(existingCampaign.media_type || 'image')
      setLayoutMode(existingCampaign.layout_mode || 'landscape')
      setDurationSeconds(existingCampaign.duration_seconds || 15)
      setSelectedRouterIds((existingCampaign.target_routers || []).map((r) => r.router_id))
      setStartDate(toDateInputValue(existingCampaign.start_date))
      setEndDate(toDateInputValue(existingCampaign.end_date))
      const is24h = existingCampaign.start_hour === 0 && existingCampaign.end_hour === 24
      setAllDay(is24h)
      setStartHour(is24h ? 8 : existingCampaign.start_hour)
      setEndHour(is24h ? 22 : existingCampaign.end_hour)
      const parsedDays = (existingCampaign.active_days || '1,2,3,4,5,6,7')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
      setSelectedDays(parsedDays.length > 0 ? parsedDays : ['1', '2', '3', '4', '5', '6', '7'])
      setDailyBudget(existingCampaign.daily_budget_idr ?? 0)
      setTotalBudget(existingCampaign.total_budget_idr ?? 0)
      setHydratedId(existingCampaign.id)
    }
  }, [isEdit, existingCampaign, hydratedId])

  const maxAllowedDuration = configData?.setting.max_ad_duration_seconds || 30
  const baseImgPrice = configData?.setting.base_price_image_idr || 50
  const baseVidPrice = configData?.setting.base_price_video_idr || 50

  const buildPayload = (saveAsDraft = false) => ({
    title: title.trim(),
    body: body.trim(),
    image_url: mediaUrl,
    target_url: targetUrl.trim(),
    media_type: mediaType,
    layout_mode: layoutMode,
    duration_seconds: Math.min(maxAllowedDuration, Math.max(5, Number(durationSeconds) || 15)),
    router_ids: selectedRouterIds,
    start_date: startDate,
    end_date: endDate,
    start_hour: allDay ? 0 : startHour,
    end_hour: allDay ? 24 : endHour,
    active_days: selectedDays.join(','),
    daily_budget_idr: Number(dailyBudget) || 0,
    total_budget_idr: Number(totalBudget) || 0,
    save_as_draft: saveAsDraft,
  })

  const submitMutation = useMutation({
    mutationFn: (saveAsDraft: boolean) =>
      isEdit && id
        ? advertiserApi.updateCampaign(id, buildPayload(saveAsDraft))
        : advertiserApi.createCampaign(buildPayload(saveAsDraft)),
    onSuccess: (saved, saveAsDraft) => {
      toast.success(
        saveAsDraft
          ? 'Iklan disimpan sebagai Draft! Anda bisa melanjutkannya kapan saja.'
          : isEdit
            ? 'Perubahan iklan berhasil disimpan!'
            : 'Iklan berhasil diajukan!'
      )
      queryClient.invalidateQueries({ queryKey: ['adv-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['adv-campaign', saved.id] })
      queryClient.invalidateQueries({ queryKey: ['adv-overview'] })
      navigate(isEdit ? `/campaigns/${saved.id}` : '/campaigns')
    },
    onError: (err: Error) =>
      toast.error(err.message || (isEdit ? 'Gagal menyimpan perubahan iklan' : 'Gagal mengajukan iklan')),
  })

  const availableTiers = useMemo(() => {
    const set = new Set<string>()
    mapRouters.forEach((r) => {
      if (r.tier_name) set.add(r.tier_name)
    })
    return Array.from(set).sort()
  }, [mapRouters])

  const filteredRouters = useMemo(() => {
    return mapRouters.filter((r) => {
      const q = routerSearch.toLowerCase()
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.location_address || '').toLowerCase().includes(q)
      const matchCat = !categoryFilter || r.venue_category === categoryFilter
      const matchTier = !tierFilter || r.tier_name === tierFilter
      const matchOnline = !onlineOnly || r.is_connected
      return matchSearch && matchCat && matchTier && matchOnline
    })
  }, [mapRouters, routerSearch, categoryFilter, tierFilter, onlineOnly])

  const selectedRouters = useMemo(
    () => mapRouters.filter((r) => selectedRouterIds.includes(r.id)),
    [mapRouters, selectedRouterIds]
  )

  const totalEstimatedDailyVisitors = useMemo(
    () => selectedRouters.reduce((sum, r) => sum + (r.avg_daily_visitors || 0), 0),
    [selectedRouters]
  )

  const pricingSummary = useMemo(() => {
    if (selectedRouters.length === 0) {
      const base = mediaType === 'video' ? baseVidPrice : baseImgPrice
      return { minPrice: base, maxPrice: base, avgPrice: base, estimatedImpressions: 0 }
    }
    const prices = selectedRouters.map((r) =>
      mediaType === 'video' ? r.price_video_idr : r.price_image_idr
    )
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    const budgetRef =
      totalBudget > 0
        ? totalBudget
        : dailyBudget > 0
          ? dailyBudget
          : advertiser?.wallet_balance_idr || 0
    const estimatedImpressions = avgPrice > 0 && budgetRef > 0 ? Math.floor(budgetRef / avgPrice) : 0
    return { minPrice, maxPrice, avgPrice, estimatedImpressions }
  }, [
    selectedRouters,
    mediaType,
    baseImgPrice,
    baseVidPrice,
    totalBudget,
    dailyBudget,
    advertiser?.wallet_balance_idr,
  ])

  if (isLoadingConfig || isLoadingRouters || (isEdit && isLoadingExisting)) {
    return <LoadingState />
  }
  if (isEdit && (existingError || !existingCampaign)) {
    return <ErrorState message="Data iklan yang ingin diubah tidak ditemukan." />
  }

  const handleFileUpload = async (file: File) => {
    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)

    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current)
    }
    const objURL = URL.createObjectURL(file)
    localBlobRef.current = objURL
    setLocalPreviewUrl(objURL)
    setMediaType(isVid ? 'video' : 'image')

    if (isVid) {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.onloadedmetadata = () => {
        const w = vid.videoWidth || 1920
        const h = vid.videoHeight || 1080
        const dur = Math.min(maxAllowedDuration, Math.max(5, Math.round(vid.duration || 15)))
        setLayoutMode(w >= h ? 'landscape' : 'portrait')
        setDurationSeconds(dur)
      }
      vid.src = objURL
    } else {
      const img = new Image()
      img.onload = () => {
        setLayoutMode((img.naturalWidth || 1920) >= (img.naturalHeight || 1080) ? 'landscape' : 'portrait')
      }
      img.src = objURL
    }

    try {
      setUploading(true)
      setUploadedFileName(file.name)
      setTotalBytes(file.size)
      setUploadedBytes(0)
      setUploadPercent(0)

      const res = await advertiserApi.uploadMedia(file, (p) => {
        setUploadedBytes(p.loaded)
        setTotalBytes(p.total)
        setUploadPercent(p.percent)
      })
      setUploadPercent(100)
      setMediaUrl(res.url)
      toast.success('Berkas iklan berhasil diunggah')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah berkas')
    } finally {
      setUploading(false)
    }
  }

  const toggleRouter = (routerId: string) => {
    setSelectedRouterIds((prev) =>
      prev.includes(routerId) ? prev.filter((rid) => rid !== routerId) : [...prev, routerId]
    )
  }

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayKey)) {
        return prev.length > 1 ? prev.filter((d) => d !== dayKey) : prev
      }
      return [...prev, dayKey].sort()
    })
  }

  const validateBeforeStep = (targetStep: 1 | 2 | 3 | 4): boolean => {
    if (targetStep > 1) {
      if (!title.trim()) {
        toast.error('Judul iklan wajib diisi')
        setStep(1)
        return false
      }
      if (!mediaUrl) {
        toast.error('Unggah foto atau video iklan terlebih dahulu')
        setStep(1)
        return false
      }
    }
    if (targetStep > 2 && selectedRouterIds.length === 0) {
      toast.error('Pilih minimal satu lokasi router pada peta atau daftar')
      setStep(2)
      return false
    }
    if (targetStep > 3 && !allDay && startHour >= endHour) {
      toast.error('Jam selesai harus lebih besar dari jam mulai')
      setStep(3)
      return false
    }
    return true
  }

  const handleNextStep = () => {
    const next = (step + 1) as 1 | 2 | 3 | 4
    if (validateBeforeStep(next)) {
      setStep(next)
    }
  }

  const handleSubmitFinal = () => {
    if (!validateBeforeStep(4)) return
    submitMutation.mutate(false)
  }

  const handleSaveDraft = () => {
    if (!validateBeforeStep(4)) return
    submitMutation.mutate(true)
  }

  const livePreviewUrl = localPreviewUrl || mediaUrl

  return (
    <div>
      <WavyHeader
        title={isEdit ? `Edit Iklan: ${existingCampaign?.title || ''}` : 'Pasang Iklan Baru'}
        actions={
          <Link to={isEdit && id ? `/campaigns/${id}` : '/campaigns'} className="btn btn-secondary">
            <ArrowLeft size={16} /> {isEdit ? 'Kembali ke Detail' : 'Daftar Iklan Saya'}
          </Link>
        }
      />

      <div className="stitch-page-stage">
        {/* Horizontal Stepper Header */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '1.1rem 1.4rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.85rem',
          }}
        >
          {STEPS.map((s) => {
            const isActive = step === s.num
            const isDone = step > s.num
            const canJump = isEdit || s.num < step
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (canJump && validateBeforeStep(s.num as 1 | 2 | 3 | 4)) {
                    setStep(s.num as 1 | 2 | 3 | 4)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '12px',
                  border: isActive ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: isActive ? '#eff6ff' : isDone ? '#f0fdf4' : '#f8fafc',
                  cursor: canJump ? 'pointer' : 'default',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: isDone ? '#16a34a' : isActive ? '#2563eb' : '#cbd5e1',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    flexShrink: 0,
                  }}
                >
                  {isDone ? <Check size={16} /> : s.num}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{s.title}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{s.subtitle}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ==================== STEP 1: UPLOAD CREATIVE ==================== */}
        {step === 1 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1.2rem' }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  1. Materi &amp; Informasi Iklan
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '12px', color: '#64748b' }}>
                  Unggah gambar atau video promosi Anda beserta judul yang menarik.
                </p>
              </div>

              <div className="form-field">
                <label>Judul Iklan *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Diskon 30% Menu Kopi Susu Gula Aren"
                  required
                />
              </div>

              <div className="form-field">
                <label>Keterangan Singkat</label>
                <textarea
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Contoh: Tunjukkan promo ini ke kasir untuk potongan langsung."
                />
              </div>

              <div className="form-field">
                <label>Link Tujuan / Promo (Opsional)</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://instagram.com/brandanda atau https://wa.me/62812..."
                />
                <span className="helper-text">
                  Pengunjung Wi-Fi dapat langsung mengunjungi halaman promo Anda setelah terhubung.
                </span>
              </div>

              {/* Upload Zone */}
              <div
                style={{
                  border: '2px dashed #93c5fd',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: '#f8fbff',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('adv-media-input')?.click()}
              >
                <input
                  id="adv-media-input"
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    color: '#2563eb',
                    marginBottom: '0.4rem',
                  }}
                >
                  <ImageIcon size={26} />
                  <Film size={26} />
                </div>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                  {uploading
                    ? 'Mengunggah Berkas...'
                    : mediaUrl
                      ? 'Ganti Berkas Gambar / Video'
                      : 'Klik untuk Memilih Gambar atau Video'}
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Gambar (JPG, PNG, WebP maks. 10 MB) • Video (MP4, WebM maks. 50 MB)
                </span>
              </div>

              {(uploading || mediaUrl) && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                      {uploading ? (
                        <CloudUpload size={15} color="#2563eb" />
                      ) : (
                        <CheckCircle2 size={15} color="#16a34a" />
                      )}
                      {uploadedFileName || 'Berkas iklan siap ditayangkan'}
                    </span>
                    <strong>{uploading ? `${uploadPercent}%` : 'Siap'}</strong>
                  </div>
                  {uploading && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '0.35rem' }}>
                      {formatBytes(uploadedBytes)} dari {formatBytes(totalBytes)}
                    </div>
                  )}
                  <div
                    style={{
                      height: '7px',
                      borderRadius: '999px',
                      background: '#e2e8f0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${uploading ? uploadPercent : 100}%`,
                        height: '100%',
                        background: uploading ? '#2563eb' : '#16a34a',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-field">
                  <label>Orientasi Tampilan</label>
                  <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as 'landscape' | 'portrait')}
                  >
                    <option value="landscape">Landscape — Tampilan Desktop (16:9)</option>
                    <option value="portrait">Portrait — Tampilan Smartphone (9:16)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Durasi Tayang (Maks. {maxAllowedDuration} Detik)</label>
                  <input
                    type="number"
                    min={5}
                    max={maxAllowedDuration}
                    value={durationSeconds}
                    onChange={(e) =>
                      setDurationSeconds(
                        Math.min(maxAllowedDuration, Math.max(5, Number(e.target.value) || 5))
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Realistic Live Preview (Desktop 16:9 / Smartphone 9:16) */}
            <div
              className="stitch-card-container"
              style={{
                background: '#ffffff',
                padding: '1.5rem',
                position: 'sticky',
                top: '84px',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                  Pratinjau di Layar Pengunjung
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '12px', color: '#64748b' }}>
                  Menyesuaikan ukuran desktop untuk landscape dan layar ponsel untuk portrait.
                </p>
              </div>

              <AdPortalPreview
                title={title}
                body={body}
                mediaUrl={livePreviewUrl}
                mediaType={mediaType}
                layoutMode={layoutMode}
                durationSeconds={durationSeconds}
                targetUrl={targetUrl}
              />
            </div>
          </div>
        )}

        {/* ==================== STEP 2: LEAFLET CLUSTER MAP SELECTION ==================== */}
        {step === 2 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.35rem', display: 'grid', gap: '1rem' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    2. Pilih Lokasi Router di Peta
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '12px', color: '#64748b' }}>
                    Klik titik lokasi pada peta untuk melihat tarif per tayang dan memilih router target.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '12px' }}
                  >
                    <option value="">Semua Kategori</option>
                    <option value="Kafe">Kafe</option>
                    <option value="Restoran">Restoran</option>
                    <option value="Coworking">Coworking</option>
                    <option value="Kampus">Kampus</option>
                    <option value="Area Publik">Area Publik</option>
                  </select>
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '12px' }}
                  >
                    <option value="">Semua Rank / Tier</option>
                    {availableTiers.map((t) => (
                      <option key={t} value={t}>
                        Rank {t}
                      </option>
                    ))}
                  </select>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      padding: '0.38rem 0.65rem',
                      borderRadius: '8px',
                      background: onlineOnly ? '#ecfdf5' : '#f8fafc',
                      border: `1px solid ${onlineOnly ? '#a7f3d0' : '#e2e8f0'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={onlineOnly}
                      onChange={(e) => setOnlineOnly(e.target.checked)}
                    />
                    Hanya Online
                  </label>
                </div>
              </div>

              <RouterClusterMap
                routers={filteredRouters}
                selectedIds={selectedRouterIds}
                mediaType={mediaType}
                onToggleSelect={toggleRouter}
                focusRouterId={focusRouterId}
                focusSeq={focusSeq}
                height={430}
              />
            </div>

            {/* Right Panel: Router List & Selection Summary */}
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.35rem', display: 'grid', gap: '0.9rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  Daftar Lokasi ({selectedRouterIds.length} dipilih)
                </strong>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const merged = new Set([...selectedRouterIds, ...filteredRouters.map((r) => r.id)])
                      setSelectedRouterIds(Array.from(merged))
                    }}
                    style={{
                      border: 'none',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {categoryFilter || tierFilter || onlineOnly ? 'Pilih Sesuai Filter' : 'Pilih Semua'}
                  </button>
                  {selectedRouterIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedRouterIds([])}
                      style={{
                        border: 'none',
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Estimated Daily Visitors Summary Strip */}
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '0.6rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0369a1', fontWeight: 600 }}>
                  <Users size={14} /> Est. Total Pengunjung / Hari
                </span>
                <strong style={{ color: '#0c4a6e', fontSize: '13.5px' }}>
                  {totalEstimatedDailyVisitors.toLocaleString('id-ID')} perangkat
                </strong>
              </div>

              <SearchInput
                placeholder="Cari nama kafe atau alamat..."
                value={routerSearch}
                onChange={(e) => setRouterSearch(e.target.value)}
                style={{ width: '100%' }}
              />

              <div
                style={{
                  maxHeight: '350px',
                  overflowY: 'auto',
                  display: 'grid',
                  gap: '0.6rem',
                  paddingRight: '2px',
                }}
              >
                {filteredRouters.map((r) => {
                  const selected = selectedRouterIds.includes(r.id)
                  const unitPrice = mediaType === 'video' ? r.price_video_idr : r.price_image_idr
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleRouter(r.id)}
                      style={{
                        padding: '0.8rem 0.95rem',
                        borderRadius: '12px',
                        border: selected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: selected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            title={r.is_connected ? 'Router Online' : 'Router Offline'}
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: r.is_connected ? '#10b981' : '#ef4444',
                              flexShrink: 0,
                            }}
                          />
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{r.name}</strong>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {r.venue_category} • Rank {r.tier_name} ({r.multiplier}x) • ~{r.avg_daily_visitors}/hari
                        </div>
                        {r.location_address && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                            {r.location_address}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '13px', color: '#1d4ed8', display: 'block' }}>
                            {formatRupiah(unitPrice)}
                          </strong>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>per tayang</span>
                        </div>
                        {r.latitude != null && r.longitude != null && (
                          <button
                            type="button"
                            title="Fokus ke lokasi ini di peta"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFocusRouterId(r.id)
                              setFocusSeq((s) => s + 1)
                            }}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#1d4ed8',
                              borderRadius: '8px',
                              padding: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Crosshair size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: PRICING, SCHEDULE & BUDGET ==================== */}
        {step === 3 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1.25rem' }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  3. Jadwal Tayang &amp; Pengaturan Anggaran
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '12px', color: '#64748b' }}>
                  Tentukan jam operasional penayangan iklan serta batas anggaran Anda.
                </p>
              </div>

              {/* Date Window */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={14} /> Tanggal Mulai (Opsional)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={14} /> Tanggal Selesai (Opsional)
                  </label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              {/* Time of Day */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  gap: '0.85rem',
                }}
              >
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
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                  />
                  <span>
                    <strong>Tayangkan Sepanjang Hari (24 Jam)</strong>
                  </span>
                </label>

                {!allDay && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {[
                        { label: 'Pagi (07:00 - 11:00)', s: 7, e: 11 },
                        { label: 'Makan Siang (11:00 - 15:00)', s: 11, e: 15 },
                        { label: 'Sore & Malam (17:00 - 23:00)', s: 17, e: 23 },
                        { label: 'Jam Aktif (08:00 - 22:00)', s: 8, e: 22 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className="preset-btn"
                          onClick={() => {
                            setStartHour(p.s)
                            setEndHour(p.e)
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                      <div className="form-field">
                        <label>
                          <Clock size={13} /> Jam Mulai
                        </label>
                        <select
                          value={startHour}
                          onChange={(e) => setStartHour(Number(e.target.value))}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, '0')}:00 WIB
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label>
                          <Clock size={13} /> Jam Selesai
                        </label>
                        <select
                          value={endHour}
                          onChange={(e) => setEndHour(Number(e.target.value))}
                        >
                          {Array.from({ length: 24 }, (_, idx) => idx + 1).map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, '0')}:00 WIB
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '0.45rem',
                    }}
                  >
                    Hari Penayangan Aktif
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {DAYS_OPTIONS.map((d) => {
                      const active = selectedDays.includes(d.key)
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => toggleDay(d.key)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            border: active ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                            background: active ? '#2563eb' : '#ffffff',
                            color: active ? '#ffffff' : '#475569',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Quick Budget Presets */}
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Pilih Cepat Total Anggaran:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[100000, 250000, 500000, 1000000, 2000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTotalBudget(amt)}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: '999px',
                        border: totalBudget === amt ? '1.5px solid #1d4ed8' : '1px solid #cbd5e1',
                        background: totalBudget === amt ? '#eff6ff' : '#ffffff',
                        color: totalBudget === amt ? '#1d4ed8' : '#334155',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-field">
                  <label>Batas Anggaran Harian (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Math.max(0, Number(e.target.value)))}
                  />
                  <span className="helper-text">Isi 0 jika tidak dibatasi per hari.</span>
                </div>
                <div className="form-field">
                  <label>Total Anggaran Iklan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(Math.max(0, Number(e.target.value)))}
                  />
                  <span className="helper-text">Iklan berhenti otomatis saat batas ini tercapai.</span>
                </div>
              </div>

              {(advertiser?.wallet_balance_idr || 0) <
                Math.max(pricingSummary.minPrice, totalBudget > 0 ? totalBudget : 0) && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Wallet size={16} style={{ flexShrink: 0 }} />
                    <span>
                      Saldo dompet saat ini{' '}
                      <strong>{formatRupiah(advertiser?.wallet_balance_idr || 0)}</strong>
                      {totalBudget > 0 && (advertiser?.wallet_balance_idr || 0) < totalBudget
                        ? ` (lebih kecil dari total anggaran ${formatRupiah(totalBudget)})`
                        : ' (kurang dari tarif minimum tayang)'}
                      .
                    </span>
                  </div>
                  <a
                    href="/advertiser/wallet"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.7rem',
                      fontSize: '11.5px',
                      background: '#ffffff',
                      borderColor: '#f59e0b',
                      color: '#92400e',
                      textDecoration: 'none',
                    }}
                  >
                    Top-Up Saldo <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Pricing Breakdown & Impression Simulator */}
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1rem' }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Rincian Tarif &amp; Estimasi Tayangan
              </h3>

              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '14px',
                  padding: '1.15rem',
                  display: 'grid',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>
                    Harga Dasar ({mediaType === 'video' ? 'Video' : 'Gambar'})
                  </span>
                  <strong>{formatRupiah(mediaType === 'video' ? baseVidPrice : baseImgPrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>Tarif Lokasi Dipilih</span>
                  <strong>
                    {pricingSummary.minPrice === pricingSummary.maxPrice
                      ? `${formatRupiah(pricingSummary.minPrice)} / tayang`
                      : `${formatRupiah(pricingSummary.minPrice)} – ${formatRupiah(pricingSummary.maxPrice)} / tayang`}
                  </strong>
                </div>
                <div
                  style={{
                    borderTop: '1px solid #bfdbfe',
                    paddingTop: '0.6rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                    Estimasi Total Tayangan
                  </span>
                  <strong style={{ fontSize: '22px', color: '#1d4ed8' }}>
                    ± {pricingSummary.estimatedImpressions.toLocaleString('id-ID')}x tayang
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: '12px', color: '#475569' }}>
                  Rincian Tarif per Lokasi ({selectedRouters.length} lokasi):
                </strong>
                {selectedRouters.map((r) => {
                  const unitPrice = mediaType === 'video' ? r.price_video_idr : r.price_image_idr
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <span>
                        <strong>{r.name}</strong> ({r.tier_name} {r.multiplier}x)
                      </span>
                      <strong>{formatRupiah(unitPrice)} / tayang</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 4: REVIEW & SUBMIT ==================== */}
        {step === 4 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.65rem', display: 'grid', gap: '1.25rem' }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                  4. {isEdit ? 'Konfirmasi Perubahan Iklan' : 'Konfirmasi Pengajuan Iklan'}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '13px', color: '#64748b' }}>
                  Pastikan seluruh detail materi, lokasi router, dan jadwal penayangan sudah sesuai.
                </p>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'grid',
                    gap: '0.45rem',
                    fontSize: '13px',
                  }}
                >
                  <strong style={{ color: '#1d4ed8', fontSize: '12px' }}>MATERI IKLAN</strong>
                  <div>
                    <strong>Judul:</strong> {title}
                  </div>
                  <div>
                    <strong>Format:</strong> {mediaType === 'video' ? 'Video' : 'Gambar'} (
                    {layoutMode === 'portrait' ? 'Portrait 9:16' : 'Landscape 16:9'})
                  </div>
                  <div>
                    <strong>Durasi Tayang:</strong> {durationSeconds} detik
                  </div>
                  {targetUrl && (
                    <div>
                      <strong>Link Promo:</strong> {targetUrl}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'grid',
                    gap: '0.45rem',
                    fontSize: '13px',
                  }}
                >
                  <strong style={{ color: '#1d4ed8', fontSize: '12px' }}>JADWAL &amp; ANGGARAN</strong>
                  <div>
                    <strong>Jam Tayang:</strong>{' '}
                    {allDay
                      ? 'Sepanjang Hari (00:00 - 24:00)'
                      : `${String(startHour).padStart(2, '0')}:00 – ${String(endHour).padStart(2, '0')}:00 WIB`}
                  </div>
                  <div>
                    <strong>Batas Harian:</strong>{' '}
                    {dailyBudget > 0 ? formatRupiah(dailyBudget) : 'Tanpa batas harian'}
                  </div>
                  <div>
                    <strong>Total Anggaran:</strong>{' '}
                    {totalBudget > 0 ? formatRupiah(totalBudget) : 'Mengikuti saldo dompet'}
                  </div>
                  <div>
                    <strong>Estimasi Tayangan:</strong> ±{' '}
                    {pricingSummary.estimatedImpressions.toLocaleString('id-ID')} kali
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'grid',
                    gap: '0.45rem',
                    fontSize: '13px',
                  }}
                >
                  <strong style={{ color: '#1d4ed8', fontSize: '12px' }}>
                    LOKASI ROUTER ({selectedRouters.length})
                  </strong>
                  {selectedRouters.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{r.name}</span>
                      <strong>
                        {formatRupiah(mediaType === 'video' ? r.price_video_idr : r.price_image_idr)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {(advertiser?.wallet_balance_idr || 0) <
                Math.max(pricingSummary.minPrice, totalBudget > 0 ? totalBudget : 0) && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '0.9rem 1.1rem',
                    borderRadius: '12px',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                    <Wallet size={18} style={{ flexShrink: 0 }} />
                    <span>
                      Saldo dompet Anda saat ini{' '}
                      <strong>{formatRupiah(advertiser?.wallet_balance_idr || 0)}</strong>. Anda
                      bisa <strong>Simpan sebagai Draft</strong> dulu lalu Top-Up saldo agar iklan
                      siap tayang.
                    </span>
                  </div>
                  <a
                    href="/advertiser/wallet"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '12px',
                      background: '#ffffff',
                      borderColor: '#f59e0b',
                      color: '#92400e',
                      textDecoration: 'none',
                    }}
                  >
                    Top-Up Saldo <ExternalLink size={13} />
                  </a>
                </div>
              )}
            </div>

            {/* Right: Final Realistic Preview */}
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.5rem' }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '15px', fontWeight: 700 }}>
                Pratinjau Akhir
              </h3>
              <AdPortalPreview
                title={title}
                body={body}
                mediaUrl={livePreviewUrl}
                mediaType={mediaType}
                layoutMode={layoutMode}
                durationSeconds={durationSeconds}
                targetUrl={targetUrl}
              />
            </div>
          </div>
        )}

        {/* Wizard Footer Navigation */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1rem 1.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
            >
              <ArrowLeft size={16} /> Sebelumnya
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {isEdit && step < 4 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSubmitFinal}
                disabled={submitMutation.isPending || uploading}
              >
                <Save size={16} />
                {submitMutation.isPending ? 'Menyimpan...' : 'Simpan Langsung'}
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextStep}
                disabled={uploading}
              >
                Langkah Berikutnya <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSaveDraft}
                  disabled={submitMutation.isPending || uploading}
                >
                  <FileText size={16} />
                  Simpan Draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitFinal}
                  disabled={submitMutation.isPending || uploading}
                  style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
                >
                  {isEdit ? <Save size={16} /> : <Send size={16} />}
                  {submitMutation.isPending
                    ? 'Menyimpan...'
                    : isEdit
                      ? 'Simpan Perubahan Iklan'
                      : 'Selesai & Ajukan Iklan'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
