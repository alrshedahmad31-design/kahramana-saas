import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
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
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const t = await getTranslations('inventory.valuation')
  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const branchFilter = sp.branch ?? 'all'

  const supabase = await createClient()
  const [{ data: valuation }, { data: branches }] = await Promise.all([
    supabase.from('v_inventory_valuation').select('*').order('total_value_bhd', { ascending: false }),
    supabase.from('branches').select('id, name_ar, name_en').eq('is_active', true),
  ])

  // v_inventory_valuation is branch+category aggregated view
  const safeData = (valuation ?? []) as unknown as InventoryValuationRow[]
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
    const cat = r.category ?? (isAr ? 'غير محدد' : 'Uncategorized')
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Number(r.total_value_bhd ?? 0))
  }

  const pieData = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const exportRows = filtered.map((r) => ({
    branch_id: r.branch_id ?? '',
    branch_name: isAr ? r.branch_name_ar : (r.branch_name_en || r.branch_name_ar),
    category: r.category ?? '',
    ingredient_count: r.ingredient_count ?? 0,
    total_value_bhd: Number(r.total_value_bhd ?? 0).toFixed(3),
    reserved_value_bhd: Number(r.reserved_value_bhd ?? 0).toFixed(3),
  }))
  const exportColumns = [
    { key: 'branch_name', header: isAr ? 'الفرع' : 'Branch' },
    { key: 'category', header: isAr ? 'الفئة' : 'Category' },
    { key: 'ingredient_count', header: isAr ? 'عدد الأصناف' : 'Items' },
    { key: 'total_value_bhd', header: isAr ? 'القيمة الإجمالية BD' : 'Total Value BHD' },
    { key: 'reserved_value_bhd', header: isAr ? 'المحجوز BD' : 'Reserved BHD' },
  ]

  return (
    <div className="space-y-6">
      <ReportHeader
        title={t('title')}
        description={isAr ? 'القيمة الإجمالية للمخزون مقسّمة حسب الفئة والفرع' : 'Total stock value by category and branch'}
        locale={locale}
        actions={<ExportButton rows={exportRows} columns={exportColumns} filename="inventory-valuation" exportAction={exportToExcel} />}
      />

      {/* Branch filter */}
      {isGlobal && (
        <form method="GET" className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
          <label className="font-cairo text-xs text-brand-muted">{isAr ? 'الفرع:' : 'Branch:'}</label>
          <select
            name="branch"
            defaultValue={branchFilter}
            className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-cairo text-xs text-brand-text focus:border-brand-gold focus:outline-none"
          >
            <option value="all">{isAr ? 'كل الفروع' : 'All branches'}</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.name_ar : (b.name_en || b.name_ar)}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-brand-gold px-4 py-1.5 font-cairo text-xs font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors">
            {isAr ? 'تطبيق' : 'Apply'}
          </button>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('totalValue')} value={`BHD ${totalValue.toFixed(3)}`} highlight />
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
              <div key={branchId} className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <p className="font-cairo text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? branch?.name_ar : (branch?.name_en || branch?.name_ar)}
                </p>
                <p className="font-satoshi text-xl font-black text-brand-text mt-1 tabular-nums">BHD {val.toFixed(3)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Chart + category summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pieData.length > 0 && <ValuationPieChart data={pieData} />}

        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border">
            <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'القيمة حسب الفئة' : 'Value by Category'}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface-2">
                <th className="px-4 py-3 text-start font-cairo text-xs font-semibold text-brand-muted">{isAr ? 'الفئة' : 'Category'}</th>
                <th className="px-4 py-3 text-end font-cairo text-xs font-semibold text-brand-muted">{isAr ? 'القيمة BHD' : 'Value BHD'}</th>
                <th className="px-4 py-3 text-end font-cairo text-xs font-semibold text-brand-muted">%</th>
              </tr>
            </thead>
            <tbody>
              {pieData.map((item) => (
                <tr key={item.name} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-cairo text-brand-text">{item.name}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{item.value.toFixed(3)}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">
                    {totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed rows */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border">
          <h3 className="font-cairo text-sm font-black text-brand-text">{isAr ? 'التفاصيل' : 'Details'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface-2">
                <th className="px-4 py-3 text-start font-cairo text-xs font-semibold text-brand-muted">{t('branch')}</th>
                <th className="px-4 py-3 text-start font-cairo text-xs font-semibold text-brand-muted">{t('category')}</th>
                <th className="px-4 py-3 text-end font-cairo text-xs font-semibold text-brand-muted">{isAr ? 'الأصناف' : 'Items'}</th>
                <th className="px-4 py-3 text-end font-cairo text-xs font-semibold text-brand-muted">{t('totalValue')}</th>
                <th className="px-4 py-3 text-end font-cairo text-xs font-semibold text-brand-muted">{t('reserved')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-brand-border/30 hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-cairo text-brand-muted text-xs">
                    {isAr ? r.branch_name_ar : (r.branch_name_en || r.branch_name_ar)}
                  </td>
                  <td className="px-4 py-3 font-cairo text-brand-text">{r.category ?? (isAr ? 'غير محدد' : 'Uncategorized')}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{r.ingredient_count}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{Number(r.total_value_bhd ?? 0).toFixed(3)}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{Number(r.reserved_value_bhd ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

