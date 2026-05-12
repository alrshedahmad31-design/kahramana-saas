'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { StaffRole } from '@/lib/supabase/custom-types'
import { canAccessSection, type DashboardSection } from '@/lib/auth/rbac-ui'
import LanguageToggle from '@/components/dashboard/LanguageToggle'

const cn = (...classes: (string | undefined | boolean)[]) => 
  classes.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

interface NavItem {
  key: string
  href: string
  icon: React.ReactNode
  section?: DashboardSection
}

function OrdersIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function OwnerIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l4 4 5-7 5 7 4-4-2 13H5L3 7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20h10" />
    </svg>
  )
}

function StaffIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function DriverIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  )
}

function KDSIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-4M9 3a3 3 0 006 0M9 3h6M12 12h.01M8 12h.01M16 12h.01M12 16h.01M8 16h.01M16 16h.01" />
    </svg>
  )
}

function DeliveryBoardIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 00-2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CouponsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function PaymentsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 10h22" />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function InventoryImportIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}

function AuditIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function POSIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1.5 11a1 1 0 01-1 1.13H4.5a1 1 0 01-1-1.13L5 9z" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
    </svg>
  )
}

function ReservationsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  )
}

function ShiftIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface SidebarProps {
  userName: string | null
  userRole: StaffRole | null
}

type NavGroup = 'operations' | 'customers' | 'finance' | 'admin'

const GROUP_OF: Record<string, NavGroup> = {
  home: 'operations', owner: 'operations', orders: 'operations', pos: 'operations',
  kds: 'operations', tables: 'operations', waiter: 'operations', driver: 'operations',
  delivery: 'operations',
  waitlist: 'customers', reservations: 'customers', coupons: 'customers', promotions: 'customers',
  payments: 'finance', shifts: 'finance', analytics: 'finance', reports: 'finance', audit: 'finance',
  staff: 'admin', menu: 'admin', schedule: 'admin', inventory: 'admin', settings: 'admin',
}

const getNavItems = (prefix: string): NavItem[] => [
  // GROUP 1 — Daily Operations
  { key: 'home',      href: `${prefix}/dashboard`,            icon: <HomeIcon />,      section: 'home' },
  { key: 'owner',     href: `${prefix}/dashboard/owner`,      icon: <OwnerIcon />,     section: 'owner' },
  { key: 'orders',    href: `${prefix}/dashboard/orders`,     icon: <OrdersIcon />,    section: 'orders' },
  { key: 'pos',       href: `${prefix}/dashboard/pos`,        icon: <POSIcon />,       section: 'pos' },
  { key: 'kds',       href: `${prefix}/dashboard/kds`,        icon: <KDSIcon />,       section: 'kds' },
  { key: 'tables',    href: `${prefix}/dashboard/tables`,     icon: <POSIcon />,       section: 'tables' },
  { key: 'waiter',    href: `${prefix}/waiter`,               icon: <POSIcon />,       section: 'waiter' },
  { key: 'driver',    href: `${prefix}/driver`,               icon: <DriverIcon />,    section: 'driver' },
  { key: 'delivery',  href: `${prefix}/dashboard/delivery`,   icon: <DeliveryBoardIcon />, section: 'delivery' },

  // GROUP 2 — Customer Management
  { key: 'waitlist',  href: `${prefix}/dashboard/waitlist`,    icon: <StaffIcon />,     section: 'waitlist' },
  { key: 'reservations', href: `${prefix}/dashboard/reservations`, icon: <ReservationsIcon />, section: 'reservations' },
  { key: 'coupons',   href: `${prefix}/dashboard/coupons`,    icon: <CouponsIcon />,   section: 'coupons' },
  { key: 'promotions', href: `${prefix}/dashboard/promotions`, icon: <CouponsIcon />,   section: 'promotions' },

  // GROUP 3 — Finance & Reports
  { key: 'payments',  href: `${prefix}/dashboard/payments`,   icon: <PaymentsIcon />,  section: 'payments' },
  { key: 'shifts',    href: `${prefix}/dashboard/shifts`,     icon: <ShiftIcon />,     section: 'shifts' },
  { key: 'analytics', href: `${prefix}/dashboard/analytics`,  icon: <AnalyticsIcon />, section: 'analytics' },
  { key: 'reports',   href: `${prefix}/dashboard/reports`,    icon: <ReportsIcon />,   section: 'reports' },
  { key: 'audit',     href: `${prefix}/dashboard/audit`,      icon: <AuditIcon />,     section: 'audit' },

  // GROUP 4 — Administration
  { key: 'staff',     href: `${prefix}/dashboard/staff`,      icon: <StaffIcon />,     section: 'staff' },
  { key: 'menu',      href: `${prefix}/dashboard/menu`,       icon: <MenuIcon />,      section: 'menu' },
  { key: 'schedule',  href: `${prefix}/dashboard/schedule`,    icon: <ScheduleIcon />,  section: 'schedule' },
  { key: 'inventory', href: `${prefix}/dashboard/inventory`,   icon: <InventoryIcon />, section: 'inventory' },
  { key: 'settings',  href: `${prefix}/dashboard/settings`,    icon: <SettingsIcon />,  section: 'settings' },
]

