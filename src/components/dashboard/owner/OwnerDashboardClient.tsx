'use client'

import { useTranslations } from 'next-intl'

import type { DashboardData } from '@/lib/dashboard/stats'
import type {
  MetricsData,
  OperationalMetricsData,
  BranchSummary,
  OrderSourceRow,
  SecondaryMetricsData,
  LaborCostMetrics,
} from '@/lib/analytics/queries'
import { calculateGrowth } from '@/lib/analytics/calculations'

interface BranchRow {
  id:      string
  name_ar: string
  name_en: string
}

interface Props {
  locale:               string
  isAr:                 boolean
  prefix:               string
  currency:             string
  dashboard:            DashboardData
  metricsToday:         MetricsData
  metricsWeek:          MetricsData
  metricsMonth:         MetricsData
  opsToday:             OperationalMetricsData
  opsMonth:             OperationalMetricsData
  branchSummariesToday: BranchSummary[]
  branchSummariesMonth: BranchSummary[]
  orderSources:         OrderSourceRow[]
  secondaryMonth:       SecondaryMetricsData
  labor:                LaborCostMetrics | null
  foodCost:             { foodCostBhd: number; revenueBhd: number }
  branches:             BranchRow[]
}

// ── Small utilities ─────────────────────────────────────────────────────────
const PLACEHOLDER = '--'

function fmtBhd(n: number): string {
  return Number(n).toFixed(3)
}

function fmtPct(n: number, withSign = true): string {
  const sign = withSign ? (n > 0 ? '+' : '') : ''
  return `${sign}${n.toFixed(1)}%`
}

function growthColor(pct: number): string {
  if (pct === 0) return 'text-brand-muted'
  return pct > 0 ? 'text-green-400' : 'text-red-400'
}

function growthArrow(pct: number): string {
  if (pct === 0) return ''
  return pct > 0 ? '↑' : '↓'
}

// Food cost % thresholds
function foodCostColor(pct: number | null): string {
  if (pct === null) return 'text-brand-muted'
  if (pct < 28) return 'text-green-400'
  if (pct <= 35) return 'text-brand-gold'
  return 'text-red-400'
}

function laborCostColor(pct: number | null): string {
  if (pct === null) return 'text-brand-muted'
  if (pct < 25) return 'text-green-400'
  if (pct <= 30) return 'text-brand-gold'
  return 'text-red-400'
}

function cancelRateColor(pct: number): string {
  if (pct === 0) return 'text-brand-muted'
  if (pct < 5) return 'text-green-400'
  if (pct < 10) return 'text-brand-gold'
  return 'text-red-400'
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider">
        {title}
      </h2>
      <div className="flex-1 h-px bg-brand-border" />
      {hint && (
        <span className="font-satoshi text-xs text-brand-muted">{hint}</span>
      )}
    </div>
  )
}

function KPICard({
  title,
  primary,
  secondary,
  tone = 'default',
}: {
  title:      string
  primary:    React.ReactNode
  secondary?: React.ReactNode
  tone?:      'default' | 'red' | 'green' | 'gold'
}) {
  const borderTone =
    tone === 'red'   ? 'border-red-500/30'   :
    tone === 'green' ? 'border-green-500/30' :
    tone === 'gold'  ? 'border-brand-gold/30':
    'border-brand-border'

  return (
    <div className={`rounded-xl border ${borderTone} bg-brand-surface p-4 flex flex-col gap-2`}>
      <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">{title}</p>
      <div className="font-satoshi font-black text-2xl text-brand-text tabular-nums leading-none">
        {primary}
      </div>
      {secondary && <div className="text-sm">{secondary}</div>}
    </div>
  )
}

