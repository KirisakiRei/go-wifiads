import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Film,
  Gauge,
  Image as ImageIcon,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Smartphone,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import { KpiCard, KpiGrid, PresetInput, StatusPill, WavyHeader } from '@/components/ui'
import { advertisementsApi } from '@/features/advertisements/api/advertisements.api'
import { advertisementsQueryKey } from '@/features/advertisements/hooks/use-advertisements'
import type { MediaMetadata } from '@/features/advertisements/types/advertisement.types'

const COUNTDOWN_PRESETS = [
  { label: '5 Detik', val: 5 },
  { label: '10 Detik', val: 10 },
  { label: '15 Detik (Default)', val: 15 },
  { label: '30 Detik', val: 30 },
]

export function AdvertisementFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  // Fetch existing ad if editing
  const { data: existingAd, isPending: isFetching, error: fetchError } = useQuery({
    queryKey: [...advertisementsQueryKey, id],
    queryFn: () => advertisementsApi.get(id!),
    enabled: isEdit,
  })

  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('/static/img/ad-placeholder.svg')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [layoutMode, setLayoutMode] = useState<'landscape' | 'portrait'>('landscape')
  const [durationSeconds, setDurationSeconds] = useState<number>(0)
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [isActive, setIsActive] = useState(true)

  // Upload & Inspection State
  const [meta, setMeta] = useState<MediaMetadata | null>(null)
  const [uploading, setUploading] = useState(false)

  // Video Trimmer State (Start & End in seconds)
  const [videoStart, setVideoStart] = useState<number>(0)
  const [videoEnd, setVideoEnd] = useState<number>(15)
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0)
  const videoPlayerRef = useRef<HTMLVideoElement>(null)

  // Populate data when editing
  useEffect(() => {
    if (existingAd) {
      setTitle(existingAd.title || '')
      setBody(existingAd.body || '')
      setImageUrl(existingAd.image_url || '/static/img/ad-placeholder.svg')
      setMediaType(existingAd.media_type || 'image')
      setLayoutMode(existingAd.layout_mode || 'landscape')
      const dur = existingAd.duration_seconds || 15
      setDurationSeconds(dur)
      setVideoStart(0)
      setVideoEnd(dur)
      setSortOrder(existingAd.sort_order || 0)
      setIsActive(existingAd.is_active ?? true)
    }
  }, [existingAd])

  // Inspect file dimensions & duration client-side before/during upload
  const inspectAndUploadFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name)
    const objURL = URL.createObjectURL(file)

    if (isVideo) {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.onloadedmetadata = () => {
        const width = vid.videoWidth || 1920
        const height = vid.videoHeight || 1080
        const duration = Math.round(vid.duration || 0)
        const orientation: 'landscape' | 'portrait' = width >= height ? 'landscape' : 'portrait'
        const inspectedMeta: MediaMetadata = { width, height, duration, orientation, type: 'video' }

        setMeta(inspectedMeta)
        setMediaType('video')
        setLayoutMode(orientation)
        const dur = duration > 0 ? duration : 15
        setDurationSeconds(dur)
        setVideoStart(0)
        setVideoEnd(dur)
        URL.revokeObjectURL(objURL)
      }
      vid.src = objURL
    } else {
      const img = new Image()
      img.onload = () => {
        const width = img.naturalWidth || 1920
        const height = img.naturalHeight || 1080
        const orientation: 'landscape' | 'portrait' = width >= height ? 'landscape' : 'portrait'
        const inspectedMeta: MediaMetadata = { width, height, orientation, type: 'image' }

        setMeta(inspectedMeta)
        setMediaType('image')
        setLayoutMode(orientation)
        URL.revokeObjectURL(objURL)
      }
      img.src = objURL
    }

    try {
      setUploading(true)
      const res = await advertisementsApi.uploadImage(file)
      toast.success('File media berhasil diunggah')
      setImageUrl(res.url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah media'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: advertisementsApi.create,
    onSuccess: () => {
      toast.success('Materi iklan berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: advertisementsQueryKey })
      navigate('/advertisements')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menambahkan materi iklan')
    },
  })

  const updateMutation = useMutation({
    mutationFn: advertisementsApi.update,
    onSuccess: () => {
      toast.success('Materi iklan berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: advertisementsQueryKey })
      navigate('/advertisements')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal memperbarui materi iklan')
    },
  })

  if (isEdit && isFetching) return <LoadingState />
  if (isEdit && (fetchError || !existingAd)) return <ErrorState message="Gagal memuat data iklan." />

  const mismatch = meta && meta.orientation !== layoutMode
  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Judul iklan wajib diisi')
      return
    }

    const payload = {
      title: title.trim(),
      body: body.trim(),
      image_url: imageUrl,
      media_type: mediaType,
      layout_mode: layoutMode,
      duration_seconds: Number(durationSeconds) || 0,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    }

    if (isEdit && id) {
      updateMutation.mutate({ id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div>
      <WavyHeader
        title={isEdit ? 'Edit Iklan' : 'Tambah Iklan'}
        actions={
          <Link to="/advertisements" className="btn btn-secondary">
            <ArrowLeft size={16} /> Kembali
          </Link>
        }
      />

      <div className="stitch-page-stage">
        {/* 3 Stitch Telemetry Overview Cards */}
        <KpiGrid columns={3}>
          <KpiCard
            compact
            label="Target Potensi Trafik"
            value="± 15.000 Sesi / Minggu"
            icon={Users}
          />
          <KpiCard
            compact
            label="Profil Queue MikroTik"
            value="Dynamic QoS Rate-Limit"
            icon={Gauge}
            iconBoxVariant="secondary"
          />
          <KpiCard
            compact
            label="Sinkronisasi RADIUS"
            value="Auto Hotspot Hook Active"
            icon={RefreshCw}
            iconColor="#10b981"
            iconBoxVariant="success"
          />
        </KpiGrid>

        {/* 7:5 Split Workspace Grid from Google Stitch */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
            {/* LEFT COLUMN: Form Cards */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Card 1: Informasi Dasar */}
              <div className="stitch-card-container">
                <div className="table-toolbar">
                  <div className="table-toolbar-title">
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: '#dce1ff',
                        color: '#0037b0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      01
                    </span>
                    <div>
                      <h3 style={{ fontSize: '15px', margin: 0 }}>Informasi Dasar Sponsor &amp; Kampanye</h3>
                      <p style={{ fontSize: '12px', color: '#747686', margin: 0 }}>
                        Detail brand sponsor dan teks pesan promosi untuk pengunjung.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.4rem', display: 'grid', gap: '1.15rem' }}>
                  <div className="form-field">
                    <label>
                      <span>Judul Kampanye Iklan <span style={{ color: '#ef4444' }}>*</span></span>
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Contoh: Promo Spesial Kopi Kenangan 50%"
                      required
                    />
                    <span className="helper-text">Judul yang tampil mencolok di atas layar login captive portal.</span>
                  </div>

                  <div className="form-field">
                    <label>Teks Keterangan &amp; Call-to-Action</label>
                    <textarea
                      rows={3}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Contoh: Nikmati akses internet gratis dengan kecepatan tinggi. Tonton tayangan sponsor ini hingga selesai untuk klaim voucher."
                      style={{ resize: 'vertical' }}
                    />
                    <span className="helper-text">Pesan informasi yang menyertai tayangan iklan.</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Media Asset Upload */}
              <div className="stitch-card-container">
                <div className="table-toolbar">
                  <div className="table-toolbar-title">
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: '#dce1ff',
                        color: '#0037b0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      02
                    </span>
                    <div>
                      <h3 style={{ fontSize: '15px', margin: 0 }}>Upload File Media (Foto atau Video)</h3>
                      <p style={{ fontSize: '12px', color: '#747686', margin: 0 }}>
                        Pilih berkas media untuk otomatis dideteksi resolusi dan orientasinya.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.4rem', display: 'grid', gap: '1.25rem' }}>
                  <div
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      cursor: 'pointer',
                    }}
                    onClick={() => document.getElementById('stitch-file-input')?.click()}
                  >
                    <input
                      id="stitch-file-input"
                      type="file"
                      accept="image/*,video/mp4,video/webm,video/quicktime"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) inspectAndUploadFile(file)
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', color: '#1d4ed8' }}>
                        <ImageIcon size={26} />
                        <Film size={26} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0b1c30' }}>
                        {uploading ? 'Mengunggah & Menginspeksi Media...' : 'Klik untuk Memilih File Foto atau Video'}
                      </strong>
                      <span className="helper-text">
                        Mendukung Gambar (JPG, PNG, WEBP maks 10MB) dan Video (MP4, WEBM maks 50MB).
                      </span>
                    </div>
                  </div>

                  {uploading && (
                    <div style={{ textAlign: 'center', padding: '0.5rem', color: '#1d4ed8', fontSize: '13px' }}>
                      Sedang mengunggah berkas ke server...
                    </div>
                  )}

                  {meta && (
                    <div style={{ background: '#eff4ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.85rem', fontSize: '12px', color: '#1e3a8a', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <span><strong>Format:</strong> {meta.type.toUpperCase()}</span>
                      <span><strong>Dimensi:</strong> {meta.width} × {meta.height} px</span>
                      <span><strong>Orientasi:</strong> {meta.orientation.toUpperCase()}</span>
                      {meta.duration ? <span><strong>Panjang Asli Video:</strong> {meta.duration}s</span> : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Layout & Countdown Duration */}
              <div className="stitch-card-container">
                <div className="table-toolbar">
                  <div className="table-toolbar-title">
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: '#dce1ff',
                        color: '#0037b0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      03
                    </span>
                    <div>
                      <h3 style={{ fontSize: '15px', margin: 0 }}>Orientasi Layar &amp; Waktu Hitung Mundur</h3>
                      <p style={{ fontSize: '12px', color: '#747686', margin: 0 }}>
                        Atur mode tampilan portal dan berapa detik user wajib menonton iklan.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.4rem', display: 'grid', gap: '1.25rem' }}>
                  <div className="form-field">
                    <label>Mode Tampilan Layar Captive Portal</label>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: layoutMode === 'landscape' ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                          background: layoutMode === 'landscape' ? '#eff4ff' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="radio"
                          name="layout_mode"
                          value="landscape"
                          checked={layoutMode === 'landscape'}
                          onChange={() => setLayoutMode('landscape')}
                        />
                        <span>Landscape (Mendatar)</span>
                      </label>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: layoutMode === 'portrait' ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                          background: layoutMode === 'portrait' ? '#eff4ff' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="radio"
                          name="layout_mode"
                          value="portrait"
                          checked={layoutMode === 'portrait'}
                          onChange={() => setLayoutMode('portrait')}
                        />
                        <span>Portrait (Tegak)</span>
                      </label>
                    </div>
                  </div>

                  {mismatch && (
                    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '0.85rem', display: 'flex', gap: '0.75rem', fontSize: '12px', color: '#92400e' }}>
                      <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                      <div>
                        <strong>Peringatan Orientasi:</strong> File berorientasi <strong>{meta?.orientation}</strong> ({meta?.width}×{meta?.height} px) namun mode tampilan dipilih <strong>{layoutMode}</strong>.
                        <div style={{ marginTop: '0.4rem' }}>
                          <button
                            type="button"
                            className="preset-btn"
                            style={{ background: '#d97706', color: '#fff', borderColor: '#b45309' }}
                            onClick={() => setLayoutMode(meta!.orientation)}
                          >
                            Ubah Otomatis ke {meta?.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {mediaType === 'video' ? (
                    <div style={{ display: 'grid', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Scissors size={18} style={{ color: '#1d4ed8' }} />
                          <strong style={{ fontSize: '14px', color: '#0b1c30' }}>
                            Pemotong Durasi Video (Start &amp; End Time)
                          </strong>
                        </div>
                        <span className="live-badge" style={{ fontSize: '12px' }}>
                          Total Durasi: {durationSeconds} Detik
                        </span>
                      </div>

                      {/* Video Player Preview with Trimmer Controls */}
                      <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', maxHeight: '240px', display: 'flex', justifyContent: 'center' }}>
                        <video
                          ref={videoPlayerRef}
                          src={imageUrl}
                          controls
                          onTimeUpdate={(e) => {
                            const cur = e.currentTarget.currentTime
                            setVideoCurrentTime(cur)
                            if (cur >= videoEnd && videoEnd > videoStart) {
                              e.currentTarget.pause()
                            }
                          }}
                          style={{ maxHeight: '240px', maxWidth: '100%' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="form-field">
                          <label>
                            <span>Waktu Mulai (Detik)</span>
                            <span className="live-badge">{videoStart}s</span>
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="number"
                              min={0}
                              max={videoEnd - 1}
                              value={videoStart}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0)
                                setVideoStart(val)
                                const dur = Math.max(1, Math.round(videoEnd - val))
                                setDurationSeconds(dur)
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.65rem', fontSize: '11px', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                const cur = Math.round(videoCurrentTime)
                                if (cur < videoEnd) {
                                  setVideoStart(cur)
                                  setDurationSeconds(Math.max(1, Math.round(videoEnd - cur)))
                                }
                              }}
                              title="Gunakan posisi pemutaran video saat ini"
                            >
                              Gunakan Posisi
                            </button>
                          </div>
                        </div>

                        <div className="form-field">
                          <label>
                            <span>Waktu Berhenti (Detik)</span>
                            <span className="live-badge">{videoEnd}s</span>
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="number"
                              min={videoStart + 1}
                              max={meta?.duration || 300}
                              value={videoEnd}
                              onChange={(e) => {
                                const val = Math.max(videoStart + 1, Number(e.target.value) || 1)
                                setVideoEnd(val)
                                const dur = Math.max(1, Math.round(val - videoStart))
                                setDurationSeconds(dur)
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.65rem', fontSize: '11px', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                const cur = Math.round(videoCurrentTime)
                                if (cur > videoStart) {
                                  setVideoEnd(cur)
                                  setDurationSeconds(Math.max(1, Math.round(cur - videoStart)))
                                }
                              }}
                              title="Gunakan posisi pemutaran video saat ini"
                            >
                              Gunakan Posisi
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px' }}
                          onClick={() => {
                            if (videoPlayerRef.current) {
                              videoPlayerRef.current.currentTime = videoStart
                              videoPlayerRef.current.play()
                            }
                          }}
                        >
                          <Play size={14} />
                          Tes Putar Sesuai Potongan ({videoStart}s - {videoEnd}s)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px' }}
                          onClick={() => {
                            setVideoStart(0)
                            const maxDur = meta?.duration || 15
                            setVideoEnd(maxDur)
                            setDurationSeconds(maxDur)
                            if (videoPlayerRef.current) {
                              videoPlayerRef.current.currentTime = 0
                            }
                          }}
                        >
                          <RotateCcw size={14} />
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PresetInput
                      label="Durasi Tampil Iklan Foto (Detik)"
                      icon={Clock}
                      iconColor="#00668a"
                      value={durationSeconds}
                      onChange={setDurationSeconds}
                      badgeText={durationSeconds > 0 ? `${durationSeconds} detik` : 'Default (15 dtk)'}
                      helperText="Berapa lama pengunjung wajib melihat gambar sebelum tombol Skip / Klaim aktif."
                      presets={COUNTDOWN_PRESETS}
                      min={0}
                      max={300}
                    />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span><strong>Publikasikan Sekarang (Iklan Aktif)</strong></span>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', color: '#747686' }}>
                      <span>Prioritas:</span>
                      <input
                        type="number"
                        style={{ width: '65px', padding: '0.35rem' }}
                        value={sortOrder}
                        onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Smartphone Simulator from Google Stitch */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="stitch-card-container" style={{ padding: '1.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Smartphone size={18} style={{ color: '#1d4ed8' }} />
                    Live Preview Captive Portal
                  </h3>
                  <StatusPill variant="active" dot>Simulasi HP</StatusPill>
                </div>

                {/* Smartphone Mockup Frame */}
                <div
                  style={{
                    margin: '0 auto',
                    width: layoutMode === 'portrait' ? '280px' : '320px',
                    borderRadius: '24px',
                    border: '8px solid #0f172a',
                    background: '#f8fafc',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Speaker Notch */}
                  <div style={{ height: '18px', background: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: '#334155' }}></div>
                  </div>

                  {/* Media Container in Portal */}
                  <div
                    style={{
                      height: layoutMode === 'portrait' ? '280px' : '180px',
                      background: '#020617',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {mediaType === 'video' ? (
                      <video
                        src={imageUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img
                        src={imageUrl}
                        alt="Simulator"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}

                    {/* Countdown Badge overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={11} /> {durationSeconds > 0 ? durationSeconds : 15}s
                    </div>
                  </div>

                  {/* Portal Bottom Content */}
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0b1c30', lineHeight: 1.3 }}>
                      {title || 'Judul Iklan Sponsor'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                      {body || 'Teks deskripsi sponsor tayang di sini saat pengunjung mengakses WiFi.'}
                    </div>

                    <button
                      type="button"
                      disabled
                      style={{
                        marginTop: '0.4rem',
                        background: '#1d4ed8',
                        color: '#fff',
                        padding: '0.5rem',
                        fontSize: '12px',
                        borderRadius: '8px',
                        opacity: 0.9,
                      }}
                    >
                      Hubungkan ke Internet
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="stitch-card-container" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving || uploading}
                    style={{ padding: '0.85rem' }}
                  >
                    <Save size={18} />
                    {isSaving ? 'Menyimpan Materi Iklan...' : isEdit ? 'Simpan Perubahan' : 'Terbitkan Iklan'}
                  </button>

                  <Link
                    to="/advertisements"
                    className="btn btn-secondary"
                    style={{ padding: '0.8rem', textAlign: 'center' }}
                  >
                    Batal
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