export default function DashboardSidebar({ userName, userRole }: SidebarProps) {
  const t      = useTranslations('dashboard.nav')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const router = useRouter()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const prefix = locale === 'en' ? '/en' : ''
  const navItems = getNavItems(prefix)

  const visible = navItems.filter(
    (item) => !item.section || canAccessSection(userRole, item.section),
  )

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(locale === 'en' ? '/en/login' : '/login')
    router.refresh()
  }

  const groupLabels: Record<NavGroup, string> = {
    operations: t('groups.operations'),
    customers:  t('groups.customers'),
    finance:    t('groups.finance'),
    admin:      t('groups.admin'),
  }

  const navLabels: Record<string, string> = {
    home:            t('home'),
    owner:           t('owner'),
    orders:          t('orders'),
    pos:             t('pos'),
    waiter:          t('waiter'),
    waitlist:        t('waitlist'),
    reservations:    t('reservations'),
    tables:          t('tables'),
    driver:          t('driver'),
    delivery:        t('delivery'),
    kds:             t('kds'),
    staff:           t('staff'),
    coupons:         t('coupons'),
    promotions:      t('promotions'),
    analytics:       t('analytics'),
    payments:        t('payments'),
    reports:         t('reports'),
    schedule:        t('schedule'),
    inventory:       t('inventory'),
    menu:            t('menu'),
    shifts:          t('shifts'),
    audit:           t('audit'),
    settings:        t('settings'),
  }

  const INVENTORY_SUB_ITEMS = [
    { key: 'inv-overview',   href: `${prefix}/dashboard/inventory`,            label: isAr ? 'نظرة عامة' : 'Overview' },
    { key: 'inv-reports',    href: `${prefix}/dashboard/inventory/reports`,    label: isAr ? 'التقارير' : 'Reports' },
    { key: 'inv-ingredients',href: `${prefix}/dashboard/inventory/ingredients`,label: isAr ? 'المكونات' : 'Ingredients' },
    { key: 'inv-prep',       href: `${prefix}/dashboard/inventory/prep-items`, label: isAr ? 'الأصناف الجاهزة' : 'Prep Items' },
    { key: 'inv-recipes',    href: `${prefix}/dashboard/inventory/recipes`,    label: isAr ? 'الوصفات' : 'Recipes' },
    { key: 'inv-stock',      href: `${prefix}/dashboard/inventory/stock`,      label: isAr ? 'المخزون' : 'Stock' },
    { key: 'inv-par',        href: `${prefix}/dashboard/inventory/par-levels`, label: isAr ? 'مستويات المخزون' : 'Par Levels' },
    { key: 'inv-waste',     href: `${prefix}/dashboard/inventory/waste`,     label: isAr ? 'الهدر' : 'Waste' },
    { key: 'inv-count',     href: `${prefix}/dashboard/inventory/count`,     label: isAr ? 'الجرد' : 'Count' },
    { key: 'inv-purchases', href: `${prefix}/dashboard/inventory/purchases`, label: isAr ? 'المشتريات' : 'Purchases' },
    { key: 'inv-transfers', href: `${prefix}/dashboard/inventory/transfers`, label: isAr ? 'التحويلات' : 'Transfers' },
    { key: 'inv-catering',  href: `${prefix}/dashboard/inventory/catering`,   label: isAr ? 'التقديم الخارجي' : 'Catering' },
    { key: 'inv-budget',    href: `${prefix}/dashboard/inventory/budget`,     label: isAr ? 'الميزانية' : 'Budget' },
    { key: 'inv-import',     href: `${prefix}/dashboard/inventory/import`,     label: isAr ? 'استيراد' : 'Import' },
  ]

  const isInInventory = pathname.startsWith(`${prefix}/dashboard/inventory`)

  const UserInfo = () => (
    <div className={cn('px-3 py-2 border-t border-brand-border')}>
      <p className={cn('font-satoshi text-sm text-brand-text truncate')}>
        {userName || '-'}
      </p>
      {userRole && (
        <p className={cn('font-satoshi text-xs text-brand-muted capitalize')}>
          {userRole.replace('_', ' ')}
        </p>
      )}
    </div>
  )

  const LogoutButton = () => (
    <button
      type="button"
      onClick={handleLogout}
      className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 w-full font-satoshi text-sm font-medium text-brand-muted hover:bg-brand-surface-2 hover:text-brand-error transition-colors duration-150 min-h-[44px]')}
    >
      <LogoutIcon />
      {t('logout')}
    </button>
  )

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className={cn(
          'lg:hidden fixed top-4 start-4 z-50 w-10 h-10 flex items-center justify-center rounded-lg bg-brand-surface border border-brand-border text-brand-text hover:border-brand-gold transition-colors duration-150'
        )}
      >
        {open ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className={cn('lg:hidden fixed inset-0 z-40 bg-brand-black/60 backdrop-blur-sm')}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        dir={isAr ? 'rtl' : 'ltr'}
        className={cn(
          'fixed top-0 z-40 h-full w-64 bg-brand-surface border-e border-brand-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto start-0',
          open ? 'translate-x-0' : (isAr ? 'translate-x-full' : '-translate-x-full')
        )}
      >
        {/* Logo / brand */}
        <div className={cn('h-16 flex items-center px-4 border-b border-brand-border shrink-0')}>
          <span className={cn('font-cairo text-lg font-black text-brand-gold')}>
            كهرمانة
          </span>
          <span className={cn('ms-2 font-satoshi text-xs text-brand-muted bg-brand-surface-2 px-2 py-0.5 rounded-lg')}>
            Dashboard
          </span>
        </div>

        {/* Nav */}
        <div className={cn('flex-1 overflow-y-auto px-3 py-4')}>
          <nav className={cn('flex flex-col gap-1')}>
            {(() => {
              const nodes: React.ReactNode[] = []
              let prevGroup: NavGroup | null = null

              visible.forEach((item) => {
                const group = GROUP_OF[item.key] ?? null
                if (group && group !== prevGroup) {
                  if (prevGroup !== null) {
                    nodes.push(
                      <div
                        key={`div-${group}`}
                        className="my-3 border-t border-brand-border/50"
                      />,
                    )
                  }
                  nodes.push(
                    <p
                      key={`grp-${group}`}
                      className="px-3 mt-4 mb-1 font-satoshi text-[10px] uppercase tracking-widest text-brand-muted/50"
                    >
                      {groupLabels[group]}
                    </p>,
                  )
                  prevGroup = group
                }

                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const isInventory = item.key === 'inventory'

                nodes.push(
                  <div key={item.key} className="flex flex-col gap-1">
                    {isInventory ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setInventoryOpen((v) => !v)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 w-full font-satoshi text-sm font-medium transition-colors duration-150 min-h-[44px]',
                            isInInventory ? 'bg-brand-gold/10 text-brand-gold' : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text'
                          )}
                        >
                          <InventoryIcon />
                          <span className="flex-1 text-start">{isAr ? 'المخزون' : 'Inventory'}</span>
                          <ChevronDownIcon open={inventoryOpen || isInInventory} />
                        </button>

                        {(inventoryOpen || isInInventory) && (
                          <div className={cn('ms-6 mt-0.5 flex flex-col gap-0.5 border-s border-brand-border ps-3')}>
                            {INVENTORY_SUB_ITEMS.map((sub) => {
                              const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                              return (
                                <a
                                  key={sub.key}
                                  href={sub.href}
                                  onClick={() => setOpen(false)}
                                  className={cn(
                                    'flex items-center rounded-lg px-3 py-2 font-satoshi text-sm font-medium transition-colors duration-150 min-h-[40px]',
                                    isSubActive ? 'text-brand-gold bg-brand-gold/10' : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text'
                                  )}
                                >
                                  {sub.label}
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <a
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 font-satoshi text-sm font-medium transition-colors duration-150 min-h-[44px]',
                          isActive ? 'bg-brand-gold/10 text-brand-gold' : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text'
                        )}
                      >
                        {item.icon}
                        {navLabels[item.key] ?? item.key}
                      </a>
                    )}
                  </div>,
                )
              })

              return nodes
            })()}
          </nav>
        </div>

        {/* Footer: user info + language toggle + logout */}
        <div className={cn('shrink-0 pb-2 px-0')}>
          {mounted && <UserInfo />}
          <div className={cn('px-3 pt-1 flex flex-col gap-0.5')}>
            <LanguageToggle />
            {mounted && <LogoutButton />}
          </div>
        </div>
      </aside>
    </>
  )
}
