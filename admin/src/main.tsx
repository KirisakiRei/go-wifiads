import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { AppProviders } from './app/providers'
import { createAdminRouter, createAdvertiserRouter, createPartnerRouter } from './app/router'
import './styles/globals.css'

const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
const isAdvertiserPortal = pathname === '/advertiser' || pathname.startsWith('/advertiser/')
const isPartnerPortal = pathname === '/partner' || pathname.startsWith('/partner/')

const activeRouter = isAdvertiserPortal
  ? createAdvertiserRouter()
  : isPartnerPortal
    ? createPartnerRouter()
    : createAdminRouter()

if (typeof document !== 'undefined') {
  document.title = isAdvertiserPortal
    ? 'AdWave Partner — Portal Pengiklan'
    : isPartnerPortal
      ? 'AdWave Mitra — Portal Pemilik Lokasi'
      : 'AdWave WiFi — Panel Pengelola'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={activeRouter} />
    </AppProviders>
  </StrictMode>
)
