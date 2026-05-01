import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { InventoryValuationRow } from '@/lib/supabase/custom-types'

interface PageProps {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export default async function StockPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [valuationResult, branchesResult] = await Promise.all([
    supabase.from('v_inventory_valuation').select('*').order('branch_id'),
    supabase.from('branches').select('id,name_ar,name_en').eq('is_active', true).order('name_ar'),
  ])

  const valuation = (valuationResult.data ?? []) as InventoryValuationRow[]
  const branches = branchesResult.data ?? []

  // Group valuation by branch
  const byBranch = new Map<string, InventoryValuationRow[]>()
  for (const row of valuation) {
    const list = byBranch.get(row.branch_id) ?? []
    list.push(row)
    byBranch.set(row.branch_id, list)
  }

  // Aggregate per branch
  const branchSummary = branches.map((b) => {
    const rows = byBranch.get(b.id) ?? []
    const totalValue = rows.reduce((s, r) => s + (r.total_value_bhd ?? 0), 0)
    const ingredientCount = rows.reduce((s, r) => s + (r.ingredient_count ?? 0), 0)
    return { ...b, totalValue, ingredientCount, rows }
  }).filter((b) => b.rows.length > 0)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'مستويات المخزون' : 'Stock Levels'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr ? 'تقييم المخزون حسب الفرع' : 'Inventory valuation by branch'}
        </p>
      </div>

      {/* Branch Cards */}
      {branchSummary.length === 0 ? (
        <div className="border border-brand-border rounded-xl p-12 text-center">
          <p className="font-satoshi text-brand-muted">
            {isAr ? 'لا توجد بيانات مخزون' : 'No stock data found'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branchSummary.map((branch) => (
              <Link
                key={branch.id}
                href={`${prefix}/dashboard/inventory/stock/${branch.id}`}
                className="group bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-gold transition-colors"
              >
                <p className="font-cairo text-base font-black text-brand-text group-hover:text-brand-gold transition-colors">
                  {isAr ? branch.name_ar : (branch.name_en ?? branch.name_ar)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'القيمة' : 'Value'}
                    </p>
                    <p className="font-cairo text-lg font-black text-brand-gold">
                      {branch.totalValue.toFixed(3)}
                    </p>
                    <p className="font-satoshi text-xs text-brand-muted">BD</p>
                  </div>
                  <div>
                    <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'المكونات' : 'Ingredients'}
                    </p>
                    <p className="font-cairo text-lg font-black text-brand-text">
                      {branch.ingredientCount}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Valuation Table by Category */}
          {valuation.length > 0 && (
            <div>
              <h2 className="font-cairo text-lg font-black text-brand-text mb-3">
                {isAr ? 'تفصيل حسب الفئة' : 'Breakdown by Category'}
              </h2>
              <div className="border border-brand-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-brand-surface-2">
                    <tr>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الفرع' : 'Branch'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الفئة' : 'Category'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'المكونات' : 'Count'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'القيمة الإجمالية' : 'Total Value'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'القيمة المحجوزة' : 'Reserved Value'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuation.map((row, i) => (
                      <tr key={i} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{row.branch_name}</td>
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{row.category ?? (isAr ? 'غير محدد' : 'Uncategorized')}</td>
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{row.ingredient_count}</td>
                        <td className="px-4 py-3 font-satoshi text-sm font-medium text-brand-gold">
                          {Number(row.total_value_bhd).toFixed(3)} BD
                        </td>
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                          {Number(row.reserved_value_bhd).toFixed(3)} BD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
