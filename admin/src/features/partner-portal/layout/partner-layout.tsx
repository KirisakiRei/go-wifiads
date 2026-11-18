import {
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeft,
  Router,
  Store,
  UserCircle,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import {
  partnerAuthQueryKey,
  useCurrentPartner,
} from '@/features/partner-portal/hooks/use-current-partner'
import { formatRupiah } from '@/lib/formatters'

const PARTNER_NAV = [
  { label: 'Ringkasan Lokasi', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Iklan di Lokasi', to: '/ads', icon: Megaphone },
  { label: 'Pendapatan & Pencairan', to: '/earnings', icon: Wallet },
  { label: 'Perangkat Wi-Fi', to: '/routers', icon: Router },
  { label: 'Profil & Titik Peta', to: '/profile', icon: UserCircle },
]

export function PartnerLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: partner } = useCurrentPartner()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const currentNav = PARTNER_NAV.find((item) => location.pathname.startsWith(item.to))

  async function handleLogout() {
    try {
      await partnerApi.logout()
    } catch {
      /* ignore */
    }
    queryClient.removeQueries({ queryKey: partnerAuthQueryKey })
    toast.success('Sesi mitra telah berakhir')
    navigate('/login', { replace: true })
  }

  return (
    <div className="stitch-shell">
      <aside className={`stitch-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="sidebar-header">
            <NavLink to="/dashboard" className="sidebar-brand">
              <div className="sidebar-brand-icon" style={{ background: '#059669' }}>
                <Store size={20} />
              </div>
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">AdWave Mitra</span>
                <span className="sidebar-brand-sub">Portal Pemilik Lokasi</span>
              </div>
            </NavLink>
          </div>

          <div className="sidebar-section-title">Menu Mitra</div>

          <nav className="sidebar-nav">
            {PARTNER_NAV.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span className="sidebar-link-text">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile-strip">
            <div className="user-profile-info">
              <div
                className="user-avatar-circle"
                style={{ background: '#d1fae5', color: '#065f46' }}
              >
                {(partner?.venue_name || partner?.name || 'MT').substring(0, 2).toUpperCase()}
              </div>
              <div className="user-profile-details">
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0b1c30' }}>
                  {partner?.venue_name || partner?.name || 'Mitra Lokasi'}
                </span>
                <span style={{ fontSize: '11px', color: '#747686' }}>
                  {partner?.name || 'Pemilik Lokasi'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="logout-icon-btn"
              title="Keluar Sesi"
              onClick={handleLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className={`stitch-main-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="stitch-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-panel-toggle-btn"
              onClick={() => setIsCollapsed((p) => !p)}
            >
              <PanelLeft size={18} />
            </button>

            <div className="breadcrumb-trail">
              <Home size={18} />
              <span>/</span>
              <span className="breadcrumb-current">{currentNav?.label || 'Portal Mitra'}</span>
            </div>
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => navigate('/earnings')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.42rem 0.85rem',
                borderRadius: '999px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Wallet size={14} />
              <span>Saldo: {formatRupiah(partner?.wallet_balance_idr || 0)}</span>
            </button>
          </div>
        </header>

        <main style={{ minHeight: 'calc(100vh - 64px)', background: '#f8f9ff' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
