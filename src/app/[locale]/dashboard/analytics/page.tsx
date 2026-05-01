import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { canAccessAnalytics } from '@/lib/auth/rbac'
import {
  buildDateRange, buildPrevRange,
  formatCurrency, calculateGrowth,
  fillDailyGaps,
} from '@/lib/analytics/calculations'
import {
  getMetrics, getDailySales, getTopItems,
  getHourlyDistribution, getBranchSummaries,
  getSecondaryMetrics,
} from '@/lib/analytics/queries'
import { generateInsights } from '@/lib/analytics/insights'

import DateRangePicker       from '@/components/analytics/DateRangePicker'
import MetricCard            from '@/components/analytics/MetricCard'
import RevenueChart          from '@/components/analytics/RevenueChart'
import TopItemsChart         from '@/components/analytics/TopItemsChart'
import HourlyHeatmap         from '@/components/analytics/HourlyHeatmap'
import BranchComparisonTable from '@/components/analytics/BranchComparisonTable'
import AnalyticsRefresher    from '@/components/analytics/AnalyticsRefresher'
import AnalyticsSubNav       from '@/components/analytics/AnalyticsSubNav'
import AutomatedInsights     from '@/components/analytics/AutomatedInsights'

interface SearchParams {
  range?:  string
  branch?: string
  from?:   string
  to?:     string
}

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessAnalytics(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const range        = buildDateRange(sp.range ?? '7d', sp.from, sp.to)
  const prev         = buildPrevRange(range)
  // Only owner/GM may switch branches via URL param; branch_manager is always locked to their own branch
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const branchId      = isGlobalAdmin && sp.branch ? sp.branch : (user.branch_id ?? undefined)

  const [metrics, dailySales, topItems, hourly, branches, secondary] = await Promise.all([
    getMetrics(range.from, range.to, prev.from, prev.to, branchId),
    getDailySales(range.from, range.to, branchId),
    getTopItems(range.from, range.to, 10, branchId),
    getHourlyDistribution(),
    getBranchSummaries(range.from, range.to),
    getSecondaryMetrics(range.from, range.to, branchId),
  ])

  const filledSales = fillDailyGaps(dailySales, range.from, range.to, {
    branch_id: branchId ?? 'all',
    order_count: 0,
    total_revenue_bhd: 0,
    avg_order_value_bhd: 0,
  })

  const currency = isAr ? 'د.ب' : 'BD'

  const revenueGrowth = calculateGrowth(metrics.totalRevenue,    metrics.prevTotalRevenue)
  const ordersGrowth  = calculateGrowth(metrics.orderCount,      metrics.prevOrderCount)
  const aovGrowth     = calculateGrowth(metrics.avgOrderValue,   metrics.prevAvgOrderValue)
  const custGrowth    = calculateGrowth(metrics.uniqueCustomers, metrics.prevUniqueCustomers)

  const peakHour = hourly.length
    ? hourly.reduce((peak, r) => r.order_count > peak.order_count ? r : peak).hour_of_day
    : null

  const topItem = topItems[0] ?? null
  const insights = generateInsights(
    metrics,
    topItem?.name_en ?? null,
    topItem?.name_ar ?? null,
    peakHour,
  )

  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000))
  const avgDailyRevenue = metrics.totalRevenue / days

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <AnalyticsRefresher />

      {/* Sub-navigation */}
      <AnalyticsSubNav locale={locale} />

      {/* Header + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'التحليلات' : 'Analytics'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'نظرة عامة على أداء الأعمال' : 'Business performance overview'}
          </p>
        </div>
        <DateRangePicker currentRange={range.label} locale={locale} />
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'الإيرادات الإجمالية' : 'Total Revenue'}
          value={formatCurrency(metrics.totalRevenue)}
          unit={currency}
          change={revenueGrowth}
        />
        <MetricCard
          title={isAr ? 'إجمالي الطلبات' : 'Total Orders'}
          value={String(metrics.orderCount)}
          change={ordersGrowth}
        />
        <MetricCard
          title={isAr ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
          value={formatCurrency(metrics.avgOrderValue)}
          unit={currency}
          change={aovGrowth}
        />
        <MetricCard
          title={isAr ? 'العملاء المعروفون' : 'Identifiable Customers'}
          value={String(metrics.uniqueCustomers)}
          change={custGrowth}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'أصناف مُباعة' : 'Items Sold'}
          value={secondary.totalItemsSold.toLocaleString()}
        />
        <MetricCard
          title={isAr ? 'عملاء جدد' : 'New Customers'}
          value={String(secondary.newCustomersInPeriod)}
        />
        <MetricCard
          title={isAr ? 'معدل التكرار' : 'Repeat Rate'}
          value={`${secondary.repeatRate.toFixed(1)}%`}
        />
        <MetricCard
          title={isAr ? 'متوسط الإيراد اليومي' : 'Avg Daily Revenue'}
          value={formatCurrency(avgDailyRevenue)}
          unit={currency}
        />
      </div>

      {/* Revenue chart + Insights — 70/30 */}
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
        <div className="xl:col-span-7 bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'الإيرادات اليومية' : 'Daily Revenue'}
          </h2>
          <RevenueChart data={filledSales} currency={currency} />
        </div>

        <div className="xl:col-span-3 bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'الرؤى الآلية' : 'Automated Insights'}
          </h2>
          <AutomatedInsights insights={insights} isRTL={isAr} />
        </div>
      </div>

      {/* Top items + Branch comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'أكثر الأصناف مبيعاً' : 'Top Selling Items'}
          </h2>
          <TopItemsChart data={topItems} locale={locale} />
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'مقارنة الفروع' : 'Branch Comparison'}
          </h2>
          <BranchComparisonTable data={branches} currency={currency} locale={locale} />
        </div>
      </div>

      {/* Hourly heatmap */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'توزيع الطلبات بالساعة (طوال الوقت)' : 'Orders by Hour — All Time (Bahrain time)'}
        </h2>
        <HourlyHeatmap data={hourly} locale={locale} />
      </div>
    </div>
  )
}
