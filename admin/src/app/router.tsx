import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import {
  AdvertiserProtectedRoute,
  AdvertiserPublicOnlyRoute,
} from '@/features/advertiser-portal/hooks/use-current-advertiser'
import {
  PartnerProtectedRoute,
  PartnerPublicOnlyRoute,
} from '@/features/partner-portal/hooks/use-current-partner'
import { ProtectedRoute } from '@/routes/protected-route'
import { PublicOnlyRoute } from '@/routes/public-only-route'

const AppLayout = lazy(() =>
  import('@/components/layout/app-layout').then((m) => ({ default: m.AppLayout }))
)
const AdvertiserLayout = lazy(() =>
  import('@/features/advertiser-portal/layout/advertiser-layout').then((m) => ({
    default: m.AdvertiserLayout,
  }))
)
const PartnerLayout = lazy(() =>
  import('@/features/partner-portal/layout/partner-layout').then((m) => ({
    default: m.PartnerLayout,
  }))
)
const PublicLayout = lazy(() =>
  import('@/features/public-site/components/public-layout').then((m) => ({
    default: m.PublicLayout,
  }))
)

// Admin pages
const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((m) => ({ default: m.LoginPage }))
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/dashboard-page').then((m) => ({ default: m.DashboardPage }))
)
const RoutersPage = lazy(() =>
  import('@/features/routers/pages/routers-page').then((m) => ({ default: m.RoutersPage }))
)
const RouterDetailPage = lazy(() =>
  import('@/features/routers/pages/router-detail-page').then((m) => ({
    default: m.RouterDetailPage,
  }))
)
const ProfilesPage = lazy(() =>
  import('@/features/profiles/pages/profiles-page').then((m) => ({ default: m.ProfilesPage }))
)
const AdminAdvertisersPage = lazy(() =>
  import('@/features/marketplace/pages/admin-advertisers-page').then((m) => ({
    default: m.AdminAdvertisersPage,
  }))
)
const AdminCampaignsPage = lazy(() =>
  import('@/features/marketplace/pages/admin-campaigns-page').then((m) => ({
    default: m.AdminCampaignsPage,
  }))
)
const AdminTopupsPage = lazy(() =>
  import('@/features/marketplace/pages/admin-topups-page').then((m) => ({
    default: m.AdminTopupsPage,
  }))
)
const AdminPartnersPage = lazy(() =>
  import('@/features/marketplace/pages/admin-partners-page').then((m) => ({
    default: m.AdminPartnersPage,
  }))
)
const AdminWithdrawalsPage = lazy(() =>
  import('@/features/marketplace/pages/admin-withdrawals-page').then((m) => ({
    default: m.AdminWithdrawalsPage,
  }))
)
const AdminFinancePage = lazy(() =>
  import('@/features/marketplace/pages/admin-finance-page').then((m) => ({
    default: m.AdminFinancePage,
  }))
)
const AdminAdSettingsPage = lazy(() =>
  import('@/features/marketplace/pages/admin-ad-settings-page').then((m) => ({
    default: m.AdminAdSettingsPage,
  }))
)
const AdvertisementsPage = lazy(() =>
  import('@/features/advertisements/pages/advertisements-page').then((m) => ({
    default: m.AdvertisementsPage,
  }))
)
const AdvertisementFormPage = lazy(() =>
  import('@/features/advertisements/pages/advertisement-form-page').then((m) => ({
    default: m.AdvertisementFormPage,
  }))
)
const VouchersPage = lazy(() =>
  import('@/features/vouchers/pages/vouchers-page').then((m) => ({ default: m.VouchersPage }))
)
const VisitorsPage = lazy(() =>
  import('@/features/visitors/pages/visitors-page').then((m) => ({ default: m.VisitorsPage }))
)
const SessionsPage = lazy(() =>
  import('@/features/sessions/pages/sessions-page').then((m) => ({ default: m.SessionsPage }))
)
const QuestionnairePage = lazy(() =>
  import('@/features/questionnaire/questionnaire-page').then((m) => ({
    default: m.QuestionnairePage,
  }))
)
const AuditLogsPage = lazy(() =>
  import('@/features/audit-logs/audit-logs-page').then((m) => ({ default: m.AuditLogsPage }))
)
const SettingsPage = lazy(() =>
  import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage }))
)
const UsersPage = lazy(() =>
  import('@/features/users/pages/users-page').then((m) => ({ default: m.UsersPage }))
)
const NotFoundPage = lazy(() =>
  import('@/routes/not-found-page').then((m) => ({ default: m.NotFoundPage }))
)

