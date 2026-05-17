import { Suspense }          from 'react'
import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { getDashboardData }   from '@/lib/dashboard/stats'
import { captureAnalyticsError } from '@/lib/analytics/result-helpers'
import { canAccessSection }   from '@/lib/auth/rbac-ui'
import HeroMetrics            from '@/components/dashboard/HeroMetrics'
import TodayRevenueChart      from '@/components/dashboard/TodayRevenueChart'
import LiveOrdersPanel        from '@/components/dashboard/LiveOrdersPanel'
import TopSellingItems        from '@/components/dashboard/TopSellingItems'
import QuickActionsPanel      from '@/components/dashboard/QuickActionsPanel'
import ActivityFeed           from '@/components/dashboard/ActivityFeed'
import TodaySummary           from '@/components/dashboard/TodaySummary'
import AnalyticsRefresher     from '@/components/analytics/AnalyticsRefresher'
import { AnalyticsErrorState } from '@/components/analytics/AnalyticsErrorState'
import InventoryWidgetsSection from '@/components/inventory/InventoryWidgetsSection'
import InventoryWidgetsSkeleton from '@/components/inventory/InventoryWidgetsSkeleton'
import OnboardingAlerts        from '@/components/dashboard/OnboardingAlerts'
import OperationsAlertsBanner  from '@/components/dashboard/OperationsAlertsBanner'
import { getTranslations } from 'next-intl/server'
import { createClient }        from '@/lib/supabase/server'
import { isHiddenBranch }    from '@/constants/contact'
import type { OperationsAlertRow } from '@/lib/supabase/custom-types'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ locale: string }> }

export default async function DashboardHomePage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()
  if (!user) redirect(`/${locale}/login`)

  const t = await getTranslations('common')
  const isAr    = locale === 'ar'
  const prefix  = locale === 'en' ? '/en' : ''
  const currency = t('currency')

  const isGlobal       = user.role === 'owner' || user.role === 'general_manager'

  // Fail-closed: a scoped role with NULL branch_id would otherwise pass null
  // to getDashboardData and receive all-branch metrics (the global view).
  if (!isGlobal && !user.branch_id) {
    throw new Error('Forbidden: account requires a branch assignment')
  }

  const dashboardResult = await getDashboardData(user.branch_id ?? null)
  if (!dashboardResult.ok) {
    captureAnalyticsError(dashboardResult.error)
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-5">
        <AnalyticsErrorState functionName={dashboardResult.error.function} />
      </div>
    )
  }
  const data = dashboardResult.data

  const showInventory  = canAccessSection(user.role, 'inventory')

  const supabase = await createClient()
  const { data: branchesRaw } = await supabase
    .from('branches')
    .select('id, name_ar, name_en')
    .eq('is_active', true)
  
  const branches = (branchesRaw ?? []).filter(b => !isHiddenBranch(b.id))

  const canSeeOperationsAlerts =
    user.role === 'owner' || user.role === 'general_manager' || user.role === 'branch_manager'

  let operationsAlerts: OperationsAlertRow[] = []
  if (canSeeOperationsAlerts) {
    try {
      let alertsQuery = supabase
        .from('operations_alerts')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5)

      // Branch managers must only see alerts for their own branch — RLS
      // covers most reads but operations_alerts is global-readable for
      // managers, so the scope filter has to be applied here.
      if (user.role === 'branch_manager' && user.branch_id) {
        alertsQuery = alertsQuery.eq('branch_id', user.branch_id)
      }

      const { data: alertsData, error: alertsError } = await alertsQuery
      if (alertsError) {
        captureAnalyticsError({
          code:      'OPS_ALERTS_QUERY_FAILED',
          message:   alertsError.message,
          function:  'dashboard_home_operations_alerts',
          timestamp: new Date().toISOString(),
        })
      }
      operationsAlerts = alertsData ?? []
    } catch (err) {
      captureAnalyticsError({
        code:      'OPS_ALERTS_QUERY_THREW',
        message:   err instanceof Error ? err.message : String(err),
        function:  'dashboard_home_operations_alerts',
        timestamp: new Date().toISOString(),
      })
      operationsAlerts = []
    }
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-5">
      {/* Auto-refresh every 10 s — re-runs this server component */}
      <AnalyticsRefresher />

      {/* ── Operations Alerts (stuck orders, ops signals) — managers only ─── */}
      {canSeeOperationsAlerts && operationsAlerts.length > 0 && (
        <OperationsAlertsBanner alerts={operationsAlerts} locale={locale} />
      )}

      {/* ── Onboarding Checks ─────────────────────────────────────────────────── */}
      <OnboardingAlerts branches={branches ?? []} locale={locale} />

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
