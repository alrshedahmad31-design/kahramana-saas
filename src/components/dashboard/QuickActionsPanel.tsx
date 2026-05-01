import Link from 'next/link'
import {
  canAccessAnalytics,
  canManageCoupons,
  canAccessStaffPage,
  canManageSchedule,
  canAccessReports,
  canAccessKDS,
} from '@/lib/auth/rbac'
import type { StaffRole } from '@/lib/supabase/custom-types'
import type { AuthUser } from '@/lib/auth/session'

interface Props {
  prefix:   string
  isRTL:    boolean
  userRole: StaffRole | null
}

interface Action {
  labelEn: string
  labelAr: string
  href:    string
  icon:    React.ReactNode
  accent?: boolean
}

function stubUser(role: StaffRole | null): AuthUser {
  return { id: '', email: '', role, branch_id: null, name: null }
}

export default function QuickActionsPanel({ prefix, isRTL, userRole }: Props) {
  const u = stubUser(userRole)

  const allActions: (Action & { show: boolean })[] = [
    {
      labelEn: 'View Orders',
      labelAr: 'الطلبات',
      href:    `${prefix}/dashboard/orders`,
      icon:    <OrdersIcon />,
      accent:  true,
      show:    true, // every dashboard user can view orders
    },
    {
      labelEn: 'Kitchen Display',
      labelAr: 'شاشة المطبخ',
      href:    `${prefix}/dashboard/kds`,
      icon:    <KDSIcon />,
      show:    canAccessKDS(u),
    },
    {
      labelEn: 'Analytics',
      labelAr: 'التحليلات',
      href:    `${prefix}/dashboard/analytics`,
      icon:    <AnalyticsIcon />,
      show:    canAccessAnalytics(u),
    },
    {
      labelEn: 'Coupons',
      labelAr: 'الكوبونات',
      href:    `${prefix}/dashboard/coupons`,
      icon:    <CouponIcon />,
      show:    canManageCoupons(u),
    },
    {
      labelEn: 'Staff',
      labelAr: 'الموظفون',
      href:    `${prefix}/dashboard/staff`,
      icon:    <StaffIcon />,
      show:    canAccessStaffPage(u),
    },
    {
      labelEn: 'Schedule',
      labelAr: 'الجدول',
      href:    `${prefix}/dashboard/schedule`,
      icon:    <ScheduleIcon />,
      show:    canManageSchedule(u),
    },
    {
      labelEn: 'Reports',
      labelAr: 'التقارير',
      href:    `${prefix}/dashboard/reports`,
      icon:    <ReportsIcon />,
      show:    canAccessReports(u),
    },
  ]

  const actions = allActions.filter((a) => a.show)

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <h2 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider mb-4 ${isRTL ? 'font-almarai' : ''}`}>
        {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
      </h2>

      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`
              flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px]
              font-satoshi text-sm font-medium transition-all duration-150
              border
              ${a.accent
                ? 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold hover:bg-brand-gold/20 hover:border-brand-gold/50'
                : 'bg-brand-surface-2 border-brand-border text-brand-muted hover:bg-brand-surface-2/80 hover:text-brand-text hover:border-brand-gold/20'
              }
            `}
          >
            <span className={a.accent ? 'text-brand-gold' : 'text-brand-muted'}>{a.icon}</span>
            <span className={isRTL ? 'font-almarai' : ''}>
              {isRTL ? a.labelAr : a.labelEn}
            </span>
            <span className="ms-auto text-brand-muted/40 text-xs">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function OrdersIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function KDSIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-4M9 3a3 3 0 006 0M9 3h6" />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function CouponIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M3 7v4a1 1 0 001 1h3m-4-5h4m10-1v4m0-4h-4m4 0a1 1 0 011 1v3m-5 5h4m-4 0a1 1 0 01-1 1v3M3 17v2a1 1 0 001 1h3m-4-3h4" />
    </svg>
  )
}

function StaffIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