// Advertiser pages
const AdvertiserAuthPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-auth-page').then((m) => ({
    default: m.AdvertiserAuthPage,
  }))
)
const AdvertiserOverviewPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-overview-page').then((m) => ({
    default: m.AdvertiserOverviewPage,
  }))
)
const AdvertiserCampaignsPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-campaigns-page').then((m) => ({
    default: m.AdvertiserCampaignsPage,
  }))
)
const AdvertiserCampaignWizardPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-campaign-wizard-page').then((m) => ({
    default: m.AdvertiserCampaignWizardPage,
  }))
)
const AdvertiserCampaignDetailPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-campaign-detail-page').then((m) => ({
    default: m.AdvertiserCampaignDetailPage,
  }))
)
const AdvertiserWalletPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-wallet-page').then((m) => ({
    default: m.AdvertiserWalletPage,
  }))
)
const AdvertiserAnalyticsPage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-analytics-page').then((m) => ({
    default: m.AdvertiserAnalyticsPage,
  }))
)
const AdvertiserProfilePage = lazy(() =>
  import('@/features/advertiser-portal/pages/advertiser-profile-page').then((m) => ({
    default: m.AdvertiserProfilePage,
  }))
)

// Partner pages
const PartnerAuthPage = lazy(() =>
  import('@/features/partner-portal/pages/partner-auth-page').then((m) => ({
    default: m.PartnerAuthPage,
  }))
)
const PartnerInvitePage = lazy(() =>
  import('@/features/partner-portal/pages/partner-invite-page').then((m) => ({
    default: m.PartnerInvitePage,
  }))
)
const PartnerOverviewPage = lazy(() =>
  import('@/features/partner-portal/pages/partner-overview-page').then((m) => ({
    default: m.PartnerOverviewPage,
  }))
)
const PartnerAdsPage = lazy(() =>
  import('@/features/partner-portal/pages/partner-ads-page').then((m) => ({
    default: m.PartnerAdsPage,
  }))
)
const PartnerEarningsPage = lazy(() =>
  import('@/features/partner-portal/pages/partner-earnings-page').then((m) => ({
    default: m.PartnerEarningsPage,
  }))
)
const PartnerRoutersPage = lazy(() =>
  import('@/features/partner-portal/pages/partner-routers-page').then((m) => ({
    default: m.PartnerRoutersPage,
  }))
)
const PartnerProfilePage = lazy(() =>
  import('@/features/partner-portal/pages/partner-profile-page').then((m) => ({
    default: m.PartnerProfilePage,
  }))
)

// Public landing pages
const PublicHomePage = lazy(() =>
  import('@/features/public-site/pages/home-page').then((m) => ({ default: m.PublicHomePage }))
)
const MitraInfoPage = lazy(() =>
  import('@/features/public-site/pages/mitra-info-page').then((m) => ({
    default: m.MitraInfoPage,
  }))
)
const IklanInfoPage = lazy(() =>
  import('@/features/public-site/pages/iklan-info-page').then((m) => ({
    default: m.IklanInfoPage,
  }))
)
const DaftarMitraPage = lazy(() =>
  import('@/features/public-site/pages/daftar-mitra-page').then((m) => ({
    default: m.DaftarMitraPage,
  }))
)
const TentangPage = lazy(() =>
  import('@/features/public-site/pages/about-contact-pages').then((m) => ({
    default: m.TentangPage,
  }))
)
const KontakPage = lazy(() =>
  import('@/features/public-site/pages/about-contact-pages').then((m) => ({
    default: m.KontakPage,
  }))
)

function routeFallback() {
  return <div className="page-state">Memuat halaman...</div>
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={routeFallback()}>{node}</Suspense>
}

