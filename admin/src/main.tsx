import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { AppProviders } from './app/providers'
import {
  createAdminRouter,
  createAdvertiserRouter,
  createPartnerRouter,
  createPublicRouter,
} from './app/router'
import './styles/globals.css'

const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
const isAdminPortal = pathname === '/admin' || pathname.startsWith('/admin/')
const isAdvertiserPortal = pathname === '/advertiser' || pathname.startsWith('/advertiser/')
const isPartnerPortal = pathname === '/partner' || pathname.startsWith('/partner/')

const activeRouter = isAdminPortal
  ? createAdminRouter()
  : isAdvertiserPortal
    ? createAdvertiserRouter()
    : isPartnerPortal
      ? createPartnerRouter()
      : createPublicRouter()

if (typeof document !== 'undefined') {
  document.title = isAdminPortal
    ? 'AdWave WiFi — Panel Pengelola'
    : isAdvertiserPortal
      ? 'AdWave Partner — Portal Pengiklan'
      : isPartnerPortal
        ? 'AdWave Mitra — Portal Pemilik Lokasi'
        : 'AdWave WiFi — Jaringan Wi-Fi Captive Portal & Iklan Lokal'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={activeRouter} />
    </AppProviders>
  </StrictMode>
)
