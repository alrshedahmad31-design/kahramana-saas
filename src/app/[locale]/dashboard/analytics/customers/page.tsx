import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { canAccessAnalytics } from '@/lib/auth/rbac'
import { buildDateRange, buildPrevRange, formatCurrency } from '@/lib/analytics/calculations'
import {
  getMetrics, getSecondaryMetrics,
  getCustomerSegmentSummary, getTopCustomers,
  getOrderSourceBreakdown,
} from '@/lib/analytics/queries'

import DateRangePicker   from '@/components/analytics/DateRangePicker'
import MetricCard        from '@/components/analytics/MetricCard'
import AnalyticsSubNav   from '@/components/analytics/AnalyticsSubNav'
import AnalyticsRefresher from '@/components/analytics/AnalyticsRefresher'
import SegmentChart      from '@/components/analytics/customers/SegmentChart'
import CLVLeaderboard    from '@/components/analytics/customers/CLVLeaderboard'
import RetentionMetrics  from '@/components/analytics/customers/RetentionMetrics'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function CustomersAnalyticsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessAnalytics(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const range    = buildDateRange(sp.range ?? '30d', sp.from, sp.to)
  const prev     = buildPrevRange(range)
  const branchId = user.branch_id ?? undefined

  const [metrics, secondary, segments, topCustomers, sources] = await Promise.all([
    getMetrics(range.from, range.to, prev.from, prev.to, branchId),
    getSecondaryMetrics(range.from, range.to, branchId),
    getCustomerSegmentSummary(),
    getTopCustomers(10),
    getOrderSourceBreakdown(),
  ])

  const currency  = isAr ? 'د.ب' : 'BD'
  const totalCust = segments.reduce((s, r) => s + r.customer_count, 0)

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <AnalyticsRefresher />
      <AnalyticsSubNav locale={locale} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'تحليل العملاء' : 'Customer Analytics'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'القيمة الدائمة والشرائح والاحتفاظ' : 'Lifetime value, segments & retention'}
          </p>
        </div>
        <DateRangePicker currentRange={range.label} locale={locale} />
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'إجمالي العملاء المعروفين' : 'Total Identified Customers'}
          value={totalCust.toLocaleString()}
        />
        <MetricCard
          title={isAr ? 'عملاء جدد (هذه الفترة)' : 'New Customers (Period)'}
          value={String(secondary.newCustomersInPeriod)}
        />
        <MetricCard
          title={isAr ? 'عملاء عائدون' : 'Returning Customers'}
          value={String(secondary.repeatCustomersInPeriod)}
        />
        <MetricCard
          title={isAr ? 'معدل التكرار' : 'Repeat Rate'}
          value={`${secondary.repeatRate.toFixed(1)}%`}
        />
      </div>

      {/* Segments + CLV Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'شرائح العملاء' : 'Customer Segments'}
          </h2>
          <SegmentChart segments={segments} isRTL={isAr} />
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'أفضل العملاء — القيمة الدائمة' : 'Top Customers — Lifetime Value'}
          </h2>
          <CLVLeaderboard customers={topCustomers} isRTL={isAr} />
        </div>
      </div>

      {/* Retention metrics */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'مؤشرات الاحتفاظ والنشاط' : 'Retention & Activity Metrics'}
        </h2>
        <RetentionMetrics data={secondary} totalOrders={metrics.orderCount} isRTL={isAr} />
      </div>

      {/* Acquisition channels */}
      {sources.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'قنوات الاستحواذ' : 'Acquisition Channels'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  {[isAr ? 'القناة' : 'Channel', isAr ? 'الطلبات' : 'Orders', isAr ? 'الإيرادات' : 'Revenue', isAr ? 'الحصة' : 'Share'].map((h) => (
                    <th key={h} className={`pb-2 pt-1 px-3 text-xs font-medium text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((src) => {
                  const totalRev = sources.reduce((s, r) => s + r.revenue, 0)
                  const share    = totalRev > 0 ? (src.revenue / totalRev) * 100 : 0
                  return (
                    <tr key={src.source} className="border-b border-brand-border/40 hover:bg-brand-surface-2">
                      <td className={`px-3 py-2.5 font-medium text-brand-text capitalize ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{src.source}</td>
                      <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-text">{src.order_count.toLocaleString()}</td>
                      <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-text">
                        {formatCurrency(src.revenue)} {currency}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 bg-brand-surface-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-brand-gold" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs font-satoshi tabular-nums text-brand-muted">{share.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