export function createAdminRouter() {
  return createBrowserRouter(
    [
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            {withSuspense(<LoginPage />)}
          </PublicOnlyRoute>
        ),
      },
      {
        element: (
          <ProtectedRoute>
            {withSuspense(<AppLayout />)}
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: withSuspense(<DashboardPage />) },
          { path: '/routers', element: withSuspense(<RoutersPage />) },
          { path: '/routers/new', element: withSuspense(<RouterDetailPage />) },
          { path: '/routers/:id', element: withSuspense(<RouterDetailPage />) },
          { path: '/profiles', element: withSuspense(<ProfilesPage />) },
          // Advertiser Group
          { path: '/advertisers', element: withSuspense(<AdminAdvertisersPage />) },
          { path: '/advertisers/campaigns', element: withSuspense(<AdminCampaignsPage />) },
          { path: '/advertisers/topups', element: withSuspense(<AdminTopupsPage />) },
          // Partner Group
          { path: '/partners', element: withSuspense(<AdminPartnersPage />) },
          { path: '/partners/withdrawals', element: withSuspense(<AdminWithdrawalsPage />) },
          // Finance & Pricing Settings Group
          { path: '/finance', element: withSuspense(<AdminFinancePage />) },
          { path: '/ad-settings', element: withSuspense(<AdminAdSettingsPage />) },
          { path: '/marketplace', element: <Navigate to="/advertisers/campaigns" replace /> },
          // Default Ads & Core Network
          { path: '/advertisements', element: withSuspense(<AdvertisementsPage />) },
          { path: '/advertisements/new', element: withSuspense(<AdvertisementFormPage />) },
          { path: '/advertisements/:id/edit', element: withSuspense(<AdvertisementFormPage />) },
          { path: '/vouchers', element: withSuspense(<VouchersPage />) },
          { path: '/visitors', element: withSuspense(<VisitorsPage />) },
          { path: '/sessions', element: withSuspense(<SessionsPage />) },
          { path: '/questionnaire', element: withSuspense(<QuestionnairePage />) },
          { path: '/logs', element: withSuspense(<AuditLogsPage />) },
          { path: '/settings', element: withSuspense(<SettingsPage />) },
          { path: '/users', element: withSuspense(<UsersPage />) },
        ],
      },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
    { basename: '/admin' }
  )
}

export function createAdvertiserRouter() {
  return createBrowserRouter(
    [
      {
        path: '/login',
        element: (
          <AdvertiserPublicOnlyRoute>
            {withSuspense(<AdvertiserAuthPage initialMode="login" />)}
          </AdvertiserPublicOnlyRoute>
        ),
      },
      {
        path: '/register',
        element: (
          <AdvertiserPublicOnlyRoute>
            {withSuspense(<AdvertiserAuthPage initialMode="register" />)}
          </AdvertiserPublicOnlyRoute>
        ),
      },
      {
        element: (
          <AdvertiserProtectedRoute>
            {withSuspense(<AdvertiserLayout />)}
          </AdvertiserProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: withSuspense(<AdvertiserOverviewPage />) },
          { path: '/campaigns', element: withSuspense(<AdvertiserCampaignsPage />) },
          { path: '/campaigns/new', element: withSuspense(<AdvertiserCampaignWizardPage />) },
          { path: '/campaigns/:id', element: withSuspense(<AdvertiserCampaignDetailPage />) },
          { path: '/campaigns/:id/edit', element: withSuspense(<AdvertiserCampaignWizardPage />) },
          { path: '/wallet', element: withSuspense(<AdvertiserWalletPage />) },
          { path: '/analytics', element: withSuspense(<AdvertiserAnalyticsPage />) },
          { path: '/profile', element: withSuspense(<AdvertiserProfilePage />) },
        ],
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
    { basename: '/advertiser' }
  )
}

export function createPartnerRouter() {
  return createBrowserRouter(
    [
      {
        path: '/login',
        element: (
          <PartnerPublicOnlyRoute>
            {withSuspense(<PartnerAuthPage />)}
          </PartnerPublicOnlyRoute>
        ),
      },
      { path: '/invite/:token', element: withSuspense(<PartnerInvitePage />) },
      {
        element: (
          <PartnerProtectedRoute>
            {withSuspense(<PartnerLayout />)}
          </PartnerProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: withSuspense(<PartnerOverviewPage />) },
          { path: '/ads', element: withSuspense(<PartnerAdsPage />) },
          { path: '/earnings', element: withSuspense(<PartnerEarningsPage />) },
          { path: '/routers', element: withSuspense(<PartnerRoutersPage />) },
          { path: '/profile', element: withSuspense(<PartnerProfilePage />) },
        ],
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
    { basename: '/partner' }
  )
}

export function createPublicRouter() {
  return createBrowserRouter([
    {
      element: withSuspense(<PublicLayout />),
      children: [
        { path: '/', element: withSuspense(<PublicHomePage />) },
        { path: '/mitra-info', element: withSuspense(<MitraInfoPage />) },
        { path: '/iklan-info', element: withSuspense(<IklanInfoPage />) },
        { path: '/daftar-mitra', element: withSuspense(<DaftarMitraPage />) },
        { path: '/tentang', element: withSuspense(<TentangPage />) },
        { path: '/kontak', element: withSuspense(<KontakPage />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ])
}
