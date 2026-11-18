import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import {
  AdvertiserProtectedRoute,
  AdvertiserPublicOnlyRoute,
} from '@/features/advertiser-portal/hooks/use-current-advertiser'
import { AdvertiserLayout } from '@/features/advertiser-portal/layout/advertiser-layout'
import { AdvertiserAnalyticsPage } from '@/features/advertiser-portal/pages/advertiser-analytics-page'
import { AdvertiserAuthPage } from '@/features/advertiser-portal/pages/advertiser-auth-page'
import { AdvertiserCampaignDetailPage } from '@/features/advertiser-portal/pages/advertiser-campaign-detail-page'
import { AdvertiserCampaignWizardPage } from '@/features/advertiser-portal/pages/advertiser-campaign-wizard-page'
import { AdvertiserCampaignsPage } from '@/features/advertiser-portal/pages/advertiser-campaigns-page'
import { AdvertiserOverviewPage } from '@/features/advertiser-portal/pages/advertiser-overview-page'
import { AdvertiserProfilePage } from '@/features/advertiser-portal/pages/advertiser-profile-page'
import { AdvertiserWalletPage } from '@/features/advertiser-portal/pages/advertiser-wallet-page'
import { AdvertisementFormPage } from '@/features/advertisements/pages/advertisement-form-page'
import { AdvertisementsPage } from '@/features/advertisements/pages/advertisements-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { AdminAdSettingsPage } from '@/features/marketplace/pages/admin-ad-settings-page'
import { AdminAdvertisersPage } from '@/features/marketplace/pages/admin-advertisers-page'
import { AdminCampaignsPage } from '@/features/marketplace/pages/admin-campaigns-page'
import { AdminFinancePage } from '@/features/marketplace/pages/admin-finance-page'
import { AdminPartnersPage } from '@/features/marketplace/pages/admin-partners-page'
import { AdminTopupsPage } from '@/features/marketplace/pages/admin-topups-page'
import { AdminWithdrawalsPage } from '@/features/marketplace/pages/admin-withdrawals-page'
import {
  PartnerProtectedRoute,
  PartnerPublicOnlyRoute,
} from '@/features/partner-portal/hooks/use-current-partner'
import { PartnerLayout } from '@/features/partner-portal/layout/partner-layout'
import { PartnerAdsPage } from '@/features/partner-portal/pages/partner-ads-page'
import { PartnerAuthPage } from '@/features/partner-portal/pages/partner-auth-page'
import { PartnerEarningsPage } from '@/features/partner-portal/pages/partner-earnings-page'
import { PartnerOverviewPage } from '@/features/partner-portal/pages/partner-overview-page'
import { PartnerProfilePage } from '@/features/partner-portal/pages/partner-profile-page'
import { PartnerRoutersPage } from '@/features/partner-portal/pages/partner-routers-page'
import { ProfilesPage } from '@/features/profiles/pages/profiles-page'
import { RouterDetailPage } from '@/features/routers/pages/router-detail-page'
import { RoutersPage } from '@/features/routers/pages/routers-page'
import { UsersPage } from '@/features/users/pages/users-page'
import { VisitorsPage } from '@/features/visitors/pages/visitors-page'
import { VouchersPage } from '@/features/vouchers/pages/vouchers-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { ProtectedRoute } from '@/routes/protected-route'
import { PublicOnlyRoute } from '@/routes/public-only-route'

export function createAdminRouter() {
  return createBrowserRouter(
    [
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ),
      },
      {
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/routers', element: <RoutersPage /> },
          { path: '/routers/new', element: <RouterDetailPage /> },
          { path: '/routers/:id', element: <RouterDetailPage /> },
          { path: '/profiles', element: <ProfilesPage /> },

          // Advertiser Group
          { path: '/advertisers', element: <AdminAdvertisersPage /> },
          { path: '/advertisers/campaigns', element: <AdminCampaignsPage /> },
          { path: '/advertisers/topups', element: <AdminTopupsPage /> },

          // Partner Group
          { path: '/partners', element: <AdminPartnersPage /> },
          { path: '/partners/withdrawals', element: <AdminWithdrawalsPage /> },

          // Finance & Pricing Settings Group
          { path: '/finance', element: <AdminFinancePage /> },
          { path: '/ad-settings', element: <AdminAdSettingsPage /> },
          { path: '/marketplace', element: <Navigate to="/advertisers/campaigns" replace /> },

          // Default Ads & Core Network
          { path: '/advertisements', element: <AdvertisementsPage /> },
          { path: '/advertisements/new', element: <AdvertisementFormPage /> },
          { path: '/advertisements/:id/edit', element: <AdvertisementFormPage /> },
          { path: '/vouchers', element: <VouchersPage /> },
          { path: '/visitors', element: <VisitorsPage /> },
          { path: '/sessions', element: <Navigate to="/routers" replace /> },
          { path: '/users', element: <UsersPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
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
            <AdvertiserAuthPage initialMode="login" />
          </AdvertiserPublicOnlyRoute>
        ),
      },
      {
        path: '/register',
        element: (
          <AdvertiserPublicOnlyRoute>
            <AdvertiserAuthPage initialMode="register" />
          </AdvertiserPublicOnlyRoute>
        ),
      },
      {
        element: (
          <AdvertiserProtectedRoute>
            <AdvertiserLayout />
          </AdvertiserProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <AdvertiserOverviewPage /> },
          { path: '/campaigns', element: <AdvertiserCampaignsPage /> },
          { path: '/campaigns/new', element: <AdvertiserCampaignWizardPage /> },
          { path: '/campaigns/:id', element: <AdvertiserCampaignDetailPage /> },
          { path: '/campaigns/:id/edit', element: <AdvertiserCampaignWizardPage /> },
          { path: '/wallet', element: <AdvertiserWalletPage /> },
          { path: '/analytics', element: <AdvertiserAnalyticsPage /> },
          { path: '/profile', element: <AdvertiserProfilePage /> },
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
            <PartnerAuthPage />
          </PartnerPublicOnlyRoute>
        ),
      },
      {
        element: (
          <PartnerProtectedRoute>
            <PartnerLayout />
          </PartnerProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <PartnerOverviewPage /> },
          { path: '/ads', element: <PartnerAdsPage /> },
          { path: '/earnings', element: <PartnerEarningsPage /> },
          { path: '/routers', element: <PartnerRoutersPage /> },
          { path: '/profile', element: <PartnerProfilePage /> },
        ],
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
    { basename: '/partner' }
  )
}
