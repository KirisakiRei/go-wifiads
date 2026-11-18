import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Download,
  FileCode,
  Globe,
  KeyRound,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Store,
  Terminal,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { WavyHeader } from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import { routersApi } from '@/features/routers/routers.api'
import type { CreateRouterInput, UpdateRouterVoucherConfigInput } from '@/features/routers/types'
import { useRouters } from '@/features/routers/use-routers'

function generateRandomSecret(length = 24): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  const array = new Uint32Array(length)
  window.crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    out += chars[array[i] % chars.length]
  }
  return out
}

export function RouterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { data: routersData, isLoading } = useRouters()
  const routers = useMemo(() => routersData ?? [], [routersData])
  const { data: locationTiersData } = useQuery({
    queryKey: ['admin-location-tiers'],
    queryFn: adminMarketplaceApi.listTiers,
  })
  const locationTiers = useMemo(() => locationTiersData ?? [], [locationTiersData])
  const { data: partnersRes } = useQuery({
    queryKey: ['admin-partners-select'],
    queryFn: () => adminMarketplaceApi.listPartners({ page: 1, per_page: 200 }),
  })
  const partnerOptions = partnersRes?.data || []

  const currentRouter = useMemo(
    () => (isNew ? undefined : routers.find((r) => r.id === id)),
    [routers, id, isNew]
  )

  const [name, setName] = useState<string>('MikroTik Baru')
  const [nasIdentifier, setNasIdentifier] = useState<string>('wifiads-router')
  const [hotspotIp, setHotspotIp] = useState<string>('10.10.0.1')
  const [nasPublicIp, setNasPublicIp] = useState<string>('')
  const [radiusSecret, setRadiusSecret] = useState<string>(() => generateRandomSecret(24))

  // Partner Assignment & Pricing Tier State
  const [partnerId, setPartnerId] = useState<string>('')
  const [locationTierId, setLocationTierId] = useState<string>('')
  const [locationTierAuto, setLocationTierAuto] = useState<boolean>(true)
  const [isPublicMarketplace, setIsPublicMarketplace] = useState<boolean>(true)

  const selectedPartner = useMemo(
    () => partnerOptions.find((p) => p.id === partnerId),
    [partnerOptions, partnerId]
  )

  const [setupMode, setSetupMode] = useState<'existing' | 'full'>('existing')
  const [radiusServerIp, setRadiusServerIp] = useState<string>('13.54.63.73')
  const [portalBaseUrl, setPortalBaseUrl] = useState<string>('https://wifiads.smartscales.web.id')
  const [hotspotInterface, setHotspotInterface] = useState<string>('ether3-slave-local')
  const [hotspotPoolRange, setHotspotPoolRange] = useState<string>('10.10.0.10-10.10.0.250')
  const [dnsServers, setDnsServers] = useState<string>('8.8.8.8,1.1.1.1')
  const [copiedRsc, setCopiedRsc] = useState<boolean>(false)
  const [hydratedRouterKey, setHydratedRouterKey] = useState<string>('')

  useEffect(() => {
    if (isNew) {
      if (hydratedRouterKey !== 'new') {
        setName(`MikroTik Cabang ${routers.length + 1}`)
        setNasIdentifier(`wifiads-router-${routers.length + 1}`)
        setHotspotIp('10.10.0.1')
        setRadiusSecret(generateRandomSecret(24))
        setHydratedRouterKey('new')
      }
      return
    }
    if (currentRouter && hydratedRouterKey !== currentRouter.id) {
      setName(currentRouter.name || 'wifiads-router')
      setNasIdentifier(currentRouter.nas_identifier || 'wifiads-router')
      setHotspotIp(currentRouter.ip_address || '10.10.0.1')
      setNasPublicIp(currentRouter.nas_ip_address || '')
      setRadiusSecret(currentRouter.radius_secret || generateRandomSecret(24))
      setPartnerId(currentRouter.partner_id || '')
      if (currentRouter.location_tier_id) {
        setLocationTierId(currentRouter.location_tier_id)
      }
      setLocationTierAuto(currentRouter.location_tier_auto ?? true)
      setIsPublicMarketplace(currentRouter.is_public_marketplace ?? true)
      if (currentRouter.portal_base_url) {
        setPortalBaseUrl(currentRouter.portal_base_url.replace(/\/+$/, ''))
      } else if (typeof window !== 'undefined') {
        setPortalBaseUrl(window.location.origin)
      }
      setHydratedRouterKey(currentRouter.id)
    }
  }, [currentRouter, isNew, routers.length, hydratedRouterKey])

  useEffect(() => {
    if (!locationTierId && locationTiers.length > 0) {
      setLocationTierId(locationTiers[0].id)
    }
  }, [locationTierId, locationTiers])

  const handleHotspotIpChange = (val: string) => {
    setHotspotIp(val)
    const parts = val.trim().split('.')
    if (parts.length === 4) {
      const prefix3 = `${parts[0]}.${parts[1]}.${parts[2]}`
      setHotspotPoolRange(`${prefix3}.10-${prefix3}.250`)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew || !currentRouter) {
        const payload: CreateRouterInput = {
          name: name.trim(),
          nas_identifier: nasIdentifier.trim(),
          ip_address: hotspotIp.trim(),
          nas_ip_address: nasPublicIp.trim(),
          radius_secret: radiusSecret.trim(),
          partner_id: partnerId || undefined,
          location_tier_id: locationTierId || undefined,
          location_tier_auto: locationTierAuto,
          is_public_marketplace: isPublicMarketplace,
        }
        return routersApi.create(payload)
      }
      const payload: UpdateRouterVoucherConfigInput = {
        name: name.trim(),
        nas_identifier: nasIdentifier.trim(),
        ip_address: hotspotIp.trim(),
        nas_ip_address: nasPublicIp.trim(),
        radius_secret: radiusSecret.trim(),
        partner_id: partnerId,
        location_tier_id: locationTierId || undefined,
        location_tier_auto: locationTierAuto,
        is_public_marketplace: isPublicMarketplace,
        voucher_prefix: currentRouter.voucher_prefix || 'MK1-',
        voucher_digit_count: currentRouter.voucher_digit_count || 6,
        voucher_numeric_only: currentRouter.voucher_numeric_only ?? true,
        default_profile_id: currentRouter.default_profile_id || undefined,
        survey_profile_id: currentRouter.survey_profile_id || undefined,
        voucher_ttl_seconds: currentRouter.voucher_ttl_seconds || 86400,
        session_timeout_seconds: currentRouter.session_timeout_seconds || 3600,
      }
      return routersApi.updateVoucherConfig(currentRouter.id, payload)
    },
    onSuccess: (saved) => {
      toast.success('Pengaturan router berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['routers'] })
      if (isNew) {
        navigate(`/routers/${saved.id}`, { replace: true })
      }
    },
    onError: (err: Error) => {
      toast.error('Gagal menyimpan pengaturan router', {
        description: err.message,
      })
    },
  })

  const portalDomain = useMemo(() => {
    try {
      return new URL(portalBaseUrl).hostname
    } catch {
      return 'wifiads.smartscales.web.id'
    }
  }, [portalBaseUrl])

  const cleanPortalUrl = useMemo(() => {
    const trimmed = portalBaseUrl.trim().replace(/\/+$/, '')
    return trimmed.endsWith('/portal') ? trimmed : `${trimmed}/portal`
  }, [portalBaseUrl])

  const subnetNetwork = useMemo(() => {
    const parts = hotspotIp.trim().split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`
    }
    return '10.10.0.0'
  }, [hotspotIp])

  const loginHtmlContent = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${cleanPortalUrl}?mac=$(mac)&ip=$(ip)&nasid=${nasIdentifier.trim()}&link-login-only=$(link-login-only-esc)&link-login=$(link-login-esc)&link-orig=$(link-orig-esc)">
  <title>Mengarahkan ke Portal Wi-Fi...</title>
</head>
<body style="font-family:sans-serif;background:#f1f5f9;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
  <div style="background:#fff;padding:28px 24px;border-radius:16px;border:1px solid #e2e8f0;max-width:340px;width:90%">
    <h3 style="margin:0 0 8px">Mengarahkan ke Portal...</h3>
    <p style="font-size:14px;color:#64748b;margin:0 0 18px">Jika tidak berpindah otomatis, ketuk tombol di bawah:</p>
    <a href="${cleanPortalUrl}?mac=$(mac)&ip=$(ip)&nasid=${nasIdentifier.trim()}&link-login-only=$(link-login-only-esc)&link-login=$(link-login-esc)&link-orig=$(link-orig-esc)" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Buka Halaman Login</a>
  </div>
</body>
</html>`
  }, [cleanPortalUrl, nasIdentifier])

  const generatedRscScript = useMemo(() => {
    const nas = nasIdentifier.trim() || 'wifiads-router'
    const radIp = radiusServerIp.trim() || '13.54.63.73'
    const secret = radiusSecret.trim() || 'testing123'
    const hsIp = hotspotIp.trim() || '10.10.0.1'
    const iface = hotspotInterface.trim() || 'ether3-slave-local'
    const pool = hotspotPoolRange.trim() || '10.10.0.10-10.10.0.250'
    const dns = dnsServers.trim() || '8.8.8.8,1.1.1.1'

    const escapedLoginHtml = `<!DOCTYPE html><html><head><meta charset=\\"utf-8\\"><meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\"><meta http-equiv=\\"refresh\\" content=\\"0; url=${cleanPortalUrl}?mac=\\$(mac)&ip=\\$(ip)&nasid=${nas}&link-login-only=\\$(link-login-only-esc)&link-login=\\$(link-login-esc)&link-orig=\\$(link-orig-esc)\\"><title>Mengarahkan ke Portal Wi-Fi...</title></head><body style=\\"font-family:sans-serif;background:#f1f5f9;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center\\"><div style=\\"background:#fff;padding:28px 24px;border-radius:16px;border:1px solid #e2e8f0;max-width:340px;width:90%\\"><h3 style=\\"margin:0 0 8px\\">Mengarahkan ke Portal...</h3><p style=\\"font-size:14px;color:#64748b;margin:0 0 18px\\">Jika tidak berpindah otomatis, ketuk tombol di bawah:</p><a href=\\"${cleanPortalUrl}?mac=\\$(mac)&ip=\\$(ip)&nasid=${nas}&link-login-only=\\$(link-login-only-esc)&link-login=\\$(link-login-esc)&link-orig=\\$(link-orig-esc)\\" style=\\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px\\">Buka Halaman Login</a></div></body></html>`

    const fullNetworkSection =
      setupMode === 'full'
        ? `
# ---------------------------------------------------------------------
# A. Setup Jaringan Hotspot, IP Pool, DHCP Server & NAT
# ---------------------------------------------------------------------
/ip dns set servers=${dns} allow-remote-requests=yes

:if ([:len [/ip address find address="${hsIp}/24"]] = 0) do={
    /ip address add address=${hsIp}/24 interface=${iface} comment="wifiads-hotspot-ip"
}

/ip pool remove [find name="wifiads-pool"]
/ip pool add name="wifiads-pool" ranges=${pool}

/ip dhcp-server remove [find name="wifiads-dhcp"]
/ip dhcp-server network remove [find comment="wifiads-net"]
/ip dhcp-server network add address=${subnetNetwork}/24 gateway=${hsIp} dns-server=${hsIp} comment="wifiads-net"
/ip dhcp-server add name="wifiads-dhcp" interface=${iface} address-pool="wifiads-pool" lease-time=1h disabled=no

:if ([:len [/ip firewall nat find comment="wifiads-masquerade"]] = 0) do={
    /ip firewall nat add chain=srcnat src-address=${subnetNetwork}/24 action=masquerade comment="wifiads-masquerade"
}

:if ([:len [/ip hotspot profile find name="wifiads-profile"]] = 0) do={
    /ip hotspot profile add name="wifiads-profile" hotspot-address=${hsIp} html-directory=hotspot
}

:if ([:len [/ip hotspot find name="wifiads-hs"]] = 0) do={
    /ip hotspot add name="wifiads-hs" interface=${iface} address-pool="wifiads-pool" profile="wifiads-profile" idle-timeout=5m addresses-per-mac=2 disabled=no
}
`
        : ''

    return `# =====================================================================
# WiFiAds — Script Konfigurasi MikroTik (.rsc)
# Nama Router    : ${name.trim()}
# Kode Router    : ${nas}
# IP Hotspot     : ${hsIp}
# =====================================================================

:local nasId "${nas}"
:local radiusServerIp "${radIp}"
:local radiusSecret "${secret}"
:local portalDomain "${portalDomain}"
:local portalUrl "${cleanPortalUrl}"
:local hotspotAddress "${hsIp}"

:put ("[*] Memulai konfigurasi WiFiAds untuk router: " . $nasId)

# 1. Set System Identity sesuai dengan kode router
/system identity set name=$nasId
${fullNetworkSection}
# 2. Bersihkan entri RADIUS & Walled Garden lama
/ip hotspot walled-garden ip remove [find comment~"wifiads"]
/ip hotspot walled-garden remove [find dynamic=no comment~"wifiads"]
/radius remove [find comment~"wifiads"]
/radius remove [find address=$radiusServerIp]

# 3. Daftarkan Server RADIUS
/radius add service=hotspot address=$radiusServerIp secret=$radiusSecret \\
    authentication-port=1812 accounting-port=1813 timeout=3s comment="wifiads-radius"

# 4. Konfigurasi Hotspot Server Profile
:local profId [/ip hotspot profile find where name="wifiads-profile"]
:if ([:len $profId] = 0) do={
    :set profId [/ip hotspot profile find default=yes]
}
/ip hotspot profile set $profId \\
    html-directory=hotspot \\
    login-by=cookie,http-pap \\
    http-cookie-lifetime=1d \\
    use-radius=yes \\
    radius-accounting=yes \\
    radius-interim-update=5m \\
    radius-mac-format=XX:XX:XX:XX:XX:XX \\
    nas-port-type=wireless-802.11

/ip hotspot user profile set [find default=yes] shared-users=1 transparent-proxy=no

# 5. Walled Garden: Izinkan akses ke Domain & IP Server Portal sebelum login
/ip hotspot walled-garden add dst-host=$portalDomain action=allow comment="wifiads-vps-domain"
/ip hotspot walled-garden ip add dst-address=$radiusServerIp action=accept comment="wifiads-vps-ip"

# 6. Tulis file hotspot/login.html
:if ([:len [/file find name="hotspot/login.html"]] = 0) do={
    /ip hotspot reset-html [find]
    :delay 2s
}

:local loginHtml "${escapedLoginHtml}"
/file set [find name="hotspot/login.html"] contents=$loginHtml

:put "[+] Konfigurasi selesai."
`
  }, [
    name,
    nasIdentifier,
    radiusServerIp,
    radiusSecret,
    hotspotIp,
    hotspotInterface,
    hotspotPoolRange,
    dnsServers,
    setupMode,
    portalDomain,
    cleanPortalUrl,
    subnetNetwork,
  ])

  const handleCopyRsc = async () => {
    try {
      await navigator.clipboard.writeText(generatedRscScript)
      setCopiedRsc(true)
      toast.success('Script berhasil disalin. Silakan tempel di New Terminal MikroTik.')
      setTimeout(() => setCopiedRsc(false), 2500)
    } catch {
      toast.error('Gagal menyalin script')
    }
  }

  const handleDownloadRsc = () => {
    const blob = new Blob([generatedRscScript], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wifiads-${nasIdentifier.trim() || 'setup'}.rsc`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Berkas wifiads-${nasIdentifier.trim() || 'setup'}.rsc berhasil diunduh`)
  }

  const handleDownloadLoginHtml = () => {
    const blob = new Blob([loginHtmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'login.html'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Berkas login.html berhasil diunduh')
  }

  if (isLoading) {
    return (
      <div className="stitch-card-container" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
        <p style={{ color: '#64748b', margin: 0 }}>Memuat pengaturan router...</p>
      </div>
    )
  }

  return (
    <div>
      <WavyHeader
        title={isNew ? 'Tambah Router Baru' : `Pengaturan Router: ${currentRouter?.name || name}`}
        actions={
          <Link to="/routers" className="btn btn-secondary">
            <ArrowLeft size={16} /> Kembali ke Daftar Router
          </Link>
        }
      />

      <div className="stitch-page-stage">
        {/* Panduan Singkat 3 Langkah */}
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            fontSize: '12px',
            color: '#1e3a8a',
          }}
        >
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <strong style={{ background: '#2563eb', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px' }}>1</strong>
            <div>
              <strong>Simpan Pengaturan:</strong> Isi nama lokasi dan kode router di panel kiri, lalu klik tombol simpan.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <strong style={{ background: '#2563eb', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px' }}>2</strong>
            <div>
              <strong>Tempel Script di MikroTik:</strong> Klik <strong>Salin Script</strong> di panel kanan lalu tempel ke <strong>New Terminal</strong> MikroTik.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <strong style={{ background: '#2563eb', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px' }}>3</strong>
            <div>
              <strong>Selesai:</strong> Begitu script dijalankan, status router pada halaman daftar otomatis berubah menjadi <strong>Terhubung</strong>.
            </div>
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* LEFT COLUMN: Configuration Form */}
          <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={18} color="#2563eb" />
                {isNew ? 'Pengaturan Router Baru' : `Pengaturan Router`}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0.2rem 0 0' }}>
                Perubahan di bawah ini langsung memperbarui isi script MikroTik di sebelah kanan.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Nama Router / Lokasi
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Router Lobby"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Kode Identitas Router
                  </label>
                  <input
                    type="text"
                    value={nasIdentifier}
                    onChange={(e) => setNasIdentifier(e.target.value)}
                    placeholder="wifiads-router"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Public IP Info */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                  <Globe size={14} color="#10b981" />
                  IP Publik Router
                </label>
                <input
                  type="text"
                  value={nasPublicIp && nasPublicIp !== '0.0.0.0' ? nasPublicIp : 'Terdeteksi otomatis saat router terhubung'}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    background: '#f8fafc',
                    color: '#475569',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                  Tidak perlu diisi manual. Sistem mengenali router secara otomatis meskipun IP internet berubah-ubah.
                </span>
              </div>

              {/* RADIUS Shared Secret */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <KeyRound size={14} color="#2563eb" />
                    Kunci Rahasia RADIUS
                  </label>
                  <button
                    type="button"
                    onClick={() => setRadiusSecret(generateRandomSecret(24))}
                    style={{
                      border: 'none',
                      background: '#f1f5f9',
                      color: '#334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Acak Kunci Baru
                  </button>
                </div>
                <input
                  type="text"
                  value={radiusSecret}
                  onChange={(e) => setRadiusSecret(e.target.value)}
                  placeholder="Kunci rahasia RADIUS"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    background: '#f8fafc',
                  }}
                />
              </div>

              {/* Hotspot Gateway IP & Server IP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    IP Gateway Hotspot
                  </label>
                  <input
                    type="text"
                    value={hotspotIp}
                    onChange={(e) => handleHotspotIpChange(e.target.value)}
                    placeholder="10.10.0.1"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    IP Server Utama
                  </label>
                  <input
                    type="text"
                    value={radiusServerIp}
                    onChange={(e) => setRadiusServerIp(e.target.value)}
                    placeholder="13.54.63.73"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              {/* Mode Setup Toggle */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                  Mode Konfigurasi Script
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setSetupMode('existing')}
                    style={{
                      padding: '0.7rem 0.75rem',
                      borderRadius: '10px',
                      border: setupMode === 'existing' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: setupMode === 'existing' ? '#eff6ff' : '#ffffff',
                      color: setupMode === 'existing' ? '#1d4ed8' : '#475569',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>Hotspot Sudah Ada</div>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', marginTop: '2px' }}>
                      Hanya menambahkan pengaturan RADIUS dan halaman login
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSetupMode('full')}
                    style={{
                      padding: '0.7rem 0.75rem',
                      borderRadius: '10px',
                      border: setupMode === 'full' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: setupMode === 'full' ? '#eff6ff' : '#ffffff',
                      color: setupMode === 'full' ? '#1d4ed8' : '#475569',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>Konfigurasi Baru dari Awal</div>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', marginTop: '2px' }}>
                      Sekaligus membuat IP, DHCP, NAT, dan server Hotspot
                    </div>
                  </button>
                </div>
              </div>

              {setupMode === 'full' && (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '0.9rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                        Port / Interface Hotspot
                      </label>
                      <input
                        type="text"
                        value={hotspotInterface}
                        onChange={(e) => setHotspotInterface(e.target.value)}
                        placeholder="ether3-slave-local / wlan1"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.7rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                        Rentang IP Pengguna (DHCP)
                      </label>
                      <input
                        type="text"
                        value={hotspotPoolRange}
                        onChange={(e) => setHotspotPoolRange(e.target.value)}
                        placeholder="10.10.0.10-10.10.0.250"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.7rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      DNS Server
                    </label>
                    <input
                      type="text"
                      value={dnsServers}
                      onChange={(e) => setDnsServers(e.target.value)}
                      placeholder="8.8.8.8,1.1.1.1"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.7rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Penempatan Lokasi Mitra & Rank Tarif Iklan */}
              <div
                style={{
                  paddingTop: '0.85rem',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Store size={15} color="#2563eb" />
                  Penempatan Lokasi Mitra &amp; Rank Tarif Iklan
                </label>

                {/* Partner Venue Selector */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '11px', padding: '0.9rem 1rem', display: 'grid', gap: '0.55rem' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                    Mitra Pemilik Lokasi (Opsional)
                  </label>
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                    }}
                  >
                    <option value="">— Belum Dihubungkan ke Mitra —</option>
                    {partnerOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.venue_name}
                        {p.status === 'INVITED'
                          ? ' (Menunggu Aktivasi Mitra)'
                          : p.name
                            ? ` — ${p.name}`
                            : ''}
                      </option>
                    ))}
                  </select>

                  {selectedPartner ? (
                    <div
                      style={{
                        marginTop: '0.2rem',
                        padding: '0.7rem 0.85rem',
                        borderRadius: '9px',
                        background: selectedPartner.has_coordinates ? '#ecfdf5' : '#fffbeb',
                        border: `1px solid ${selectedPartner.has_coordinates ? '#a7f3d0' : '#fde68a'}`,
                        color: selectedPartner.has_coordinates ? '#065f46' : '#92400e',
                        fontSize: '12px',
                        display: 'grid',
                        gap: '2px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
                        <MapPin size={13} />
                        <span>
                          {selectedPartner.venue_name} ({selectedPartner.venue_category || 'Kafe'}) —{' '}
                          {selectedPartner.has_coordinates
                            ? 'Titik Lokasi Aktif ✓'
                            : 'Menunggu Mitra Mengatur Lokasi'}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px' }}>
                        {selectedPartner.has_coordinates
                          ? selectedPartner.address
                          : 'Router sudah tersambung ke mitra ini. Titik peta di halaman Pengiklan akan otomatis tampil begitu mitra melengkapi lokasi usaha mereka.'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Titik peta, alamat, dan nama tempat dikelola langsung oleh Mitra melalui akun mereka. Anda tetap dapat menyiapkan router &amp; script MikroTik sekarang lalu menghubungkannya ke Mitra kapan saja.
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    Penentuan Rank Lokasi (Multiplier Tarif)
                  </label>
                  <select
                    value={locationTierAuto ? 'auto' : locationTierId}
                    onChange={(e) => {
                      if (e.target.value === 'auto') {
                        setLocationTierAuto(true)
                      } else {
                        setLocationTierAuto(false)
                        setLocationTierId(e.target.value)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                    }}
                  >
                    <option value="auto">Otomatis Berdasarkan Trafik Harian</option>
                    {locationTiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        Kunci Manual: {t.name} ({t.multiplier}x)
                      </option>
                    ))}
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', cursor: 'pointer', color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={isPublicMarketplace}
                    onChange={(e) => setIsPublicMarketplace(e.target.checked)}
                  />
                  <span><strong>Tampilkan lokasi ini di peta pemilihan iklan (ketika titik lokasi mitra sudah aktif)</strong></span>
                </label>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.8rem 1.2rem',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                }}
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {isNew ? 'Simpan Router Baru' : 'Simpan Perubahan'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Generated .rsc Script */}
          <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Code2 size={18} color="#2563eb" />
                  Script Konfigurasi MikroTik
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Siap ditempelkan ke terminal MikroTik atau diunduh sebagai berkas <code>.rsc</code>.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCopyRsc}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: copiedRsc ? '#dcfce7' : '#f8fafc',
                    color: copiedRsc ? '#166534' : '#0f172a',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {copiedRsc ? <Check size={14} /> : <Copy size={14} />}
                  {copiedRsc ? 'Tersalin' : 'Salin Script'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadRsc}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} />
                  Unduh .rsc
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLoginHtml}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FileCode size={14} />
                  login.html
                </button>
              </div>
            </div>

            <pre
              style={{
                margin: 0,
                padding: '1rem',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#e2e8f0',
                fontSize: '12px',
                lineHeight: 1.55,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                overflowX: 'auto',
                maxHeight: '420px',
                overflowY: 'auto',
                border: '1px solid #1e293b',
              }}
            >
              <code>{generatedRscScript}</code>
            </pre>

            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '12px',
                color: '#166534',
                lineHeight: 1.5,
              }}
            >
              <ShieldCheck size={17} style={{ flexShrink: 0 }} />
              <div>
                Salin script di atas lalu tempel (Paste) pada menu <strong>New Terminal</strong> di WinBox atau WebFig MikroTik.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
