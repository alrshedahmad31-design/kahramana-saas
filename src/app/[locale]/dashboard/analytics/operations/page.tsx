import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { canAccessAnalytics } from '@/lib/auth/rbac'
import { buildDateRange, buildPrevRange } from '@/lib/analytics/calculations'
import { getMetrics, getOperationalMetrics, getHourlyDistribution } from '@/lib/analytics/queries'

import DateRangePicker    from '@/components/analytics/DateRangePicker'
import MetricCard         from '@/components/analytics/MetricCard'
import AnalyticsSubNav    from '@/components/analytics/AnalyticsSubNav'
import AnalyticsRefresher from '@/components/analytics/AnalyticsRefresher'
import HourlyHeatmap      from '@/components/analytics/HourlyHeatmap'
import OperationsMetrics  from '@/components/analytics/OperationsMetrics'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function OperationsAnalyticsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessAnalytics(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const range    = buildDateRange(sp.range ?? '7d', sp.from, sp.to)
  const prev     = buildPrevRange(range)
  const branchId = user.branch_id ?? undefined

  const [metrics, opMetrics, hourly] = await Promise.all([
    getMetrics(range.from, range.to, prev.from, prev.to, branchId),
    getOperationalMetrics(range.from, range.to, branchId),
    getHourlyDistribution(),
  ])

  const peakHour = hourly.length
    ? hourly.reduce((peak, r) => r.order_count > peak.order_count ? r : peak).hour_of_day
    : null

  const peakLabel = peakHour !== null
    ? (peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour - 12} PM`)
    : '—'

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <AnalyticsRefresher />
      <AnalyticsSubNav locale={locale} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'تحليل العمليات' : 'Operations Analytics'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'أداء المطبخ والتوصيل والتنفيذ' : 'Kitchen, delivery & fulfillment performance'}
          </p>
        </div>
        <DateRangePicker currentRange={range.label} locale={locale} />
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'إجمالي الطلبات' : 'Total Orders'}
          value={String(metrics.orderCount)}
        />
        <MetricCard
          title={isAr ? 'متوسط وقت التنفيذ' : 'Avg Fulfillment Time'}
          value={opMetrics.avgFulfillmentMinutes > 0
            ? `${opMetrics.avgFulfillmentMinutes.toFixed(0)} ${isAr ? 'د' : 'min'}`
            : '—'}
        />
        <MetricCard
          title={isAr ? 'معدل الإلغاء' : 'Cancellation Rate'}
          value={`${opMetrics.cancellationRate.toFixed(1)}%`}
        />
        <MetricCard
          title={isAr ? 'ذروة الطلبات' : 'Peak Hour'}
          value={peakLabel}
        />
      </div>

      {/* Operations metrics grid */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'مؤشرات الأداء التشغيلي' : 'Operational Performance Indicators'}
        </h2>
        <OperationsMetrics data={opMetrics} isRTL={isAr} />
      </div>

      {/* Order status breakdown for this period */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'ملاحظة حول بيانات وقت التنفيذ' : 'Fulfillment Time — Data Note'}
        </h2>
        <p className={`text-sm text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr
            ? 'يتم حساب وقت التنفيذ من وقت استلام الطلب حتى آخر تحديث للحالة. للحصول على بيانات أدق لوقت التحضير ووقت التوصيل بشكل منفصل، يلزم تفعيل جدول أحداث حالة الطلبات (order_status_events).'
            : 'Fulfillment time is calculated from order creation to last status update. For precise kitchen prep vs. delivery split times, enable the order_status_events audit table in a future migration.'}
        </p>
      </div>

      {/* Hourly heatmap */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'توزيع الطلبات بالساعة (طوال الوقت)' : 'Order Volume by Hour — All Time'}
        </h2>
        <HourlyHeatmap data={hourly} locale={locale} />
      </div>
    </div>
  )
}
