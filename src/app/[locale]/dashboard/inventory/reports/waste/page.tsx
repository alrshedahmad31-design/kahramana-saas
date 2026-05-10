import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import { WasteByReasonChart, WasteTrendChart } from './WasteCharts'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

type WasteLogRow = {
  id: string
  branch_id: string | null
  quantity: number
  reason: string | null
  cost_bhd: number | null
  escalation_level: number | null
  reported_at: string
  approved_by: string | null
  ingredient: { name_ar: string; name_en: string | null; unit: string; cost_per_unit: number } | null
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function WasteReportPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations({ locale, namespace: 'inventory.reports.wasteReport' })
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
  const { data: wastes } = await supabase
    .from('waste_log')
    .select('id, branch_id, quantity, reason, cost_bhd, escalation_level, reported_at, approved_by, ingredient:ingredients(name_ar, name_en, unit, cost_per_unit)')
    .gte('reported_at', dateFrom)
    .lte('reported_at', dateTo + 'T23:59:59')
    .order('reported_at', { ascending: false })

  const safeWastes = (wastes ?? []) as WasteLogRow[]

  // Server-side aggregations
  const totalCost = safeWastes.reduce((s, w) => s + Number(w.cost_bhd ?? 0), 0)
  const escalatedCount = safeWastes.filter((w) => (w.escalation_level ?? 0) >= 1).length
  const avgCost = safeWastes.length > 0 ? totalCost / safeWastes.length : 0

  // By reason
  const byReasonMap = new Map<string, { count: number; total_cost: number }>()
  for (const w of safeWastes) {
    const reason = w.reason ?? t('unknown')
    const existing = byReasonMap.get(reason) ?? { count: 0, total_cost: 0 }
    byReasonMap.set(reason, {
      count: existing.count + 1,
      total_cost: existing.total_cost + Number(w.cost_bhd ?? 0),
    })
  }
  const byReason = Array.from(byReasonMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total_cost - a.total_cost)

  // Top ingredients
  const byIngredientMap = new Map<string, { name: string; total_qty: number; total_cost: number; count: number }>()
  for (const w of safeWastes) {
    const key = isAr ? (w.ingredient?.name_ar ?? t('unknown')) : (w.ingredient?.name_en || w.ingredient?.name_ar || t('unknown'))
    const existing = byIngredientMap.get(key) ?? { name: key, total_qty: 0, total_cost: 0, count: 0 }
    byIngredientMap.set(key, {
      name: key,
      total_qty: existing.total_qty + (w.quantity ?? 0),
      total_cost: existing.total_cost + Number(w.cost_bhd ?? 0),
      count: existing.count + 1,
    })
  }
  const topIngredients = Array.from(byIngredientMap.values())
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10)

  // Daily trend
  const dailyMap = new Map<string, number>()
  for (const w of safeWastes) {
    const date = w.reported_at.slice(0, 10)
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + Number(w.cost_bhd ?? 0))
  }
  const trendData = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, cost]) => ({ date, cost }))

  const reasonChartData = byReason.map((r) => ({ name: r.name, value: r.total_cost }))

  return (
    <div className="space-y-6">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
        actions={
          <Link
            href={`${prefix}/dashboard/inventory/waste/new`}
            className={`inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 ${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-black hover:bg-brand-goldLight transition-all shadow-md active:scale-95`}
          >
            <span>+</span>
            <span>{t('logWaste')}</span>
          </Link>
        }
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
          {tCommon('apply')}
        </button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label={t('totalWasteCost')} 
          value={totalCost.toFixed(3)} 
          sub={currency}
          highlight 
        />
        <StatCard label={t('incidents')} value={safeWastes.length} />
        <StatCard label={t('avgCost')} value={avgCost.toFixed(3)} sub={currency} />
        <StatCard label={t('escalated')} value={escalatedCount} trend={escalatedCount > 0 ? 'down' : 'neutral'} />
      </div>

      {safeWastes.length === 0 ? (
        <EmptyReport
          title={t('noRecords')}
          description={t('noData')}
        />
      ) : (
        <div className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
              <WasteByReasonChart data={reasonChartData} locale={locale} />
            </div>
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
              <WasteTrendChart data={trendData} locale={locale} />
            </div>
          </div>

          {/* By reason table */}
          {byReason.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-brand-border bg-brand-surface-2/50 backdrop-blur-sm">
                <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>{t('byReason')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="bg-brand-surface-2 border-b border-brand-border">
                    <tr>
                      <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('reason')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('count')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('costBd')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/30">
                    {byReason.map((r) => (
                      <tr key={r.name} className="hover:bg-brand-surface-2 transition-colors">
                        <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text`}>{r.name}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{r.count}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-error tabular-nums">{r.total_cost.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top ingredients */}
          {topIngredients.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-brand-border bg-brand-surface-2/50 backdrop-blur-sm">
                <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>{t('topIngredients')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="bg-brand-surface-2 border-b border-brand-border">
                    <tr>
                      <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('ingredient')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('qty')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('count')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('costBd')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/30">
                    {topIngredients.map((r) => (
                      <tr key={r.name} className="hover:bg-brand-surface-2 transition-colors group">
                        <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors`}>{r.name}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{r.total_qty.toFixed(2)}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{r.count}</td>
                        <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-error tabular-nums">{r.total_cost.toFixed(3)}</td>
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

