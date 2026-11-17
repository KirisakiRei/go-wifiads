import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Gauge,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export const navigation: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Profil Paket', to: '/profiles', icon: Gauge },
  { label: 'Iklan Sponsor', to: '/advertisements', icon: Megaphone },
  { label: 'Manajemen Voucher', to: '/vouchers', icon: Ticket },
  { label: 'Pengunjung & Leads', to: '/visitors', icon: Users },
  { label: 'Sesi RADIUS', to: '/sessions', icon: Activity },
  { label: 'Pengguna Admin', to: '/users', icon: ShieldCheck },
]
