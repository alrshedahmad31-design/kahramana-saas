import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
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
  ingredient: { name_ar: string; unit: string; cost_per_unit: number } | null
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function WasteReportPage({ params, searchParams }: PageProps) {
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
  const { data: wastes } = await supabase
    .from('waste_log')
    .select('id, branch_id, quantity, reason, cost_bhd, escalation_level, reported_at, approved_by, ingredient:ingredients(name_ar, unit, cost_per_unit)')
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
    const reason = w.reason ?? 'غير محدد'
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
  const byIngredientMap = new Map<string, { name_ar: string; total_qty: number; total_cost: number; count: number }>()
  for (const w of safeWastes) {
    const key = w.ingredient?.name_ar ?? 'مجهول'
    const existing = byIngredientMap.get(key) ?? { name_ar: key, total_qty: 0, total_cost: 0, count: 0 }
    byIngredientMap.set(key, {
      name_ar: key,
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
        title={isAr ? 'تقرير الهدر' : 'Waste Report'}
        description={isAr ? 'تحليل الهدر حسب السبب والمكوّن' : 'Waste analysis by reason and ingredient'}
        locale={locale}
        actions={
          <Link
            href={`${prefix}/dashboard/inventory/waste/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
          >
            {isAr ? '+ تسجيل هدر' : '+ Log Waste'}
          </Link>
        }
      />

      {/* Date range filter */}
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
        <button
          type="submit"
          className="rounded-lg bg-brand-gold px-4 py-1.5 font-satoshi text-xs font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          {isAr ? 'تطبيق' : 'Apply'}
        </button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={isAr ? 'إجمالي تكلفة الهدر' : 'Total Waste Cost'} value={`BD ${totalCost.toFixed(3)}`} highlight />
        <StatCard label={isAr ? 'عدد الحوادث' : 'Incidents'} value={safeWastes.length} />
        <StatCard label={isAr ? 'متوسط التكلفة' : 'Avg Cost'} value={`BD ${avgCost.toFixed(3)}`} />
        <StatCard label={isAr ? 'الحوادث المُصعَّدة' : 'Escalated'} value={escalatedCount} trend={escalatedCount > 0 ? 'down' : 'neutral'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reasonChartData.length > 0 && <WasteByReasonChart data={reasonChartData} />}
        {trendData.length > 0 && <WasteTrendChart data={trendData} />}
      </div>

      {/* By reason table */}
      {byReason.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border">
            <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'الهدر حسب السبب' : 'By Reason'}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface-2">
                <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'السبب' : 'Reason'}</th>
                <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الحوادث' : 'Count'}</th>
                <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'التكلفة BD' : 'Cost BD'}</th>
              </tr>
            </thead>
            <tbody>
              {byReason.map((r) => (
                <tr key={r.name} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-satoshi text-brand-text">{r.name}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{r.count}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-error font-semibold">{r.total_cost.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top ingredients */}
      {topIngredients.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border">
            <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'أكثر المكونات هدراً' : 'Top Wasted Ingredients'}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface-2">
                <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الكمية' : 'Qty'}</th>
                <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الحوادث' : 'Count'}</th>
                <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'التكلفة BD' : 'Cost BD'}</th>
              </tr>
            </thead>
            <tbody>
              {topIngredients.map((r) => (
                <tr key={r.name_ar} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-satoshi text-brand-text">{r.name_ar}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{r.total_qty.toFixed(2)}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{r.count}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-error font-semibold">{r.total_cost.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {safeWastes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="font-cairo text-lg font-black text-brand-text">{isAr ? 'لا توجد سجلات هدر' : 'No waste records'}</p>
          <p className="font-satoshi text-sm text-brand-muted">{isAr ? 'لا توجد بيانات في الفترة المحددة' : 'No data for the selected period'}</p>
        </div>
      )}
    </div>
  )
}