function StatusPill({ label, count, tone }: { label: string; count: number | string; tone: 'gold' | 'green' | 'muted' | 'red' }) {
  const color =
    tone === 'gold'  ? 'border-brand-gold/40 text-brand-gold'    :
    tone === 'green' ? 'border-green-500/40 text-green-400'      :
    tone === 'red'   ? 'border-red-500/40 text-red-400'          :
    'border-brand-border text-brand-muted'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border ${color} bg-brand-surface ps-3 pe-3 py-1.5 font-satoshi text-xs`}>
      <span className="uppercase tracking-wider">{label}</span>
      <span className="tabular-nums font-bold">{count}</span>
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OwnerDashboardClient({
  locale: _locale,
  isAr,
  prefix: _prefix,
  currency,
  dashboard,
  metricsToday,
  metricsWeek,
  metricsMonth,
  opsToday,
  opsMonth: _opsMonth,
  branchSummariesToday,
  branchSummariesMonth,
  orderSources,
  secondaryMonth,
  labor,
  foodCost,
  branches,
}: Props) {
  const t  = useTranslations('dashboard.owner')
  const tn = useTranslations('order.status')

  // Derived: late-orders heuristic — longest-waiting active order > 30 min
  const longestActiveMins = dashboard.activeOrders.longestMins
  const isLate            = longestActiveMins > 30
  const lateCount         = isLate ? 1 : 0

  // Source-key → label helper (falls back to source string)
  function sourceLabel(source: string): string {
    const key = source.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
    const raw = t.has(`sources.${key}`) ? t(`sources.${key}`) : null
    return raw ?? source
  }

  // Top / bottom items today.
  // `topItems` from dashboard is ranked desc (top-5). We show ranks 1-3 as
  // "top items" and ranks 3-5 (indexes 2..4) as "slowest tracked items today".
  // The overlap on rank 3 is intentional: with only 5 tracked items the
  // bottom set is by definition tail of the same list.
  const topItems    = dashboard.topItems.slice(0, 3)
  const bottomItems = dashboard.topItems.slice(2, 5)

  // Period-level revenue growths (already in metrics)
  const todayRevGrowth = calculateGrowth(metricsToday.totalRevenue,    metricsToday.prevTotalRevenue)
  const weekRevGrowth  = calculateGrowth(metricsWeek.totalRevenue,     metricsWeek.prevTotalRevenue)
  const monthRevGrowth = calculateGrowth(metricsMonth.totalRevenue,    metricsMonth.prevTotalRevenue)

  // Food-cost & labor-cost percentages (month-to-date)
  const foodCostPct =
    foodCost.revenueBhd > 0 ? (foodCost.foodCostBhd / foodCost.revenueBhd) * 100 : null
  const laborCostPct = labor ? Number(labor.labor_cost_percentage) : null

  // Estimated net profit: Revenue - food - labor - 15% overhead
  const estNetProfit = (() => {
    const rev = foodCost.revenueBhd
    if (rev <= 0) return null
    const food  = (foodCostPct  ?? 0) / 100
    const lab   = (laborCostPct ?? 0) / 100
    const over  = 0.15
    return rev - rev * food - rev * lab - rev * over
  })()

  const netMarginPct =
    estNetProfit !== null && foodCost.revenueBhd > 0
      ? (estNetProfit / foodCost.revenueBhd) * 100
      : null

  // Build per-branch view
  const _branchById = new Map(branches.map((b) => [b.id, b]))
  const todayByBranch = new Map(branchSummariesToday.map((r) => [r.branch_id, r]))
  const monthByBranch = new Map(branchSummariesMonth.map((r) => [r.branch_id, r]))

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-8">
      {/* ── Title ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <p className="font-satoshi font-black text-xs text-brand-gold uppercase tracking-[0.3em]">
          {t('eyebrow')}
        </p>
        <h1 className="font-cairo font-black text-2xl text-brand-text">
          {t('title')}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted">
          {t('subtitle')}
        </p>
      </header>

      {/* ── BLOCK 1: Operations Snapshot ──────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader title={t('blocks.operations')} hint={t('todayLabel')} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title={t('ops.ordersToday')}
            primary={<span>{metricsToday.orderCount}</span>}
            secondary={
              <p className={`font-satoshi tabular-nums ${growthColor(calculateGrowth(metricsToday.orderCount, metricsToday.prevOrderCount))}`}>
                {growthArrow(calculateGrowth(metricsToday.orderCount, metricsToday.prevOrderCount))} {fmtPct(calculateGrowth(metricsToday.orderCount, metricsToday.prevOrderCount))}
                <span className="text-brand-muted ms-2 text-xs font-cairo">{t('vsYesterday')}</span>
              </p>
            }
          />
          <KPICard
            title={t('ops.revenueToday')}
            tone="gold"
            primary={
              <span className="text-brand-gold">
                {fmtBhd(metricsToday.totalRevenue)}
                <span className="text-sm font-medium text-brand-muted ms-1.5 font-satoshi">{currency}</span>
              </span>
            }
            secondary={
              <p className={`font-satoshi tabular-nums ${growthColor(todayRevGrowth)}`}>
                {growthArrow(todayRevGrowth)} {fmtPct(todayRevGrowth)}
                <span className="text-brand-muted ms-2 text-xs font-cairo">{t('vsYesterday')}</span>
              </p>
            }
          />
          <KPICard
            title={t('ops.aov')}
            primary={
              <span>
                {fmtBhd(metricsToday.avgOrderValue)}
                <span className="text-sm font-medium text-brand-muted ms-1.5 font-satoshi">{currency}</span>
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {t('ops.aovHint')}
              </p>
            }
          />
          <KPICard
            title={t('ops.lateOrders')}
            tone={lateCount > 0 ? 'red' : 'default'}
            primary={
              <span className={lateCount > 0 ? 'text-red-400' : 'text-brand-text'}>
                {lateCount > 0
                  ? <>≥{lateCount} <span className="text-sm font-medium text-brand-muted ms-1.5 font-satoshi">· {longestActiveMins}m</span></>
                  : '0'}
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {longestActiveMins > 0
                  ? t('ops.longestWait', { mins: longestActiveMins })
                  : t('ops.noLate')}
              </p>
            }
          />
        </div>

        {/* Status pills */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3">
          <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
            {t('ops.statusBreakdown')}
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={tn('preparing')}        count={dashboard.activeOrders.preparing}        tone="gold"  />
            <StatusPill label={tn('ready')}            count={dashboard.activeOrders.ready}            tone="green" />
            <StatusPill label={tn('out_for_delivery')} count={dashboard.activeOrders.out_for_delivery} tone="muted" />
            <StatusPill label={t('ops.delayed')}       count={isLate ? `${longestActiveMins}m` : '0'}  tone={isLate ? 'red' : 'muted'} />
          </div>
        </div>

        {/* Order source breakdown */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3">
          <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
            {t('ops.sources')}
          </p>
          {orderSources.length === 0 ? (
            <p className="font-satoshi text-sm text-brand-muted">{PLACEHOLDER}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {orderSources.map((s) => (
                <div key={s.source} className="flex flex-col gap-1">
                  <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                    {sourceLabel(s.source)}
                  </p>
                  <p className="font-satoshi font-black text-lg text-brand-text tabular-nums">
                    {s.order_count}
                  </p>
                  <p className="font-satoshi text-xs text-brand-gold tabular-nums">
                    {fmtBhd(Number(s.revenue))} {currency}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top / bottom items today */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3">
            <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
              {t('ops.topItems')}
            </p>
            {topItems.length === 0 ? (
              <p className="font-satoshi text-sm text-brand-muted">{PLACEHOLDER}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topItems.map((item, idx) => (
                  <li key={`${item.name_ar}::${item.name_en}`} className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="font-satoshi text-xs text-brand-gold tabular-nums shrink-0">{idx + 1}.</span>
                      <span className="font-satoshi text-sm text-brand-text truncate">
                        {isAr ? item.name_ar : item.name_en}
                      </span>
                    </span>
                    <span className="font-satoshi text-sm text-brand-muted tabular-nums shrink-0">
                      ×{item.total_quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3">
            <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
              {t('ops.bottomItems')}
            </p>
            {bottomItems.length === 0 ? (
              <p className="font-satoshi text-sm text-brand-muted">{PLACEHOLDER}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {bottomItems.map((item) => (
                  <li key={`${item.name_ar}::${item.name_en}`} className="flex items-baseline justify-between gap-3">
                    <span className="font-satoshi text-sm text-brand-text truncate">
                      {isAr ? item.name_ar : item.name_en}
                    </span>
                    <span className="font-satoshi text-sm text-brand-muted tabular-nums shrink-0">
                      ×{item.total_quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-satoshi text-xs text-brand-muted">
              {t('ops.bottomHint')}
            </p>
          </div>
        </div>
      </section>

      {/* ── BLOCK 2: Financial Snapshot ───────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader title={t('blocks.financial')} />

        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0">
            <thead className="border-b border-brand-border">
              <tr className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
                <th className="text-start ps-4 pe-3 py-3 font-black sticky start-0 bg-brand-surface z-10">{t('fin.period')}</th>
                <th className="text-end pe-3 py-3 font-black">{t('fin.revenue')}</th>
                <th className="text-end pe-3 py-3 font-black">{t('fin.orders')}</th>
                <th className="text-end pe-3 py-3 font-black">{t('fin.aov')}</th>
                <th className="text-end pe-4 py-3 font-black">{t('fin.growth')}</th>
              </tr>
            </thead>
            <tbody className="font-satoshi text-sm">
              {[
                { label: t('fin.today'),  m: metricsToday,  g: todayRevGrowth },
                { label: t('fin.week'),   m: metricsWeek,   g: weekRevGrowth  },
                { label: t('fin.month'),  m: metricsMonth,  g: monthRevGrowth },
              ].map((row, idx, arr) => (
                <tr key={row.label} className={idx < arr.length - 1 ? 'border-b border-brand-border' : ''}>
                  <td className="ps-4 pe-3 py-3 text-brand-text font-bold sticky start-0 bg-brand-surface z-10">{row.label}</td>
                  <td className="pe-3 py-3 text-end text-brand-gold tabular-nums whitespace-nowrap">
                    {fmtBhd(row.m.totalRevenue)} <span className="text-xs text-brand-muted">{currency}</span>
                  </td>
                  <td className="pe-3 py-3 text-end text-brand-text tabular-nums">{row.m.orderCount}</td>
                  <td className="pe-3 py-3 text-end text-brand-text tabular-nums whitespace-nowrap">
                    {fmtBhd(row.m.avgOrderValue)}
                  </td>
                  <td className={`pe-4 py-3 text-end tabular-nums whitespace-nowrap ${growthColor(row.g)}`}>
                    {growthArrow(row.g)} {fmtPct(row.g)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KPICard
            title={t('fin.foodCostPct')}
            primary={
              <span className={foodCostColor(foodCostPct)}>
                {foodCostPct === null ? PLACEHOLDER : `${foodCostPct.toFixed(1)}%`}
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {foodCostPct === null
                  ? t('fin.noFoodCostData')
                  : t('fin.foodCostThresholds')}
              </p>
            }
          />
          <KPICard
            title={t('fin.laborCostPct')}
            primary={
              <span className={laborCostColor(laborCostPct)}>
                {laborCostPct === null ? PLACEHOLDER : `${laborCostPct.toFixed(1)}%`}
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {laborCostPct === null
                  ? t('fin.noLaborData')
                  : t('fin.laborCostThresholds')}
              </p>
            }
          />
          <KPICard
            title={t('fin.estNetProfit')}
            tone="gold"
            primary={
              <span className={estNetProfit === null ? 'text-brand-muted' : (estNetProfit > 0 ? 'text-brand-gold' : 'text-red-400')}>
                {estNetProfit === null
                  ? PLACEHOLDER
                  : <>{fmtBhd(estNetProfit)} <span className="text-sm text-brand-muted font-satoshi">{currency}</span></>}
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {netMarginPct === null
                  ? t('fin.netProfitHint')
                  : t('fin.netMargin', { pct: netMarginPct.toFixed(1) })}
              </p>
            }
          />
        </div>
      </section>

      {/* ── BLOCK 3: Service Quality ─────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader title={t('blocks.service')} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title={t('service.acceptanceTime')}
            primary={<span className="text-brand-muted">{PLACEHOLDER}</span>}
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {t('service.acceptanceTimeHint')}
              </p>
            }
          />
          <KPICard
            title={t('service.prepTime')}
            primary={
              <span>
                {opsToday.avgFulfillmentMinutes > 0
                  ? <>{Math.round(opsToday.avgFulfillmentMinutes)} <span className="text-sm text-brand-muted font-satoshi">{t('service.mins')}</span></>
                  : PLACEHOLDER}
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {t('service.basedOn', { count: opsToday.ordersWithFulfillmentData })}
              </p>
            }
          />
          <KPICard
            title={t('service.cancelledToday')}
            tone={opsToday.cancelledOrders > 0 ? 'red' : 'default'}
            primary={
              <span className={opsToday.cancelledOrders > 0 ? 'text-red-400' : 'text-brand-text'}>
                {opsToday.cancelledOrders}
              </span>
            }
            secondary={
              <p className={`font-satoshi tabular-nums ${cancelRateColor(opsToday.cancellationRate)}`}>
                {fmtPct(opsToday.cancellationRate, false)}
                <span className="text-brand-muted ms-2 text-xs font-cairo">{t('service.cancelRate')}</span>
              </p>
            }
          />
          <KPICard
            title={t('service.repeatRate')}
            tone={secondaryMonth.repeatRate >= 30 ? 'green' : 'default'}
            primary={
              <span className={secondaryMonth.repeatRate >= 30 ? 'text-green-400' : 'text-brand-text'}>
                {fmtPct(secondaryMonth.repeatRate, false)}
              </span>
            }
            secondary={
              <p className="font-satoshi text-xs text-brand-muted">
                {t('service.repeatHint', {
                  repeat: secondaryMonth.repeatCustomersInPeriod,
                  total:  secondaryMonth.repeatCustomersInPeriod + secondaryMonth.newCustomersInPeriod,
                })}
              </p>
            }
          />
        </div>
      </section>

      {/* ── BLOCK 4: Branch Comparison ───────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader title={t('blocks.branches')} />

        {branches.length === 0 ? (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <p className="font-satoshi text-sm text-brand-muted text-center">{PLACEHOLDER}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {branches.map((b) => {
              const today = todayByBranch.get(b.id)
              const month = monthByBranch.get(b.id)
              const todayRevenue = today?.total_revenue_bhd ?? 0
              const todayOrders  = today?.order_count       ?? 0
              const monthRevenue = month?.total_revenue_bhd ?? 0
              const monthOrders  = month?.order_count       ?? 0
              const monthAov     = monthOrders > 0 ? monthRevenue / monthOrders : 0

              return (
                <div key={b.id} className="rounded-xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-cairo font-black text-base text-brand-text">
                      {isAr ? b.name_ar : b.name_en}
                    </h3>
                    <span className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                      {t('branch.label')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
                        {t('branch.todayRevenue')}
                      </p>
                      <p className="font-satoshi font-black text-lg text-brand-gold tabular-nums">
                        {fmtBhd(Number(todayRevenue))} <span className="text-xs text-brand-muted font-satoshi">{currency}</span>
                      </p>
                      <p className="font-satoshi text-xs text-brand-muted tabular-nums">
                        {todayOrders} {t('branch.orders')}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider">
                        {t('branch.monthRevenue')}
                      </p>
                      <p className="font-satoshi font-black text-lg text-brand-text tabular-nums">
                        {fmtBhd(Number(monthRevenue))} <span className="text-xs text-brand-muted font-satoshi">{currency}</span>
                      </p>
                      <p className="font-satoshi text-xs text-brand-muted tabular-nums">
                        {monthOrders} {t('branch.orders')} · {t('branch.aov')} {fmtBhd(monthAov)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
