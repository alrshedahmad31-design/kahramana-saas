import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { canAccessAnalytics } from '@/lib/auth/rbac'
import { buildDateRange, buildPrevRange, formatCurrency } from '@/lib/analytics/calculations'
import { getMetrics, getCouponAnalytics, getOrderSourceBreakdown } from '@/lib/analytics/queries'

import DateRangePicker    from '@/components/analytics/DateRangePicker'
import MetricCard         from '@/components/analytics/MetricCard'
import AnalyticsSubNav    from '@/components/analytics/AnalyticsSubNav'
import AnalyticsRefresher from '@/components/analytics/AnalyticsRefresher'
import CouponROITable     from '@/components/analytics/marketing/CouponROITable'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function MarketingAnalyticsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessAnalytics(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const range    = buildDateRange(sp.range ?? '30d', sp.from, sp.to)
  const prev     = buildPrevRange(range)
  const branchId = user.branch_id ?? undefined

  const [_metrics, coupons, sources] = await Promise.all([
    getMetrics(range.from, range.to, prev.from, prev.to, branchId),
    getCouponAnalytics(),
    getOrderSourceBreakdown(),
  ])

  const currency = isAr ? 'د.ب' : 'BD'

  const totalDiscount   = coupons.reduce((s, c) => s + c.total_discount_given,   0)
  const couponsRevenue  = coupons.reduce((s, c) => s + c.revenue_with_coupon,    0)
  const activeCoupons   = coupons.filter((c) => c.is_active).length
  const usedCoupons     = coupons.filter((c) => c.usage_count > 0).length
  const topChannel      = sources[0] ?? null

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <AnalyticsRefresher />
      <AnalyticsSubNav locale={locale} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'تحليل التسويق' : 'Marketing Analytics'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'عائد الكوبونات وقنوات الاستحواذ' : 'Coupon ROI, channel performance & promotions'}
          </p>
        </div>
        <DateRangePicker currentRange={range.label} locale={locale} />
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'كوبونات نشطة' : 'Active Coupons'}
          value={String(activeCoupons)}
        />
        <MetricCard
          title={isAr ? 'كوبونات مستخدمة' : 'Coupons with Usage'}
          value={String(usedCoupons)}
        />
        <MetricCard
          title={isAr ? 'إجمالي الخصم المُعطى' : 'Total Discounts Given'}
          value={formatCurrency(totalDiscount)}
          unit={currency}
        />
        <MetricCard
          title={isAr ? 'إيرادات عبر الكوبونات' : 'Revenue via Coupons'}
          value={formatCurrency(couponsRevenue)}
          unit={currency}
        />
      </div>

      {/* Coupon ROI table */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'أداء الكوبونات — عائد الاستثمار' : 'Coupon Performance — ROI Analysis'}
        </h2>
        <CouponROITable coupons={coupons} isRTL={isAr} />
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'قنوات الاستحواذ — الإيرادات' : 'Acquisition Channels — Revenue'}
          </h2>
          {sources.length === 0 ? (
            <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'لا توجد بيانات قنوات' : 'No channel data yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((src) => {
                const totalRev = sources.reduce((s, r) => s + r.revenue, 0)
                const share    = totalRev > 0 ? (src.revenue / totalRev) * 100 : 0
                return (
                  <div key={src.source}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm text-brand-text capitalize ${isAr ? 'font-almarai font-medium' : 'font-satoshi'}`}>
                        {src.source}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-satoshi tabular-nums text-brand-muted">{src.order_count} orders</span>
                        <span className="text-sm font-satoshi tabular-nums text-brand-gold font-semibold">
                          {formatCurrency(src.revenue)} {currency}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-brand-surface-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-gold" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top channel spotlight */}
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'القناة الأفضل أداءً' : 'Top Performing Channel'}
          </h2>
          {topChannel ? (
            <div className="space-y-4">
              <div>
                <p className={`text-3xl font-bold text-brand-gold capitalize ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                  {topChannel.source}
                </p>
                <p className={`text-sm text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'القناة الأعلى إيراداً' : 'Highest revenue channel'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-brand-surface-2 rounded-lg p-3">
                  <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{isAr ? 'الطلبات' : 'Orders'}</p>
                  <p className="text-xl font-bold font-satoshi tabular-nums text-brand-text">{topChannel.order_count.toLocaleString()}</p>
                </div>
                <div className="bg-brand-surface-2 rounded-lg p-3">
                  <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{isAr ? 'الإيرادات' : 'Revenue'}</p>
                  <p className="text-xl font-bold font-satoshi tabular-nums text-brand-text">
                    {formatCurrency(topChannel.revenue)} <span className="text-sm font-normal text-brand-muted">{currency}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'لا توجد بيانات قنوات' : 'No channel data yet'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
