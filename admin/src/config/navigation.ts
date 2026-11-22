import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowUpRight,
  Building2,
  ClipboardList,
  Gauge,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Router,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sliders,
  Store,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react'

export type NavBadgeKey = 'pending_campaigns' | 'waiting_topups' | 'pending_withdrawals'

export interface NavLeafItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  badgeKey?: NavBadgeKey
}

export interface NavGroupItem {
  key: string
  label: string
  icon: LucideIcon
  children: NavLeafItem[]
}

export interface NavSection {
  title: string
  items: (NavLeafItem | NavGroupItem)[]
}

export function isNavGroup(item: NavLeafItem | NavGroupItem): item is NavGroupItem {
  return 'children' in item
}

export const navigationSections: NavSection[] = [
  {
    title: 'Utama & Jaringan',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Router', to: '/routers', icon: Router },
      { label: 'Sesi Aktif', to: '/sessions', icon: Activity },
      { label: 'Profil Paket', to: '/profiles', icon: Gauge },
      { label: 'Voucher', to: '/vouchers', icon: Ticket },
      { label: 'Pengunjung', to: '/visitors', icon: Users },
    ],
  },
  {
    title: 'Bisnis & Kemitraan',
    items: [
      {
        key: 'advertisers',
        label: 'Pengiklan',
        icon: Building2,
        children: [
          { label: 'Daftar Pengiklan', to: '/advertisers', icon: Building2, end: true },
          {
            label: 'Iklan Klien',
            to: '/advertisers/campaigns',
            icon: Megaphone,
            badgeKey: 'pending_campaigns',
          },
          {
            label: 'Top-Up Pengiklan',
            to: '/advertisers/topups',
            icon: Wallet,
            badgeKey: 'waiting_topups',
          },
        ],
      },
      {
        key: 'partners',
        label: 'Mitra Lokasi',
        icon: Store,
        children: [
          { label: 'Daftar Mitra', to: '/partners', icon: Store, end: true },
          {
            label: 'Pencairan Bagi Hasil',
            to: '/partners/withdrawals',
            icon: ArrowUpRight,
            badgeKey: 'pending_withdrawals',
          },
        ],
      },
      {
        key: 'finance',
        label: 'Keuangan & Tarif',
        icon: Landmark,
        children: [
          { label: 'Laporan Keuangan', to: '/finance', icon: Landmark },
          { label: 'Tarif, Rank & Rekening', to: '/ad-settings', icon: Sliders },
        ],
      },
    ],
  },
  {
    title: 'Konten & Sistem',
    items: [
      { label: 'Iklan Default', to: '/advertisements', icon: Megaphone },
      { label: 'Kuesioner', to: '/questionnaire', icon: ClipboardList },
      { label: 'Log Sistem', to: '/logs', icon: ScrollText },
      { label: 'Pengaturan Portal', to: '/settings', icon: Settings2 },
      { label: 'Pengguna & Akses', to: '/users', icon: ShieldCheck },
    ],
  },
]

export const allNavLeafItems: NavLeafItem[] = navigationSections.flatMap((sec) =>
  sec.items.flatMap((it) => (isNavGroup(it) ? it.children : [it]))
)
