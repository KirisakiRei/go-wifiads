import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Home,
  Key,
  LogOut,
  PanelLeft,
  Router,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import {
  allNavLeafItems,
  isNavGroup,
  type NavBadgeKey,
  navigationSections,
} from '@/config/navigation'
import { authApi } from '@/features/auth/api/auth.api'
import { authQueryKey, useCurrentUser } from '@/features/auth/hooks/use-current-user'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: user } = useCurrentUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)

  const passwordMutation = useMutation({
    mutationFn: authApi.changeOwnPassword,
    onSuccess: () => {
      toast.success('Kata sandi berhasil diperbarui')
      setShowPasswordModal(false)
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal memperbarui kata sandi'),
  })

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
  const sortedLeafs = [...allNavLeafItems].sort((a, b) => b.to.length - a.to.length)
  const currentNav = sortedLeafs.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )
  const currentTitle = currentNav?.label || 'Panel Pengelola'

  const { data: badges } = useQuery({
    queryKey: ['admin-sidebar-badges'],
    queryFn: adminMarketplaceApi.getBadges,
    refetchInterval: 45_000,
  })

  const getBadgeCount = (key?: NavBadgeKey): number => {
    if (!key || !badges) return 0
    if (key === 'pending_campaigns') return badges.pending_campaigns_count || 0
    if (key === 'waiting_topups') return badges.waiting_topups_count || 0
    if (key === 'pending_withdrawals') return badges.pending_withdrawals_count || 0
    return 0
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    advertisers: true,
    partners: true,
    finance: false,
  })

  useEffect(() => {
    navigationSections.forEach((sec) => {
      sec.items.forEach((it) => {
        if (isNavGroup(it)) {
          const activeChild = it.children.some((ch) =>
            ch.end ? location.pathname === ch.to : location.pathname.startsWith(ch.to)
          )
          if (activeChild) {
            setOpenGroups((prev) => (prev[it.key] ? prev : { ...prev, [it.key]: true }))
          }
        }
      })
    })
  }, [location.pathname])

  const toggleGroup = (key: string, firstChildTo: string) => {
    if (isCollapsed) {
      navigate(firstChildTo)
      return
    }
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="stitch-shell">
      {/* 260px Fixed Sidebar (Collapsible to 72px) */}
      <aside className={`stitch-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: '0.75rem' }}>
          {/* Brand Header */}
          <div className="sidebar-header">
            <NavLink to="/dashboard" className="sidebar-brand" title="AdWave WiFi Dashboard">
              <div className="sidebar-brand-icon">
                <Router size={20} />
              </div>
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">AdWave WiFi</span>
                <span className="sidebar-brand-sub">Manajemen Wi-Fi &amp; Iklan</span>
              </div>
            </NavLink>
          </div>

          {navigationSections.map((sec) => (
            <div key={sec.title}>
              <div className="sidebar-section-title">{sec.title}</div>

              <nav className="sidebar-nav">
                {sec.items.map((item) => {
                  if (!isNavGroup(item)) {
                    const Icon = item.icon
                    const count = getBadgeCount(item.badgeKey)
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={isCollapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `sidebar-nav-link ${isActive ? 'active' : ''}`
                        }
                      >
                        <Icon size={19} />
                        <span className="sidebar-link-text" style={{ flex: 1 }}>
                          {item.label}
                        </span>
                        {!isCollapsed && count > 0 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: '#fef3c7',
                              color: '#b45309',
                              marginRight: '0.5rem',
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </NavLink>
                    )
                  }

                  const GroupIcon = item.icon
                  const isOpen = Boolean(openGroups[item.key])
                  const hasActiveChild = item.children.some((ch) =>
                    ch.end ? location.pathname === ch.to : location.pathname.startsWith(ch.to)
                  )
                  const groupTotalBadge = item.children.reduce(
                    (sum, ch) => sum + getBadgeCount(ch.badgeKey),
                    0
                  )

                  return (
                    <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        type="button"
                        title={isCollapsed ? item.label : undefined}
                        onClick={() => toggleGroup(item.key, item.children[0].to)}
                        className={`sidebar-nav-link ${isCollapsed && hasActiveChild ? 'active' : ''}`}
                        style={{
                          width: '100%',
                          border: 'none',
                          background:
                            !isCollapsed && hasActiveChild ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        <GroupIcon
                          size={19}
                          color={hasActiveChild ? '#1d4ed8' : undefined}
                        />
                        <span
                          className="sidebar-link-text"
                          style={{
                            flex: 1,
                            fontWeight: hasActiveChild ? 700 : 600,
                            color: hasActiveChild ? '#1d4ed8' : undefined,
                          }}
                        >
                          {item.label}
                        </span>
                        {!isCollapsed && groupTotalBadge > 0 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: '#fef3c7',
                              color: '#b45309',
                            }}
                          >
                            {groupTotalBadge}
                          </span>
                        )}
                        {!isCollapsed && (
                          <ChevronDown
                            size={15}
                            style={{
                              marginRight: '0.6rem',
                              color: '#64748b',
                              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                            }}
                          />
                        )}
                      </button>

                      {!isCollapsed && isOpen && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            paddingLeft: '1.15rem',
                            marginLeft: '0.95rem',
                            borderLeft: '1.5px solid #e2e8f0',
                          }}
                        >
                          {item.children.map((child) => {
                            const ChildIcon = child.icon
                            const cBadge = getBadgeCount(child.badgeKey)
                            return (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                end={child.end}
                                className={({ isActive }) =>
                                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                                }
                                style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '13px' }}
                              >
                                <ChildIcon size={16} />
                                <span className="sidebar-link-text" style={{ flex: 1 }}>
                                  {child.label}
                                </span>
                                {cBadge > 0 && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: '999px',
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      marginRight: '0.5rem',
                                    }}
                                  >
                                    {cBadge}
                                  </span>
                                )}
                              </NavLink>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>
          ))}
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
                placeholder="Cari perangkat, voucher, atau iklan..."
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
                        setNewPassword('')
                        setConfirmPassword('')
                        setShowPasswordModal(true)
                      }}
                    >
                      <Key size={16} />
                      <span>Ubah Kata Sandi</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setIsProfileOpen(false)
                        navigate('/users')
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>Pengguna &amp; Akses</span>
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

      {showPasswordModal && (
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
            padding: '1.25rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPasswordModal(false)
          }}
        >
          <div
            className="stitch-card-container"
            style={{
              width: '100%',
              maxWidth: '440px',
              borderRadius: '16px',
              background: '#ffffff',
              overflow: 'hidden',
            }}
          >
            <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div className="table-toolbar-title">
                <Key size={18} color="#1d4ed8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Ubah Kata Sandi</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {user?.name || 'Administrator'} (@{user?.username || 'admin'})
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.4rem' }}
                onClick={() => setShowPasswordModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (newPassword.length < 6) {
                  toast.error('Kata sandi minimal 6 karakter')
                  return
                }
                if (newPassword !== confirmPassword) {
                  toast.error('Konfirmasi kata sandi tidak cocok')
                  return
                }
                passwordMutation.mutate(newPassword)
              }}
              style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}
            >
              <div className="form-field">
                <label>Kata Sandi Baru</label>
                <input
                  type="password"
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Ulangi Kata Sandi Baru</label>
                <input
                  type="password"
                  minLength={6}
                  placeholder="Ketik ulang kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={passwordMutation.isPending}>
                  <Save size={16} />
                  {passwordMutation.isPending ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
