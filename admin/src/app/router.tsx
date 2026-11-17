import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { AdvertisementFormPage } from '@/features/advertisements/pages/advertisement-form-page'
import { AdvertisementsPage } from '@/features/advertisements/pages/advertisements-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { ProfilesPage } from '@/features/profiles/pages/profiles-page'
import { SessionsPage } from '@/features/sessions/pages/sessions-page'
import { UsersPage } from '@/features/users/pages/users-page'
import { VisitorsPage } from '@/features/visitors/pages/visitors-page'
import { VouchersPage } from '@/features/vouchers/pages/vouchers-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { ProtectedRoute } from '@/routes/protected-route'
import { PublicOnlyRoute } from '@/routes/public-only-route'

export const router = createBrowserRouter([
  { path: '/login', element: <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> },
  { element: <ProtectedRoute><AppLayout /></ProtectedRoute>, children: [
    { index: true, element: <Navigate to="/dashboard" replace /> },
    { path: '/dashboard', element: <DashboardPage /> },
    { path: '/profiles', element: <ProfilesPage /> },
    { path: '/advertisements', element: <AdvertisementsPage /> },
    { path: '/advertisements/new', element: <AdvertisementFormPage /> },
    { path: '/advertisements/:id/edit', element: <AdvertisementFormPage /> },
    { path: '/vouchers', element: <VouchersPage /> },
    { path: '/visitors', element: <VisitorsPage /> },
    { path: '/sessions', element: <SessionsPage /> },
    { path: '/users', element: <UsersPage /> },
  ] },
  { path: '*', element: <NotFoundPage /> },
], { basename: '/admin' })
