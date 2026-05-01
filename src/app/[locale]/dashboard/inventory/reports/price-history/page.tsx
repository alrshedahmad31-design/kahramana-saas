import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import PriceHistoryChart from './PriceHistoryChart'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

type HistoryRow = {
  id: string
  unit_cost: number
  effective_at: string
  supplier: { name_ar: string } | null
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function PriceHistoryPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const ingredientId = sp.ingredient ?? null
  const supabase = await createClient()

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name_ar, unit')
    .eq('is_active', true)
    .order('name_ar')

  const { data: rawHistory } = ingredientId
    ? await supabase
        .from('supplier_price_history')
        .select('id, unit_cost, effective_at, supplier:suppliers(name_ar)')
        .eq('ingredient_id', ingredientId)
        .order('effective_at', { ascending: true })
    : { data: null }

  const history = (rawHistory ?? []) as HistoryRow[]

  // Compute stats
  const prices = history.map((r) => r.unit_cost)
  const currentPrice = prices.at(-1) ?? 0
  const avgPrice = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0

  const selectedIngredient = ingredientId
    ? (ingredients ?? []).find((i) => i.id === ingredientId)
    : null

  // Price change per row
  const historyWithChange = history.map((row, i) => ({
    ...row,
    prevCost: i > 0 ? history[i - 1].unit_cost : null,
    changePct:
      i > 0 && history[i - 1].unit_cost > 0
        ? ((row.unit_cost - history[i - 1].unit_cost) / history[i - 1].unit_cost) * 100
        : null,
  }))

  return (
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'سجل الأسعار' : 'Price History'}
        description={isAr ? 'تاريخ أسعار المشتريات من الموردين لكل مكوّن' : 'Purchase price history by supplier per ingredient'}
        locale={locale}
      />

      {/* Ingredient selector */}
      <form method="GET" className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
        <label className="font-satoshi text-xs text-brand-muted">{isAr ? 'المكوّن:' : 'Ingredient:'}</label>
        <select
          name="ingredient"
          defaultValue={ingredientId ?? ''}
          className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none min-w-48"
        >
          <option value="">{isAr ? '— اختر مكوّناً —' : '— Select ingredient —'}</option>
          {(ingredients ?? []).map((ing) => (
            <option key={ing.id} value={ing.id}>{ing.name_ar} ({ing.unit})</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-brand-gold px-4 py-1.5 font-satoshi text-xs font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors">
          {isAr ? 'عرض' : 'View'}
        </button>
      </form>

      {!ingredientId ? (
        <EmptyReport
          title={isAr ? 'اختر مكوّناً للبدء' : 'Select an ingredient to start'}
          description={isAr ? 'اختر مكوّناً من القائمة أعلاه لعرض سجل الأسعار' : 'Choose an ingredient from the dropdown above to view price history'}
        />
      ) : history.length === 0 ? (
        <EmptyReport
          title={isAr ? 'لا توجد بيانات أسعار' : 'No price history'}
          description={isAr ? `لا يوجد سجل أسعار لـ "${selectedIngredient?.name_ar ?? '—'}"` : `No price history found for "${selectedIngredient?.name_ar ?? '—'}"`}
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={isAr ? 'السعر الحالي BD' : 'Current Price BD'} value={`${currentPrice.toFixed(3)}`} highlight />
            <StatCard label={isAr ? 'متوسط السعر BD' : 'Avg Price BD'} value={`${avgPrice.toFixed(3)}`} />
            <StatCard label={isAr ? 'أدنى سعر BD' : 'Min Price BD'} value={`${minPrice.toFixed(3)}`} trend="up" />
            <StatCard label={isAr ? 'أعلى سعر BD' : 'Max Price BD'} value={`${maxPrice.toFixed(3)}`} trend="down" />
          </div>

          {/* Chart */}
          <PriceHistoryChart history={history} />

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface-2">
                  <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'المورد' : 'Supplier'}</th>
                  <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'السعر BD' : 'Price BD'}</th>
                  <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'التغيير %' : 'Change %'}</th>
                </tr>
              </thead>
              <tbody>
                {[...historyWithChange].reverse().map((row) => {
                  const isUp = (row.changePct ?? 0) > 0
                  const isDown = (row.changePct ?? 0) < 0
                  return (
                    <tr key={row.id} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                      <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                        {new Date(row.effective_at).toLocaleDateString('ar-IQ')}
                      </td>
                      <td className="px-4 py-3 font-satoshi text-brand-text">{row.supplier?.name_ar ?? '—'}</td>
                      <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{row.unit_cost.toFixed(3)}</td>
                      <td className={`px-4 py-3 text-end font-satoshi tabular-nums font-semibold ${isUp ? 'text-brand-error' : isDown ? 'text-green-400' : 'text-brand-muted'}`}>
                        {row.changePct === null
                          ? '—'
                          : `${isUp ? '+' : ''}${row.changePct.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
