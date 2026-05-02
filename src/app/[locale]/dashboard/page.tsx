import { Suspense }          from 'react'
import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { getDashboardData }   from '@/lib/dashboard/stats'
import { canAccessSection }   from '@/lib/auth/rbac-ui'
import HeroMetrics            from '@/components/dashboard/HeroMetrics'
import TodayRevenueChart      from '@/components/dashboard/TodayRevenueChart'
import LiveOrdersPanel        from '@/components/dashboard/LiveOrdersPanel'
import TopSellingItems        from '@/components/dashboard/TopSellingItems'
import QuickActionsPanel      from '@/components/dashboard/QuickActionsPanel'
import ActivityFeed           from '@/components/dashboard/ActivityFeed'
import TodaySummary           from '@/components/dashboard/TodaySummary'
import AnalyticsRefresher     from '@/components/analytics/AnalyticsRefresher'
import InventoryWidgetsSection from '@/components/inventory/InventoryWidgetsSection'
import InventoryWidgetsSkeleton from '@/components/inventory/InventoryWidgetsSkeleton'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ locale: string }> }

export default async function DashboardHomePage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  const isAr    = locale === 'ar'
  const prefix  = locale === 'en' ? '/en' : ''
  const currency = isAr ? 'د.ب' : 'BD'

  const data = await getDashboardData(user.branch_id ?? null)

  const isGlobal       = user.role === 'owner' || user.role === 'general_manager'
  const showInventory  = canAccessSection(user.role, 'inventory')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-5">
      {/* Auto-refresh every 10 s — re-runs this server component */}
      <AnalyticsRefresher />

      {/* ── Hero: 4 metric cards ──────────────────────────────────────────────── */}
      <HeroMetrics data={data} currency={currency} prefix={prefix} isRTL={isAr} />

      {/* ── 3-column main layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_272px] gap-5">

        {/* ── Column 1: Quick Actions ─────────────────────────────────────────── */}
        <QuickActionsPanel prefix={prefix} isRTL={isAr} userRole={user.role} />

        {/* ── Column 2: Live Orders + Top Sellers ─────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <LiveOrdersPanel
            counts={data.activeOrders}
            avgPrepMins={data.avgPrepMins}
            prefix={prefix}
            isRTL={isAr}
          />
          <TopSellingItems items={data.topItems} isRTL={isAr} />
        </div>

        {/* ── Column 3: Revenue Chart + Activity Feed ──────────────────────────── */}
        <div className="flex flex-col gap-5">
          <TodayRevenueChart hourlyPoints={data.hourlyPoints} currency={currency} isRTL={isAr} />
          <ActivityFeed orders={data.recentActivity} isRTL={isAr} />
        </div>
      </div>

      {/* ── Summary banner ────────────────────────────────────────────────────── */}
      <TodaySummary data={data} currency={currency} isRTL={isAr} />

      {/* ── Inventory section — owner/GM/BM/inventory_manager only ────────────── */}
      {showInventory && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider">
              {isAr ? 'المخزون والموارد' : 'Inventory & Resources'}
            </h2>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          <Suspense fallback={<InventoryWidgetsSkeleton />}>
            <InventoryWidgetsSection
              branchId={isGlobal ? null : (user.branch_id ?? null)}
              isGlobal={isGlobal}
              prefix={prefix}
              isAr={isAr}
              currency={currency}
            />
          </Suspense>
        </section>
      )}
    </div>
  )
}
