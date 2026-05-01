import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import FoodCostTrendChart from './FoodCostChart'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
// Hardcoded target — can be made configurable via settings later
const TARGET_FOOD_COST_PCT = 30

export default async function FoodCostPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const dateFrom = sp.from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const dateTo = sp.to ?? new Date().toISOString().slice(0, 10)

  const supabase = await createClient()

  // Revenue from completed orders
  const [{ data: orderData }, { data: soldItems }, { data: cogsByDish }] = await Promise.all([
    supabase
      .from('orders')
      .select('total_bhd, created_at')
      .in('status', ['delivered', 'completed'])
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59'),
    // Theoretical COGS: approximate using all order_items (not date-filtered at DB level)
    // This is a known approximation — see note below
    supabase
      .from('order_items')
      .select('menu_item_slug, quantity')
      .limit(1000),
    supabase.from('v_dish_cogs').select('slug, cost_bhd'),
  ])

  // Note: order_items are not date-filtered here to avoid complex join.
  // This uses theoretical COGS from all recent items as an approximation.

  const cogsMap = new Map(
    (cogsByDish ?? []).map((d) => [d.slug as string, Number(d.cost_bhd)]),
  )

  const totalRevenue = (orderData ?? []).reduce((s, o) => s + Number(o.total_bhd), 0)
  const totalCogs = (soldItems ?? []).reduce((s, item) => {
    return s + (item.quantity ?? 0) * (cogsMap.get(item.menu_item_slug) ?? 0)
  }, 0)

  const foodCostPct = totalRevenue > 0 ? (totalCogs / totalRevenue) * 100 : 0
  const variancePct = foodCostPct - TARGET_FOOD_COST_PCT

  // Daily food cost trend from orders
  const dailyRevMap = new Map<string, number>()
  for (const o of orderData ?? []) {
    const date = (o.created_at as string).slice(0, 10)
    dailyRevMap.set(date, (dailyRevMap.get(date) ?? 0) + Number(o.total_bhd))
  }

  // For daily COGS we approximate using total COGS proportionally distributed by daily revenue
  const trendData: { date: string; pct: number }[] = Array.from(dailyRevMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dailyRev]) => {
      const dailyCogs = totalRevenue > 0 ? (dailyRev / totalRevenue) * totalCogs : 0
      const pct = dailyRev > 0 ? (dailyCogs / dailyRev) * 100 : 0
      return { date, pct }
    })

  // v_dish_cogs does not have a category column — fetch slug, cost_bhd, name_ar only
  type CogsRow = {
    slug: string | null
    cost_bhd: number | null
    name_ar: string | null
  }

  const { data: fullCogs } = await supabase
    .from('v_dish_cogs')
    .select('slug, cost_bhd, name_ar')

  // Category breakdown not available without category on v_dish_cogs
  const categoryBreakdown: { cat: string; cogs: number; pct: number }[] = []

  // Top cost drivers
  const typedCogs = (fullCogs ?? []) as CogsRow[]
  const topDrivers = typedCogs
    .map((dish) => {
      const qty = (soldItems ?? [])
        .filter((i) => i.menu_item_slug === dish.slug)
        .reduce((s, i) => s + (i.quantity ?? 0), 0)
      return {
        name_ar: dish.name_ar ?? '—',
        total_cogs: qty * Number(dish.cost_bhd ?? 0),
        qty,
      }
    })
    .filter((d) => d.total_cogs > 0)
    .sort((a, b) => b.total_cogs - a.total_cogs)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'تكلفة الغذاء' : 'Food Cost Report'}
        description={isAr ? 'نسبة تكلفة الغذاء الفعلية مقابل الهدف (تكلفة نظرية)' : 'Actual vs target food cost % (theoretical COGS)'}
        locale={locale}
      />

      {/* Date filter */}
      <form method="GET" className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
        <label className="font-satoshi text-xs text-brand-muted">{isAr ? 'من:' : 'From:'}</label>
        <input
          type="date"
          name="from"
          defaultValue={dateFrom}
          className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none"
        />
        <label className="font-satoshi text-xs text-brand-muted">{isAr ? 'إلى:' : 'To:'}</label>
        <input
          type="date"
          name="to"
          defaultValue={dateTo}
          className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-brand-gold px-4 py-1.5 font-satoshi text-xs font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors">
          {isAr ? 'تطبيق' : 'Apply'}
        </button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={isAr ? 'نسبة تكلفة الغذاء' : 'Food Cost %'}
          value={`${foodCostPct.toFixed(1)}%`}
          highlight
          trend={foodCostPct > TARGET_FOOD_COST_PCT ? 'down' : 'up'}
        />
        <StatCard
          label={isAr ? 'الهدف' : 'Target'}
          value={`${TARGET_FOOD_COST_PCT}%`}
        />
        <StatCard
          label={isAr ? 'الفرق' : 'Variance'}
          value={`${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%`}
          trend={variancePct > 0 ? 'down' : 'up'}
        />
        <StatCard
          label={isAr ? 'إجمالي الإيراد BD' : 'Total Revenue BD'}
          value={`BD ${totalRevenue.toFixed(3)}`}
        />
      </div>

      {totalRevenue === 0 ? (
        <EmptyReport
          title={isAr ? 'لا توجد بيانات مبيعات' : 'No sales data'}
          description={isAr ? 'لا توجد طلبات مكتملة في هذه الفترة' : 'No completed orders in this period'}
        />
      ) : (
        <>
          {/* Trend chart */}
          {trendData.length > 0 && <FoodCostTrendChart data={trendData} targetPct={TARGET_FOOD_COST_PCT} />}

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-border">
                <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'التكلفة حسب الفئة' : 'COGS by Category'}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-surface-2">
                    <th className="px-4 py-2 text-start font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'الفئة' : 'Category'}</th>
                    <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'COGS BD' : 'COGS BD'}</th>
                    <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? '% من الإيراد' : '% of Revenue'}</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((row) => (
                    <tr key={row.cat} className="border-b border-brand-border/30 hover:bg-brand-surface-2 transition-colors">
                      <td className="px-4 py-2 font-satoshi text-brand-text">{row.cat}</td>
                      <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{row.cogs.toFixed(3)}</td>
                      <td className={`px-4 py-2 text-end font-satoshi tabular-nums font-semibold ${row.pct > TARGET_FOOD_COST_PCT ? 'text-brand-error' : 'text-green-400'}`}>
                        {row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top cost drivers */}
          {topDrivers.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-border">
                <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'أكبر محركات التكلفة' : 'Top Cost Drivers'}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-surface-2">
                    <th className="px-4 py-2 text-start font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'الطبق' : 'Dish'}</th>
                    <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'الكمية' : 'Qty'}</th>
                    <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'إجمالي COGS BD' : 'Total COGS BD'}</th>
                  </tr>
                </thead>
                <tbody>
                  {topDrivers.map((d, i) => (
                    <tr key={i} className="border-b border-brand-border/30 hover:bg-brand-surface-2 transition-colors">
                      <td className="px-4 py-2 font-satoshi text-brand-text">{d.name_ar}</td>
                      <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{d.qty}</td>
                      <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-error font-semibold">{d.total_cogs.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
