import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { HIDDEN_BRANCHES } from '@/constants/contact'
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
  const t = await getTranslations({ locale, namespace: 'inventory.reports.foodCost' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const dateFrom = sp.from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const dateTo = sp.to ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bahrain' }).format(new Date())

  const supabase = await createClient()

  // Revenue from completed orders
  const ordersQuery = supabase
    .from('orders')
    .select('total_bhd, created_at')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59')

  const [{ data: orderData }, { data: soldItems }, { data: cogsByDish }] = await Promise.all([
    HIDDEN_BRANCHES.length > 0
      ? ordersQuery.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
      : ordersQuery,
    supabase
      .from('order_items')
      .select('menu_item_slug, quantity')
      .limit(1000),
    supabase.from('v_dish_cogs').select('slug, cost_bhd'),
  ])

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

  const trendData: { date: string; pct: number }[] = Array.from(dailyRevMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dailyRev]) => {
      const dailyCogs = totalRevenue > 0 ? (dailyRev / totalRevenue) * totalCogs : 0
      const pct = dailyRev > 0 ? (dailyCogs / dailyRev) * 100 : 0
      return { date, pct }
    })

  type CogsRow = {
    slug: string | null
    cost_bhd: number | null
    name_ar: string | null
    name_en: string | null
  }

  const { data: fullCogs } = await supabase
    .from('v_dish_cogs')
    .select('slug, cost_bhd, name_ar, name_en')

  const categoryBreakdown: { cat: string; cogs: number; pct: number }[] = []

  const typedCogs = (fullCogs ?? []) as CogsRow[]
  const topDrivers = typedCogs
    .map((dish) => {
      const qty = (soldItems ?? [])
        .filter((i) => i.menu_item_slug === dish.slug)
        .reduce((s, i) => s + (i.quantity ?? 0), 0)
      return {
        name: isAr ? dish.name_ar : (dish.name_en || dish.name_ar),
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
        title={t('title')}
        description={t('desc')}
      />

      {/* Date filter */}
      <form method="GET" className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('from')}</label>
          <input
            type="date"
            name="from"
            defaultValue={dateFrom}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none shadow-inner transition-all`}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('to')}</label>
          <input
            type="date"
            name="to"
            defaultValue={dateTo}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none shadow-inner transition-all`}
          />
        </div>
        <button type="submit" className={`rounded-lg bg-brand-gold px-6 py-2 ${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-black hover:bg-brand-goldLight transition-all shadow-md active:scale-95`}>
          {t('apply')}
        </button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('foodCostPct')}
          value={`${foodCostPct.toFixed(1)}%`}
          highlight
          trend={foodCostPct > TARGET_FOOD_COST_PCT ? 'down' : 'up'}
        />
        <StatCard
          label={t('target')}
          value={`${TARGET_FOOD_COST_PCT}%`}
        />
        <StatCard
          label={t('variance')}
          value={`${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%`}
          trend={variancePct > 0 ? 'down' : 'up'}
        />
        <StatCard
          label={t('totalRevenue')}
          value={totalRevenue.toFixed(3)}
          sub={currency}
        />
      </div>

      {totalRevenue === 0 ? (
        <EmptyReport
          title={t('noSales')}
          description={t('noOrders')}
        />
      ) : (
        <div className="space-y-6">
          {/* Trend chart */}
          {trendData.length > 0 && (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
              <FoodCostTrendChart data={trendData} targetPct={TARGET_FOOD_COST_PCT} locale={locale} />
            </div>
          )}

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-brand-border bg-brand-surface-2/50 backdrop-blur-sm">
                <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>{t('cogsByCategory')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="bg-brand-surface-2 border-b border-brand-border">
                    <tr>
                      <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('category')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('cogsBd')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('pctOfRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/30">
                    {categoryBreakdown.map((row) => (
                      <tr key={row.cat} className="hover:bg-brand-surface-2 transition-colors">
                        <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text`}>{row.cat}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">{row.cogs.toFixed(3)}</td>
                        <td className={`px-5 py-3 text-end font-satoshi text-sm font-black tabular-nums ${row.pct > TARGET_FOOD_COST_PCT ? 'text-brand-error' : 'text-green-400'}`}>
                          {row.pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top cost drivers */}
          {topDrivers.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-brand-border bg-brand-surface-2/50 backdrop-blur-sm">
                <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>{t('topDrivers')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="bg-brand-surface-2 border-b border-brand-border">
                    <tr>
                      <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('dish')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('qty')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('totalCogs')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/30">
                    {topDrivers.map((d, i) => (
                      <tr key={i} className="hover:bg-brand-surface-2 transition-colors group">
                        <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors`}>{d.name}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{d.qty}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-error tabular-nums">{d.total_cogs.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

