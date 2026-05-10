import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
import { translateUnit } from '@/lib/inventory/units'
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
  supplier: { name_ar: string; name_en: string } | null
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function PriceHistoryPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inventory.reports.priceHistory' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const sp = await searchParams
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const ingredientId = sp.ingredient ?? null
  const supabase = await createClient()

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name_ar, name_en, unit')
    .eq('is_active', true)
    .order('name_ar')

  const { data: rawHistory } = ingredientId
    ? await supabase
        .from('supplier_price_history')
        .select('id, unit_cost, effective_at, supplier:suppliers(name_ar, name_en)')
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
  const trend = prices.length > 1 ? (prices[prices.length - 1] > prices[prices.length - 2] ? 'down' : 'up') : 'neutral'

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
      />

      {/* Ingredient selector */}
      <form method="GET" className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center gap-3">
          <label className={`${font} text-xs text-brand-muted font-bold uppercase tracking-wider`}>{t('selectIngredient')}</label>
          <select
            name="ingredient"
            defaultValue={ingredientId ?? ''}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none min-w-48 transition-colors`}
          >
            <option value="">{t('selectPlaceholder')}</option>
            {(ingredients ?? []).map((ing) => (
              <option key={ing.id} value={ing.id}>{isAr ? ing.name_ar : ing.name_en} ({translateUnit(ing.unit ?? '', isAr)})</option>
            ))}
          </select>
        </div>
        <button type="submit" className={`rounded-lg bg-brand-gold px-6 py-1.5 ${font} text-xs font-black text-brand-black hover:bg-brand-gold/90 transition-all shadow-sm active:scale-95`}>
          {t('view')}
        </button>
      </form>

      {!ingredientId ? (
        <EmptyReport
          title={t('emptyTitle')}
          description={t('emptyDesc')}
        />
      ) : history.length === 0 ? (
        <EmptyReport
          title={t('noDataTitle')}
          description={t('noDataDesc', { name: isAr ? selectedIngredient?.name_ar : selectedIngredient?.name_en })}
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label={`${t('currentPrice')}`} value={`${currentPrice.toFixed(3)} ${currency}`} highlight trend={trend} />
            <StatCard label={`${t('avgPrice')}`} value={`${avgPrice.toFixed(3)} ${currency}`} />
            <StatCard label={`${t('minPrice')}`} value={`${minPrice.toFixed(3)} ${currency}`} />
            <StatCard label={`${t('maxPrice')}`} value={`${maxPrice.toFixed(3)} ${currency}`} />
          </div>

          {/* Chart */}
          <PriceHistoryChart history={history} />

          <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface shadow-sm hover:shadow-md transition-all">
            <table className="w-full text-start">
              <thead>
                <tr className="bg-brand-surface-2/50">
                  <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('date')}</th>
                  <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('supplier')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{tCommon('price')} ({currency})</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('change')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/30">
                {[...historyWithChange].reverse().map((row) => {
                  const isUp = (row.changePct ?? 0) > 0
                  const isDown = (row.changePct ?? 0) < 0
                  const dateStr = new Date(row.effective_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')
                  const supplierName = (isAr ? row.supplier?.name_ar : row.supplier?.name_en) ?? '—'
                  return (
                    <tr key={row.id} className="hover:bg-brand-surface-2 transition-colors group">
                      <td className={`px-5 py-4 ${font} text-xs text-brand-muted font-bold tabular-nums`}>
                        {dateStr}
                      </td>
                      <td className={`px-5 py-4 ${font} text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors`}>{supplierName}</td>
                      <td className={`px-5 py-4 text-end font-satoshi text-sm font-black tabular-nums text-brand-gold`}>{row.unit_cost.toFixed(3)}</td>
                      <td className={`px-5 py-4 text-end font-satoshi text-sm font-black tabular-nums ${isUp ? 'text-brand-error' : isDown ? 'text-brand-success' : 'text-brand-muted'}`}>
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
