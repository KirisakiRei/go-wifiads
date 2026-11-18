import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { env } from '@/config/env'

if (typeof window !== 'undefined') {
  ;(window as unknown as { L: typeof L }).L = L
}

export function createBaseTileLayer(): L.TileLayer {
  return L.tileLayer(`${env.apiBaseUrl}/map-tiles/{z}/{x}/{y}.png`, {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })
}

export default L
