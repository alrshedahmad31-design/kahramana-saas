import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { getDashboardData }   from '@/lib/dashboard/stats'
import HeroMetrics            from '@/components/dashboard/HeroMetrics'
import TodayRevenueChart      from '@/components/dashboard/TodayRevenueChart'
import LiveOrdersPanel        from '@/components/dashboard/LiveOrdersPanel'
import TopSellingItems        from '@/components/dashboard/TopSellingItems'
import QuickActionsPanel      from '@/components/dashboard/QuickActionsPanel'
import ActivityFeed           from '@/components/dashboard/ActivityFeed'
import TodaySummary           from '@/components/dashboard/TodaySummary'
import AnalyticsRefresher     from '@/components/analytics/AnalyticsRefresher'

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

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-5">
      {/* Auto-refresh every 10 s — re-runs this server component */}
      <AnalyticsRefresher />

      {/* ── Hero: 4 metric cards ──────────────────────────────────────────────── */}
      <HeroMetrics data={data} currency={currency} prefix={prefix} isRTL={isAr} />

      {/* ── 3-column main layout ──────────────────────────────────────────────── */}
      {/*   Left 25%: Quick Actions                                               */}
      {/*   Mid  45%: Live Orders + Top Sellers                                   */}
      {/*   Right 30%: Revenue Chart + Activity Feed                              */}
      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_272px] gap-5">

        {/* ── Column 1: Quick Actions ─────────────────────────────────────────── */}
        <QuickActionsPanel prefix={prefix} isRTL={isAr} />

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
    </div>
  )
}
