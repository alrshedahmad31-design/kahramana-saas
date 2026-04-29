import { redirect }          from 'next/navigation'
import { getSession }         from '@/lib/auth/session'
import { canAccessAnalytics } from '@/lib/auth/rbac'
import { buildDateRange, buildPrevRange, formatCurrency } from '@/lib/analytics/calculations'
import { getMetrics, getMenuItemPerformance, getTopItems } from '@/lib/analytics/queries'

import DateRangePicker    from '@/components/analytics/DateRangePicker'
import MetricCard         from '@/components/analytics/MetricCard'
import AnalyticsSubNav    from '@/components/analytics/AnalyticsSubNav'
import AnalyticsRefresher from '@/components/analytics/AnalyticsRefresher'
import MenuMatrix         from '@/components/analytics/menu/MenuMatrix'
import ItemProfitability  from '@/components/analytics/menu/ItemProfitability'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function MenuAnalyticsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessAnalytics(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const range    = buildDateRange(sp.range ?? '30d', sp.from, sp.to)
  const prev     = buildPrevRange(range)
  const branchId = user.branch_id ?? undefined

  const [metrics, menuItems, topItemsPeriod] = await Promise.all([
    getMetrics(range.from, range.to, prev.from, prev.to, branchId),
    getMenuItemPerformance(60),
    getTopItems(range.from, range.to, 10, branchId),
  ])

  const currency = isAr ? 'د.ب' : 'BD'

  const totalRevMenu  = menuItems.reduce((s, i) => s + i.total_revenue,    0)
  const totalProfit   = menuItems.reduce((s, i) => s + i.estimated_profit, 0)
  const totalUnitsSold = menuItems.reduce((s, i) => s + i.total_quantity,  0)

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <AnalyticsRefresher />
      <AnalyticsSubNav locale={locale} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'ذكاء القائمة' : 'Menu Intelligence'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'مصفوفة الربحية والأداء' : 'Profitability matrix & item performance'}
          </p>
        </div>
        <DateRangePicker currentRange={range.label} locale={locale} />
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={isAr ? 'إجمالي الأصناف' : 'Total Menu Items'}
          value={String(menuItems.length)}
        />
        <MetricCard
          title={isAr ? 'إجمالي الإيرادات' : 'Total Menu Revenue'}
          value={formatCurrency(totalRevMenu)}
          unit={currency}
        />
        <MetricCard
          title={isAr ? 'الربح المقدر (65%)' : 'Est. Profit (65% margin)'}
          value={formatCurrency(totalProfit)}
          unit={currency}
        />
        <MetricCard
          title={isAr ? 'وحدات مُباعة' : 'Units Sold'}
          value={totalUnitsSold.toLocaleString()}
        />
      </div>

      {/* Menu Engineering Matrix */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <div className="mb-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'مصفوفة هندسة القائمة' : 'Menu Engineering Matrix'}
          </h2>
          <p className={`text-xs text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr
              ? 'X = الحجم · Y = الربح — النقطة المرجعية: متوسط كل الأصناف'
              : 'X axis = volume · Y axis = profitability — Midpoint: average across all items'}
          </p>
        </div>
        <MenuMatrix items={menuItems} isRTL={isAr} />
      </div>

      {/* Item profitability table */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'جدول ربحية الأصناف (قابل للترتيب)' : 'Item Profitability Table — Sortable'}
        </h2>
        <ItemProfitability items={menuItems} isRTL={isAr} />
      </div>

      {/* Top performers this period */}
      {topItemsPeriod.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'أفضل الأصناف في هذه الفترة' : `Top Items — ${range.label === '7d' ? 'Last 7 Days' : range.label === '30d' ? 'Last 30 Days' : 'Selected Period'}`}
          </h2>
          <div className="space-y-3">
            {topItemsPeriod.map((item, idx) => (
              <div key={item.menu_item_slug} className="flex items-center gap-3">
                <span className="text-xs font-satoshi tabular-nums text-brand-muted w-4 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-brand-text truncate ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? item.name_ar : item.name_en}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-satoshi tabular-nums text-brand-gold font-semibold">
                    {formatCurrency(item.total_revenue_bhd)} {currency}
                  </p>
                  <p className="text-xs font-satoshi tabular-nums text-brand-muted">
                    {item.total_quantity} {isAr ? 'وحدة' : 'units'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
