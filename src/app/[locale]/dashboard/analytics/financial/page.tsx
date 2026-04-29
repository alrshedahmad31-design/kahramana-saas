import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { canAccessAnalytics } from '@/lib/auth/rbac'
import { buildDateRange, buildPrevRange, formatCurrency, calculateGrowth } from '@/lib/analytics/calculations'
import { getMetrics } from '@/lib/analytics/queries'

import DateRangePicker    from '@/components/analytics/DateRangePicker'
import MetricCard         from '@/components/analytics/MetricCard'
import AnalyticsSubNav    from '@/components/analytics/AnalyticsSubNav'
import AnalyticsRefresher from '@/components/analytics/AnalyticsRefresher'
import PLStatement        from '@/components/analytics/financial/PLStatement'
import FinancialRatios    from '@/components/analytics/financial/FinancialRatios'

export const dynamic = 'force-dynamic'

// Standard restaurant cost percentages — update after connecting real COGS data
const COGS_PCT     = 0.30
const LABOR_PCT    = 0.28
const OVERHEAD_PCT = 0.15

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function FinancialAnalyticsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessAnalytics(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const range    = buildDateRange(sp.range ?? '30d', sp.from, sp.to)
  const prev     = buildPrevRange(range)
  const branchId = user.branch_id ?? undefined

  const metrics = await getMetrics(range.from, range.to, prev.from, prev.to, branchId)

  const currency = isAr ? 'د.ب' : 'BD'

  const rev     = metrics.totalRevenue
  const cogs    = rev * COGS_PCT
  const labor   = rev * LABOR_PCT
  const overhead= rev * OVERHEAD_PCT
  const net     = rev - cogs - labor - overhead
  const netPct  = rev > 0 ? net / rev : 0

  const revGrowth = calculateGrowth(metrics.totalRevenue, metrics.prevTotalRevenue)

  // Break-even estimate (assumes fixed monthly overhead ~BD 1500 for small restaurant)
  const MONTHLY_FIXED = 1500
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000))
  const periodFixed    = MONTHLY_FIXED * (days / 30)
  const avgDaily       = rev / days
  const breakEvenDays  = avgDaily > 0 ? periodFixed / avgDaily : null

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <AnalyticsRefresher />
      <AnalyticsSubNav locale={locale} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'التحليل المالي' : 'Financial Analytics'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'حساب الأرباح والخسائر ومؤشرات التكلفة' : 'P&L estimation and cost ratio benchmarks'}
          </p>
        </div>
        <DateRangePicker currentRange={range.label} locale={locale} />
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'الإيرادات الإجمالية' : 'Gross Revenue'}
          value={formatCurrency(rev)}
          unit={currency}
          change={revGrowth}
        />
        <MetricCard
          title={isAr ? 'صافي الربح (تقدير)' : 'Est. Net Profit'}
          value={formatCurrency(net)}
          unit={currency}
        />
        <MetricCard
          title={isAr ? 'هامش الربح' : 'Profit Margin'}
          value={`${(netPct * 100).toFixed(1)}%`}
        />
        <MetricCard
          title={isAr ? 'تكلفة أساسية' : 'Prime Cost'}
          value={`${((COGS_PCT + LABOR_PCT) * 100).toFixed(0)}%`}
        />
      </div>

      {/* P&L + ratios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'قائمة الأرباح والخسائر (تقديرية)' : 'P&L Statement — Estimated'}
          </h2>
          <PLStatement
            revenue={rev}
            cogsPct={COGS_PCT}
            laborPct={LABOR_PCT}
            overheadPct={OVERHEAD_PCT}
            currency={currency}
            isRTL={isAr}
          />

          <p className={`text-xs text-brand-muted mt-4 italic ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr
              ? '* التكاليف تقديرية بنسب صناعية قياسية. ادعم بيانات COGS الفعلية لدقة أعلى.'
              : '* Costs use industry-standard estimates. Connect actual COGS data for precision.'}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'مؤشرات التكلفة الرئيسية' : 'Key Cost Ratios'}
          </h2>
          <FinancialRatios
            revenue={rev}
            cogsPct={COGS_PCT}
            laborPct={LABOR_PCT}
            overheadPct={OVERHEAD_PCT}
            isRTL={isAr}
          />
        </div>
      </div>

      {/* Break-even */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'تحليل نقطة التعادل' : 'Break-even Analysis'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-brand-surface-2 rounded-xl p-4">
            <p className={`text-xs text-brand-muted mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'متوسط الإيراد اليومي' : 'Avg Daily Revenue'}
            </p>
            <p className="text-2xl font-bold font-satoshi tabular-nums text-brand-text">
              {formatCurrency(avgDaily)} {currency}
            </p>
          </div>

          <div className="bg-brand-surface-2 rounded-xl p-4">
            <p className={`text-xs text-brand-muted mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'النفقات الثابتة المقدرة (شهرياً)' : 'Est. Fixed Costs (Monthly)'}
            </p>
            <p className="text-2xl font-bold font-satoshi tabular-nums text-brand-text">
              {formatCurrency(MONTHLY_FIXED)} {currency}
            </p>
            <p className={`text-xs text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'تقدير — حدّث بالأرقام الفعلية' : 'Estimate — update with actuals'}
            </p>
          </div>

          <div className="bg-brand-surface-2 rounded-xl p-4">
            <p className={`text-xs text-brand-muted mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'أيام الوصول لنقطة التعادل' : 'Days to Break-even'}
            </p>
            <p className="text-2xl font-bold font-satoshi tabular-nums text-brand-text">
              {breakEvenDays !== null ? `${breakEvenDays.toFixed(1)} ${isAr ? 'يوم' : 'days'}` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
