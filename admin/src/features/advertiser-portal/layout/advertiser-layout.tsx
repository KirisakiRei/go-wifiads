import {
  BarChart3,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeft,
  PlusCircle,
  User,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import {
  advertiserAuthQueryKey,
  useCurrentAdvertiser,
} from '@/features/advertiser-portal/hooks/use-current-advertiser'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import { formatRupiah } from '@/lib/formatters'

const ADV_NAV = [
  { label: 'Ringkasan', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Iklan Saya', to: '/campaigns', icon: Megaphone },
  { label: 'Pasang Iklan', to: '/campaigns/new', icon: PlusCircle },
  { label: 'Saldo & Top-Up', to: '/wallet', icon: Wallet },
  { label: 'Laporan Statistik', to: '/analytics', icon: BarChart3 },
  { label: 'Profil Usaha', to: '/profile', icon: User },
]

export function AdvertiserLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: advertiser } = useCurrentAdvertiser()
  const [isCollapsed, setIsCollapsed] = useState(false)

  async function handleLogout() {
    try {
      await advertiserApi.logout()
    } catch {
      /* ignore */
    }
    queryClient.removeQueries({ queryKey: advertiserAuthQueryKey })
    toast.success('Berhasil keluar dari akun pengiklan')
    navigate('/login', { replace: true })
  }

  const currentNav =
    ADV_NAV.find((item) => location.pathname === item.to) ||
    ADV_NAV.find((item) => location.pathname.startsWith(item.to))

  return (
    <div className="stitch-shell">
      <aside className={`stitch-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="sidebar-header">
            <NavLink to="/dashboard" className="sidebar-brand">
              <div className="sidebar-brand-icon" style={{ background: '#1d4ed8' }}>
                <Megaphone size={20} />
              </div>
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">AdWave Partner</span>
                <span className="sidebar-brand-sub">Portal Pengiklan</span>
              </div>
            </NavLink>
          </div>

          <div className="sidebar-section-title">Menu Pengiklan</div>

          <nav className="sidebar-nav">
            {ADV_NAV.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/campaigns'}
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
              <div className="user-avatar-circle">
                {(advertiser?.name || 'KL').substring(0, 2).toUpperCase()}
              </div>
              <div className="user-profile-details">
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0b1c30' }}>
                  {advertiser?.name || 'Pengiklan'}
                </span>
                <span style={{ fontSize: '11px', color: '#747686' }}>
                  {advertiser?.company_name || advertiser?.email}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="logout-icon-btn"
              title="Keluar"
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
              onClick={() => setIsCollapsed((prev) => !prev)}
            >
              <PanelLeft size={18} />
            </button>

            <div className="breadcrumb-trail">
              <Home size={18} />
              <span>/</span>
              <span className="breadcrumb-current">{currentNav?.label || 'Panel Pengiklan'}</span>
            </div>
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              to="/wallet"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e3a8a',
                padding: '0.42rem 0.9rem',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Wallet size={15} color="#2563eb" />
              <span>Saldo: {formatRupiah(advertiser?.wallet_balance_idr || 0)}</span>
            </Link>

            <Link
              to="/campaigns/new"
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '12px', textDecoration: 'none' }}
            >
              <PlusCircle size={15} />
              Pasang Iklan
            </Link>
          </div>
        </header>

        <main style={{ minHeight: 'calc(100vh - 64px)', background: '#f8f9ff' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
