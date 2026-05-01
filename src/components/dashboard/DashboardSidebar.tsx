'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { StaffRole } from '@/lib/supabase/custom-types'
import { canAccessSection, type DashboardSection } from '@/lib/auth/rbac-ui'
import LanguageToggle from '@/components/dashboard/LanguageToggle'

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
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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

export default function DashboardSidebar({ userName, userRole }: SidebarProps) {
  const t      = useTranslations('dashboard.nav')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const router = useRouter()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)

  const prefix = locale === 'en' ? '/en' : ''

  const NAV_ITEMS: NavItem[] = [
    { key: 'home',      href: `${prefix}/dashboard`,            icon: <HomeIcon />,      section: 'home' },
    { key: 'orders',    href: `${prefix}/dashboard/orders`,     icon: <OrdersIcon />,    section: 'orders' },
    { key: 'driver',    href: `${prefix}/driver`,                         icon: <DriverIcon />,    section: 'driver' },
    { key: 'delivery',  href: `${prefix}/dashboard/delivery`,            icon: <DeliveryBoardIcon />, section: 'delivery' },
    { key: 'kds',       href: `${prefix}/dashboard/kds`,                 icon: <KDSIcon />,       section: 'kds' },
    { key: 'staff',     href: `${prefix}/dashboard/staff`,      icon: <StaffIcon />,     section: 'staff' },
    { key: 'coupons',   href: `${prefix}/dashboard/coupons`,    icon: <CouponsIcon />,   section: 'coupons' },
    { key: 'analytics', href: `${prefix}/dashboard/analytics`,  icon: <AnalyticsIcon />, section: 'analytics' },
    { key: 'payments',  href: `${prefix}/dashboard/payments`,   icon: <PaymentsIcon />,  section: 'payments' },
    { key: 'reports',   href: `${prefix}/dashboard/reports`,    icon: <ReportsIcon />,   section: 'reports' },
    { key: 'schedule',         href: `${prefix}/dashboard/schedule`,          icon: <ScheduleIcon />,         section: 'schedule' },
    { key: 'inventoryImport',  href: `${prefix}/dashboard/inventory/import`,   icon: <InventoryImportIcon />,  section: 'inventory_import' },
    { key: 'settings',         href: `${prefix}/dashboard/settings`,           icon: <SettingsIcon />,         section: 'settings' },
  ]

  const visible = NAV_ITEMS.filter(
    (item) => !item.section || canAccessSection(userRole, item.section),
  )

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(locale === 'en' ? '/en/login' : '/login')
    router.refresh()
  }

  const navLabels: Record<string, string> = {
    home:            t('home'),
    orders:          t('orders'),
    driver:          t('driver'),
    delivery:        t('delivery'),
    kds:             t('kds'),
    staff:           t('staff'),
    coupons:         t('coupons'),
    analytics:       t('analytics'),
    payments:        t('payments'),
    reports:         t('reports'),
    schedule:        t('schedule'),
    inventoryImport: isAr ? 'استيراد البيانات' : 'Import Data',
    settings:        t('settings'),
  }

  const INVENTORY_SUB_ITEMS = [
    { key: 'inv-overview',   href: `${prefix}/dashboard/inventory`,            label: isAr ? 'نظرة عامة' : 'Overview' },
    { key: 'inv-ingredients',href: `${prefix}/dashboard/inventory/ingredients`,label: isAr ? 'المكونات' : 'Ingredients' },
    { key: 'inv-prep',       href: `${prefix}/dashboard/inventory/prep-items`, label: isAr ? 'Prep Items' : 'Prep Items' },
    { key: 'inv-recipes',    href: `${prefix}/dashboard/inventory/recipes`,    label: isAr ? 'الوصفات' : 'Recipes' },
    { key: 'inv-stock',      href: `${prefix}/dashboard/inventory/stock`,      label: isAr ? 'المخزون' : 'Stock' },
    { key: 'inv-par',        href: `${prefix}/dashboard/inventory/par-levels`, label: isAr ? 'مستويات Par' : 'Par Levels' },
    { key: 'inv-waste',     href: `${prefix}/dashboard/inventory/waste`,     label: isAr ? 'الهدر' : 'Waste' },
    { key: 'inv-count',     href: `${prefix}/dashboard/inventory/count`,     label: isAr ? 'الجرد' : 'Count' },
    { key: 'inv-purchases', href: `${prefix}/dashboard/inventory/purchases`, label: isAr ? 'المشتريات' : 'Purchases' },
    { key: 'inv-transfers', href: `${prefix}/dashboard/inventory/transfers`, label: isAr ? 'التحويلات' : 'Transfers' },
    { key: 'inv-import',     href: `${prefix}/dashboard/inventory/import`,     label: isAr ? 'استيراد' : 'Import' },
  ]

  const isInInventory = pathname.startsWith(`${prefix}/dashboard/inventory`)

  const NavLinks = () => (
    <nav className="flex flex-col gap-1">
      {visible.map((item) => {
        // Skip the inventoryImport item — it lives inside the collapsible group now
        if (item.key === 'inventoryImport') return null
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <a
            key={item.key}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5
              font-satoshi text-sm font-medium transition-colors duration-150
              min-h-[44px]
              ${isActive
                ? 'bg-brand-gold/10 text-brand-gold'
                : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text'
              }`}
          >
            {item.icon}
            {navLabels[item.key] ?? item.key}
          </a>
        )
      })}

      {/* Inventory collapsible group */}
      {canAccessSection(userRole, 'inventory') && (
        <div>
          <button
            type="button"
            onClick={() => setInventoryOpen((v) => !v)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 w-full
              font-satoshi text-sm font-medium transition-colors duration-150
              min-h-[44px]
              ${isInInventory
                ? 'bg-brand-gold/10 text-brand-gold'
                : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text'
              }`}
          >
            <InventoryIcon />
            <span className="flex-1 text-start">{isAr ? 'المخزون' : 'Inventory'}</span>
            <ChevronDownIcon open={inventoryOpen || isInInventory} />
          </button>

          {(inventoryOpen || isInInventory) && (
            <div className="ms-6 mt-0.5 flex flex-col gap-0.5 border-s border-brand-border ps-3">
              {INVENTORY_SUB_ITEMS.map((sub) => {
                const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                return (
                  <a
                    key={sub.key}
                    href={sub.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2 font-satoshi text-sm
                      font-medium transition-colors duration-150 min-h-[40px]
                      ${isSubActive
                        ? 'text-brand-gold bg-brand-gold/10'
                        : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text'
                      }`}
                  >
                    {sub.label}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  )

  const UserInfo = () => (
    <div className="px-3 py-2 border-t border-brand-border">
      <p className="font-satoshi text-sm text-brand-text truncate">
        {userName ?? '—'}
      </p>
      {userRole && (
        <p className="font-satoshi text-xs text-brand-muted capitalize">
          {userRole.replace('_', ' ')}
        </p>
      )}
    </div>
  )

  const LogoutButton = () => (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 w-full
                 font-satoshi text-sm font-medium text-brand-muted
                 hover:bg-brand-surface-2 hover:text-brand-error
                 transition-colors duration-150 min-h-[44px]"
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
        className="lg:hidden fixed top-4 start-4 z-50
                   w-10 h-10 flex items-center justify-center rounded-lg
                   bg-brand-surface border border-brand-border
                   text-brand-text hover:border-brand-gold
                   transition-colors duration-150"
      >
        {open ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-brand-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        dir={isAr ? 'rtl' : 'ltr'}
        className={`fixed top-0 z-40 h-full w-64
                    bg-brand-surface border-e border-brand-border
                    flex flex-col
                    transition-transform duration-300 ease-in-out
                    lg:translate-x-0 lg:static lg:z-auto
                    start-0
                    ${open
                      ? 'translate-x-0'
                      : isAr
                        ? 'translate-x-full'
                        : '-translate-x-full'
                    }`}
      >
        {/* Logo / brand */}
        <div className="h-16 flex items-center px-4 border-b border-brand-border shrink-0">
          <span className="font-cairo text-lg font-black text-brand-gold">
            كهرمانة
          </span>
          <span className="ms-2 font-satoshi text-xs text-brand-muted bg-brand-surface-2 px-2 py-0.5 rounded-lg">
            Dashboard
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks />
        </div>

        {/* Footer: user info + language toggle + logout */}
        <div className="shrink-0 pb-2 px-0">
          <UserInfo />
          <div className="px-3 pt-1 flex flex-col gap-0.5">
            <LanguageToggle />
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  )
}
