import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  LogOut,
  PanelLeft,
  Router,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { navigation } from '@/config/navigation'
import { authApi } from '@/features/auth/api/auth.api'
import { authQueryKey, useCurrentUser } from '@/features/auth/hooks/use-current-user'

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: user } = useCurrentUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Collapsible sidebar state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wifiads_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('wifiads_sidebar_collapsed', String(next))
      } catch {
        /* ignore localStorage quota/disabled */
      }
      return next
    })
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      /* cookie is cleared best-effort */
    }
    queryClient.removeQueries({ queryKey: authQueryKey })
    toast.success('Sesi admin telah diakhiri')
    navigate('/login', { replace: true })
  }

  // Get current active section name for breadcrumb
  const currentNav = navigation.find((item) =>
    location.pathname.startsWith(item.to)
  )
  const currentTitle = currentNav?.label || 'Gateway Console'

  return (
    <div className="stitch-shell">
      {/* 260px Fixed Sidebar (Collapsible to 72px) */}
      <aside className={`stitch-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div>
          {/* Brand Header */}
          <div className="sidebar-header">
            <NavLink to="/dashboard" className="sidebar-brand" title="AdWave WiFi Dashboard">
              <div className="sidebar-brand-icon">
                <Router size={20} />
              </div>
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">AdWave WiFi</span>
                <span className="sidebar-brand-sub">MikroTik SaaS AdOps</span>
              </div>
            </NavLink>
          </div>

          {/* Section Heading */}
          <div className="sidebar-section-title">
            Navigasi Utama
          </div>

          {/* Nav Links with Hover and Active Curved Transitions */}
          <nav className="sidebar-nav">
            {navigation.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={20} />
                <span className="sidebar-link-text">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-strip">
            <div className="user-profile-info">
              <div className="user-avatar-circle" title={user?.name || user?.username || 'Administrator'}>
                {(user?.name || user?.username || 'AD').substring(0, 2).toUpperCase()}
              </div>
              <div className="user-profile-details">
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0b1c30' }}>
                  {user?.name || user?.username || 'Administrator'}
                </span>
                <span style={{ fontSize: '11px', color: '#747686', textTransform: 'capitalize' }}>
                  {user?.role || 'Superuser'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="logout-icon-btn"
              title="Keluar dari sesi admin"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className={`stitch-main-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sticky Topbar with Curved Corner */}
        <header className="stitch-topbar">
          {/* Aesthetic Curved Junction between Sidebar and Header */}
          <div className="topbar-sidebar-curve" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
              <path
                d="M0,0 L32,0 C14.327,0 0,14.327 0,32 L0,0 Z"
                fill="#ffffff"
              />
              <path
                d="M32,0 C14.327,0 0,14.327 0,32"
                stroke="var(--border)"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          </div>

          <div className="topbar-left">
            <button
              type="button"
              className="topbar-panel-toggle-btn"
              title={isCollapsed ? 'Perlebar Sidebar' : 'Perkecil Sidebar'}
              onClick={toggleSidebar}
            >
              <PanelLeft size={18} />
            </button>

            <div className="breadcrumb-trail">
              <Home size={18} />
              <span>/</span>
              <span className="breadcrumb-current">{currentTitle}</span>
            </div>

            <div className="global-search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="global-search-input"
                placeholder="Cari MAC address, voucher, campaign..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-profile-anchor" ref={profileRef}>
              <button
                type="button"
                className={`topbar-avatar-btn ${isProfileOpen ? 'active' : ''}`}
                title="Menu Profil Administrator"
                onClick={() => setIsProfileOpen((prev) => !prev)}
              >
                <span className="avatar-text">
                  {(user?.name || user?.username || 'AD').substring(0, 2).toUpperCase()}
                </span>
                <span className="status-indicator-dot" />
              </button>

              {/* Clean Dropdown */}
              {isProfileOpen && (
                <div className="profile-dropdown-card">
                  <div className="profile-dropdown-header">
                    <div className="dropdown-avatar-lg">
                      {(user?.name || user?.username || 'AD').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="dropdown-user-details">
                      <span className="dropdown-user-name">
                        {user?.name || user?.username || 'Administrator'}
                      </span>
                      <div className="dropdown-user-role">
                        <span className="role-tag">{user?.role || 'Superuser'}</span>
                        <span className="active-tag">Online</span>
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="dropdown-actions">
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setIsProfileOpen(false)
                        navigate('/rbac')
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>Akses & Pengguna</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-item logout-item"
                      onClick={() => {
                        setIsProfileOpen(false)
                        logout()
                      }}
                    >
                      <LogOut size={16} />
                      <span>Keluar Sesi</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main style={{ minHeight: 'calc(100vh - 64px)', background: '#f8f9ff' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
