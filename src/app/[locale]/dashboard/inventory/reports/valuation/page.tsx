import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
import { isHiddenBranch } from '@/constants/contact'
import type { InventoryValuationRow } from '@/lib/supabase/custom-types'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import ExportButton from '@/components/inventory/reports/ExportButton'
import { exportToExcel } from '../actions'
import ValuationPieChart from './ValuationCharts'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function ValuationPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations({ locale, namespace: 'inventory.reports.valuation' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const branchFilter = sp.branch ?? 'all'

  const supabase = await createClient()
  const [{ data: valuation }, branches] = await Promise.all([
    supabase.from('v_inventory_valuation').select('*').order('total_value_bhd', { ascending: false }),
    getActiveBranches(),
  ])

  const allData = (valuation ?? []) as unknown as InventoryValuationRow[]
  const safeData = allData.filter((r) => !isHiddenBranch(r.branch_id))

  const filtered = isGlobal && branchFilter !== 'all'
    ? safeData.filter((r) => r.branch_id === branchFilter)
    : safeData

  const totalValue = filtered.reduce((s, r) => s + Number(r.total_value_bhd ?? 0), 0)
  const totalIngredients = filtered.reduce((s, r) => s + Number(r.ingredient_count ?? 0), 0)

  // Per-branch totals
  const branchTotals = new Map<string, number>()
  for (const r of safeData) {
    const b = r.branch_id ?? 'unknown'
    branchTotals.set(b, (branchTotals.get(b) ?? 0) + Number(r.total_value_bhd ?? 0))
  }

  // Per-category totals
  const categoryTotals = new Map<string, number>()
  for (const r of filtered) {
    const cat = r.category ?? t('uncategorized')
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Number(r.total_value_bhd ?? 0))
  }

  const pieData = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const exportRows = filtered.map((r) => ({
    branch_name: isAr ? r.branch_name_ar : (r.branch_name_en || r.branch_name_ar),
    category: r.category ?? t('uncategorized'),
    ingredient_count: r.ingredient_count ?? 0,
    total_value_bhd: Number(r.total_value_bhd ?? 0).toFixed(3),
    reserved_value_bhd: Number(r.reserved_value_bhd ?? 0).toFixed(3),
  }))
  const exportColumns = [
    { key: 'branch_name', header: t('branch') },
    { key: 'category', header: t('category') },
    { key: 'ingredient_count', header: isAr ? 'الأصناف' : 'Items' },
    { key: 'total_value_bhd', header: `${t('totalValue')} ${currency}` },
    { key: 'reserved_value_bhd', header: `${t('reserved')} ${currency}` },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
        actions={<ExportButton rows={exportRows} columns={exportColumns} filename="inventory-valuation" exportAction={exportToExcel} locale={locale} />}
      />

      {/* Branch filter */}
      {isGlobal && (
        <form method="GET" className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('branch')}</span>
            <select
              name="branch"
              defaultValue={branchFilter}
              className={`rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none shadow-inner transition-all appearance-none cursor-pointer`}
            >
              <option value="all">{t('allBranches')}</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name_ar : (b.name_en || b.name_ar)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={`rounded-lg bg-brand-gold px-6 py-2 ${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-black hover:bg-brand-goldLight transition-all shadow-md active:scale-95`}>
            {t('apply')}
          </button>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('totalValue')} value={totalValue.toFixed(3)} sub={currency} highlight />
        <StatCard label={t('totalItems')} value={totalIngredients} />
        <StatCard label={t('category')} value={categoryTotals.size} />
        <StatCard label={t('branch')} value={branchTotals.size} />
      </div>

      {/* Per-branch summary */}
      {isGlobal && branchFilter === 'all' && branchTotals.size > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from(branchTotals.entries()).map(([branchId, val]) => {
            const branch = (branches ?? []).find((b) => b.id === branchId)
            return (
              <div key={branchId} className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm hover:shadow-md transition-all group">
                <p className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold group-hover:text-brand-gold transition-colors`}>
                  {isAr ? branch?.name_ar : (branch?.name_en || branch?.name_ar)}
                </p>
                <p className="font-satoshi text-2xl font-black text-brand-text mt-2 tabular-nums">
                  {val.toFixed(3)}
                  <span className={`${font} text-xs text-brand-muted font-medium ms-1`}>{currency}</span>
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Chart + category summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pieData.length > 0 && (
          <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
            <ValuationPieChart data={pieData} locale={locale} />
          </div>
        )}

        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-brand-border bg-brand-surface-2/50 backdrop-blur-sm">
            <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>{t('valueByCategory')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-brand-surface-2 border-b border-brand-border">
                <tr>
                  <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('category')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('totalValue')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/30">
                {pieData.map((item) => (
                  <tr key={item.name} className="hover:bg-brand-surface-2 transition-colors">
                    <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text`}>{item.name}</td>
                    <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">{item.value.toFixed(3)}</td>
                    <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                      {totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed rows */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-brand-border bg-brand-surface-2/50 backdrop-blur-sm">
          <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>{t('details')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-brand-surface-2 border-b border-brand-border">
              <tr>
                <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('branch')}</th>
                <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('category')}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{isAr ? 'الأصناف' : 'Items'}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('totalValue')}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('reserved')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/30">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-brand-surface-2 transition-colors group">
                  <td className={`px-5 py-3 ${font} text-xs font-bold text-brand-muted uppercase tracking-wider group-hover:text-brand-gold transition-colors`}>
                    {isAr ? r.branch_name_ar : (r.branch_name_en || r.branch_name_ar)}
                  </td>
                  <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text`}>
                    {r.category ?? t('uncategorized')}
                  </td>
                  <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{r.ingredient_count}</td>
                  <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">{Number(r.total_value_bhd ?? 0).toFixed(3)}</td>
                  <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{Number(r.reserved_value_bhd ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


