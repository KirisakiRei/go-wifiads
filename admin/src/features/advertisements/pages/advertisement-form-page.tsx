import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CloudUpload,
  Film,
  Image as ImageIcon,
  Play,
  RotateCcw,
  Save,
  Scissors,
  Smartphone,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import { AdPortalPreview, PresetInput, WavyHeader } from '@/components/ui'
import { advertisementsApi } from '@/features/advertisements/api/advertisements.api'
import { advertisementsQueryKey, useAdvertisements } from '@/features/advertisements/hooks/use-advertisements'
import type { MediaMetadata } from '@/features/advertisements/types/advertisement.types'
import { formatBytes } from '@/lib/formatters'

const COUNTDOWN_PRESETS = [
  { label: '5 Detik', val: 5 },
  { label: '10 Detik', val: 10 },
  { label: '15 Detik', val: 15 },
  { label: '30 Detik', val: 30 },
]

export function AdvertisementFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const { data: allAds = [] } = useAdvertisements()
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
  const [sortOrder, setSortOrder] = useState<number>(1)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!isEdit && allAds.length > 0) {
      const maxOrder = allAds.reduce((max, item) => (item.sort_order > max ? item.sort_order : max), 0)
      setSortOrder(maxOrder + 1)
    }
  }, [isEdit, allAds])

  // Upload & Inspection State
  const [meta, setMeta] = useState<MediaMetadata | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState<number>(0)
  const [uploadedBytes, setUploadedBytes] = useState<number>(0)
  const [totalBytes, setTotalBytes] = useState<number>(0)
  const [uploadingFileName, setUploadingFileName] = useState<string>('')
  const [uploadCompleted, setUploadCompleted] = useState<boolean>(false)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('')
  const localBlobRef = useRef<string>('')

  useEffect(() => {
    return () => {
      if (localBlobRef.current) {
        URL.revokeObjectURL(localBlobRef.current)
      }
    }
  }, [])

  // Video Trimmer State (Start & End in seconds)
  const [videoStart, setVideoStart] = useState<number>(0)
  const [videoEnd, setVideoEnd] = useState<number>(15)
  const lastVideoFileRef = useRef<File | null>(null)
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0)
  const videoPlayerRef = useRef<HTMLVideoElement>(null)

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

  const inspectAndUploadFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name)
    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current)
    }
    const objURL = URL.createObjectURL(file)
    localBlobRef.current = objURL
    setLocalPreviewUrl(objURL)
    setMediaType(isVideo ? 'video' : 'image')

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
        setLayoutMode(orientation)
        const dur = duration > 0 ? duration : 15
        setDurationSeconds(dur)
        setVideoStart(0)
        setVideoEnd(dur)
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
        setLayoutMode(orientation)
      }
      img.src = objURL
    }

    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)
    if (isVid) {
      lastVideoFileRef.current = file
    } else {
      lastVideoFileRef.current = null
    }
    try {
      setUploading(true)
      setUploadCompleted(false)
      setUploadingFileName(file.name)
      setTotalBytes(file.size)
      setUploadedBytes(0)
      setUploadPercent(0)

      const res = await advertisementsApi.uploadImage(file, (progress) => {
        setUploadedBytes(progress.loaded)
        setTotalBytes(progress.total)
        setUploadPercent(progress.percent)
      })
      setUploadPercent(100)
      setUploadCompleted(true)
      toast.success('Berkas media berhasil diunggah')
      setImageUrl(res.url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah media'
      toast.error(msg)
      setUploadCompleted(false)
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
  const conflictingAd = allAds.find((item) => item.id !== id && item.sort_order === Number(sortOrder) && Number(sortOrder) > 0)
  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Judul iklan wajib diisi')
      return
    }
    if (conflictingAd) {
      toast.error(`Urutan #${sortOrder} sudah digunakan oleh iklan "${conflictingAd.title}". Silakan pilih nomor lain.`)
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
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
            {/* LEFT COLUMN: Form Cards */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Card 1: Informasi Iklan */}
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
                      <h3 style={{ fontSize: '15px', margin: 0 }}>Informasi Iklan</h3>
                      <p style={{ fontSize: '12px', color: '#747686', margin: 0 }}>
                        Judul dan keterangan singkat yang tampil pada layar iklan.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.4rem', display: 'grid', gap: '1.15rem' }}>
                  <div className="form-field">
                    <label>
                      <span>Judul Iklan <span style={{ color: '#ef4444' }}>*</span></span>
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Contoh: Promo Kopi Kenangan Diskon 50%"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>Deskripsi Singkat</label>
                    <textarea
                      rows={3}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Teks informasi singkat yang tampil di bagian bawah iklan (opsional)."
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Berkas Media */}
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
                      <h3 style={{ fontSize: '15px', margin: 0 }}>Berkas Media</h3>
                      <p style={{ fontSize: '12px', color: '#747686', margin: 0 }}>
                        Unggah gambar atau video yang akan ditayangkan.
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
                        {uploading ? 'Mengunggah Berkas...' : 'Klik untuk Memilih Gambar atau Video'}
                      </strong>
                      <span className="helper-text">
                        Format gambar: JPG, PNG, WebP (maks. 10 MB) • Video: MP4, WebM (maks. 50 MB)
                      </span>
                    </div>
                  </div>

                  {(uploading || uploadCompleted) && (
                    <div
                      style={{
                        background: uploadCompleted ? '#f0fdf4' : '#f8fbff',
                        border: uploadCompleted ? '1px solid #86efac' : '1px solid #93c5fd',
                        borderRadius: '12px',
                        padding: '1rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                          {uploadCompleted ? (
                            <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                          ) : (
                            <CloudUpload size={18} color="#2563eb" className="animate-bounce" style={{ flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: uploadCompleted ? '#166534' : '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {uploadingFileName || 'Berkas Media'}
                            </div>
                            <div style={{ fontSize: '11px', color: uploadCompleted ? '#15803d' : '#475569' }}>
                              {uploadCompleted
                                ? `Berhasil diunggah (${formatBytes(totalBytes)})`
                                : uploadPercent < 100
                                  ? `Mengunggah... ${formatBytes(uploadedBytes)} dari ${formatBytes(totalBytes)}`
                                  : 'Menyelesaikan penyimpanan berkas...'}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: uploadCompleted ? '#166534' : '#1d4ed8',
                            background: uploadCompleted ? '#dcfce7' : '#dbeafe',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            flexShrink: 0,
                          }}
                        >
                          {uploadCompleted ? '100%' : `${uploadPercent}%`}
                        </span>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: '9px',
                          borderRadius: '999px',
                          background: uploadCompleted ? '#dcfce7' : '#e2e8f0',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${uploadCompleted ? 100 : uploadPercent}%`,
                            height: '100%',
                            borderRadius: '999px',
                            background: uploadCompleted
                              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                              : 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                            transition: 'width 0.2s ease-out',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {meta && (
                    <div style={{ background: '#eff4ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.85rem', fontSize: '12px', color: '#1e3a8a', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <span><strong>Jenis:</strong> {meta.type === 'video' ? 'Video' : 'Gambar'}</span>
                      <span><strong>Resolusi:</strong> {meta.width} × {meta.height} px</span>
                      <span><strong>Orientasi:</strong> {meta.orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
                      {meta.duration ? <span><strong>Durasi Video:</strong> {meta.duration} dtk</span> : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Tampilan & Durasi Tayang */}
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
                      <h3 style={{ fontSize: '15px', margin: 0 }}>Tampilan &amp; Durasi Tayang</h3>
                      <p style={{ fontSize: '12px', color: '#747686', margin: 0 }}>
                        Atur orientasi layar dan lama waktu penayangan iklan.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.4rem', display: 'grid', gap: '1.25rem' }}>
                  <div className="form-field">
                    <label>Orientasi Tampilan</label>
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
                        <span>Landscape</span>
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
                        <span>Portrait</span>
                      </label>
                    </div>
                  </div>

                  {mismatch && (
                    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '0.85rem', display: 'flex', gap: '0.75rem', fontSize: '12px', color: '#92400e' }}>
                      <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                      <div>
                        <strong>Orientasi Berbeda:</strong> Berkas berukuran <strong>{meta?.orientation}</strong> ({meta?.width}×{meta?.height} px) tetapi orientasi dipilih <strong>{layoutMode}</strong>.
                        <div style={{ marginTop: '0.4rem' }}>
                          <button
                            type="button"
                            className="preset-btn"
                            style={{ background: '#d97706', color: '#fff', borderColor: '#b45309' }}
                            onClick={() => setLayoutMode(meta!.orientation)}
                          >
                            Sesuaikan ke {meta?.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
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
                            Batas Waktu Putar Video
                          </strong>
                        </div>
                        <span className="live-badge" style={{ fontSize: '12px' }}>
                          Durasi: {durationSeconds} Detik
                        </span>
                      </div>

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
                            <span>Detik Mulai</span>
                            <span className="live-badge">{videoStart} dtk</span>
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
                            >
                              Ambil Posisi
                            </button>
                          </div>
                        </div>

                        <div className="form-field">
                          <label>
                            <span>Detik Selesai</span>
                            <span className="live-badge">{videoEnd} dtk</span>
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
                            >
                              Ambil Posisi
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                          Putar Pratinjau ({videoStart}s - {videoEnd}s)
                        </button>
                        {lastVideoFileRef.current && videoEnd > videoStart + 0.5 && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={uploading}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px' }}
                            onClick={async () => {
                              const file = lastVideoFileRef.current
                              if (!file) return
                              try {
                                setUploading(true)
                                setUploadPercent(0)
                                const res = await advertisementsApi.uploadImage(
                                  file,
                                  (p) => {
                                    setUploadedBytes(p.loaded)
                                    setTotalBytes(p.total)
                                    setUploadPercent(p.percent)
                                  },
                                  { trimStart: videoStart, trimEnd: videoEnd }
                                )
                                setImageUrl(res.url)
                                setDurationSeconds(Math.max(1, Math.round(videoEnd - videoStart)))
                                setUploadPercent(100)
                                setUploadCompleted(true)
                                toast.success(`Video berhasil dipotong (${videoStart}s–${videoEnd}s) & di-transcode!`)
                              } catch (err: unknown) {
                                toast.error(err instanceof Error ? err.message : 'Gagal memotong video')
                              } finally {
                                setUploading(false)
                              }
                            }}
                          >
                            <Scissors size={14} />
                            Potong &amp; Simpan Klip ({videoStart}s–{videoEnd}s)
                          </button>
                        )}
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
                          Atur Ulang
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PresetInput
                      label="Durasi Tampil Iklan (Detik)"
                      icon={Clock}
                      iconColor="#00668a"
                      value={durationSeconds}
                      onChange={setDurationSeconds}
                      badgeText={durationSeconds > 0 ? `${durationSeconds} detik` : '15 detik'}
                      helperText="Lama waktu penayangan iklan sebelum tombol lanjutkan muncul."
                      presets={COUNTDOWN_PRESETS}
                      min={0}
                      max={300}
                    />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <span><strong>Tampilkan Iklan Ini (Aktif)</strong></span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', color: '#747686' }}>
                        <span>Urutan Tayang:</span>
                        <input
                          type="number"
                          min={1}
                          style={{
                            width: '72px',
                            padding: '0.35rem 0.5rem',
                            border: conflictingAd ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontWeight: 700,
                          }}
                          value={sortOrder}
                          onChange={(e) => setSortOrder(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                    </div>

                    {conflictingAd && (
                      <div style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        Urutan <strong>#{sortOrder}</strong> sudah digunakan oleh iklan <strong>&ldquo;{conflictingAd.title}&rdquo;</strong>. Silakan pilih nomor lain.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Realistic Desktop / Smartphone Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '84px' }}>
              <div className="stitch-card-container" style={{ padding: '1.4rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '15px', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Smartphone size={18} style={{ color: '#1d4ed8' }} />
                    Pratinjau Tampilan
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '12px', color: '#64748b' }}>
                    Menyesuaikan ukuran desktop (16:9) untuk landscape dan layar ponsel (9:16) untuk portrait.
                  </p>
                </div>

                <AdPortalPreview
                  title={title}
                  body={body}
                  mediaUrl={localPreviewUrl || imageUrl}
                  mediaType={mediaType}
                  layoutMode={layoutMode}
                  durationSeconds={durationSeconds > 0 ? durationSeconds : 15}
                />
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
                    {isSaving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Terbitkan Iklan'}
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
