import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  Film,
  Image,
  Megaphone,
  Monitor,
  Pencil,
  PlusCircle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/query-state'
import { KpiCard, KpiGrid, SearchInput, StatusPill, WavyHeader } from '@/components/ui'
import { advertisementsApi } from '@/features/advertisements/api/advertisements.api'
import { advertisementsQueryKey, useAdvertisements } from '@/features/advertisements/hooks/use-advertisements'

export function AdvertisementsPage() {
  const navigate = useNavigate()
  const { data: ads, isPending, error } = useAdvertisements()
  const [search, setSearch] = useState('')
  const [filterLayout, setFilterLayout] = useState('')

  const deleteMutation = useMutation({
    mutationFn: advertisementsApi.delete,
    onSuccess: () => {
      toast.success('Materi iklan berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: advertisementsQueryKey })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menghapus materi iklan')
    },
  })

  if (isPending) return <LoadingState />
  if (error || !ads) return <ErrorState message="Gagal memuat materi iklan sponsor." />

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Yakin ingin menghapus materi iklan "${title}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const activeAds = ads.filter((a) => a.is_active)
  const videoAds = ads.filter((a) => a.media_type === 'video')
  const landscapeAds = ads.filter((a) => a.layout_mode === 'landscape')

  const filteredAds = ads.filter((a) => {
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.body.toLowerCase().includes(search.toLowerCase())
    const matchLayout = !filterLayout || a.layout_mode === filterLayout
    return matchSearch && matchLayout
  })

  return (
    <div>
      <WavyHeader
        title="Manajemen Iklan"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/advertisements/new')}
          >
            <PlusCircle size={18} />
            Pasang Iklan Baru
          </button>
        }
      />

      <div className="stitch-page-stage">
        {/* Telemetry KPI Cards from Stitch */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Iklan Aktif (Live Now)"
            value={activeAds.length}
            icon={Megaphone}
            iconColor="#10b981"
            iconBoxVariant="success"
            trend={{ label: 'Tayang di Portal', variant: 'success' }}
            footerLeft="Tayang ke pengunjung"
            footerRight="Hotspot Hook Active"
          />

          <KpiCard
            label="Format Video Sponsor"
            value={videoAds.length}
            icon={Film}
            iconBoxVariant="secondary"
            trend={{ label: 'Video MP4 / WEBM' }}
            footerLeft="Audio muted autoplay"
            footerRight="Interaktif"
          />

          <KpiCard
            label="Format Foto / Banner"
            value={ads.length - videoAds.length}
            icon={Image}
            trend={{ label: 'Gambar Statis' }}
            footerLeft="JPG / PNG / WEBP"
            footerRight="Splash Banner"
          />

          <KpiCard
            label="Orientasi Landscape"
            value={landscapeAds.length}
            icon={Monitor}
            trend={{ label: `${ads.length - landscapeAds.length} Portrait` }}
            footerLeft="Rasio tampilan portal"
            footerRight="Auto-Detect Active"
          />
        </KpiGrid>

        {/* Search & Filter Bar */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '1rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <SearchInput
            placeholder="Cari materi iklan, nama sponsor, atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            wrapperStyle={{ flex: 1, minWidth: '260px' }}
            style={{ width: '100%' }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              value={filterLayout}
              onChange={(e) => setFilterLayout(e.target.value)}
              style={{ padding: '0.65rem 0.85rem' }}
            >
              <option value="">Semua Orientasi</option>
              <option value="landscape">Landscape (Mendatar)</option>
              <option value="portrait">Portrait (Tegak)</option>
            </select>
          </div>
        </div>

        {/* Ads Cards Grid */}
        {filteredAds.length === 0 ? (
          <EmptyState title="Tidak ada materi iklan yang cocok dengan filter atau pencarian Anda." />
        ) : (
          <div className="ad-grid">
            {filteredAds.map((ad) => {
              const isVideo = ad.media_type === 'video'
              return (
                <div key={ad.id} className="ad-card">
                  <div className="ad-media-thumb">
                    {isVideo ? (
                      <video
                        src={ad.image_url}
                        muted
                        playsInline
                        loop
                        autoPlay
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img src={ad.image_url} alt={ad.title} />
                    )}

                    <div className="ad-badge-overlay">
                      <StatusPill
                        variant={isVideo ? 'secondary' : 'basic'}
                        icon={isVideo ? Film : Image}
                      >
                        {isVideo ? 'Video' : 'Foto'}
                      </StatusPill>
                      <StatusPill style={{ background: '#0f172a', color: '#ffffff' }}>
                        {ad.layout_mode === 'portrait' ? 'Portrait' : 'Landscape'}
                      </StatusPill>
                    </div>
                  </div>

                  <div className="ad-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0b1c30' }}>{ad.title}</h3>
                      {ad.is_active ? (
                        <StatusPill variant="active" dot>Aktif</StatusPill>
                      ) : (
                        <StatusPill variant="expired">Nonaktif</StatusPill>
                      )}
                    </div>

                    <p style={{ fontSize: '13px', color: '#434655', lineHeight: 1.5 }}>
                      {ad.body || 'Tidak ada deskripsi tambahan.'}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '12px', color: '#747686', marginTop: 'auto' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={15} />
                        {ad.duration_seconds > 0 ? `${ad.duration_seconds} detik countdown` : 'Default (15 dtk)'}
                      </span>
                      <span>• Prioritas #{ad.sort_order}</span>
                    </div>
                  </div>

                  <div className="ad-card-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.85rem' }}
                      onClick={() => navigate(`/advertisements/${ad.id}/edit`)}
                    >
                      <Pencil size={16} />
                      Edit Iklan
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.45rem 0.85rem' }}
                      onClick={() => handleDelete(ad.id, ad.title)}
                    >
                      <Trash2 size={16} />
                      Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
