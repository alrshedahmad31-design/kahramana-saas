import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { translateUnit } from '@/lib/inventory/units'
import OpeningBalanceModal from '@/components/inventory/OpeningBalanceModal'
import { recordOpeningBalance } from './actions'

interface PageProps {
  params: Promise<{ locale: string; branchId: string }>
  searchParams: Promise<{ search?: string; category?: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

interface StockWithIngredient {
  id: string
  on_hand: number
  reserved: number
  catering_reserved: number
  last_movement_at: string | null
  ingredient: {
    id: string
    name_ar: string
    name_en: string
    unit: string
    cost_per_unit: number
    category: string | null
    reorder_point: number | null
    is_active: boolean
  } | null
}

function rowBgClass(available: number, reorderPoint: number | null): string {
  if (available <= 0) return 'bg-red-500/5'
  if (reorderPoint !== null && available <= reorderPoint) return 'bg-brand-gold/5'
  return ''
}

function availableTextClass(available: number, reorderPoint: number | null): string {
  if (available <= 0) return 'text-red-400 font-semibold'
  if (reorderPoint !== null && available <= reorderPoint) return 'text-brand-gold font-semibold'
  return 'text-brand-text'
}

export default async function BranchStockPage({ params, searchParams }: PageProps) {
  const { locale, branchId } = await params
  const { search, category } = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [branchResult, stockResult, allIngredientsResult] = await Promise.all([
    supabase.from('branches').select('id,name_ar,name_en').eq('id', branchId).single(),
    supabase
      .from('inventory_stock')
      .select('id,on_hand,reserved,catering_reserved,last_movement_at,ingredient:ingredients(id,name_ar,name_en,unit,cost_per_unit,category,reorder_point,is_active)')
      .eq('branch_id', branchId)
      .order('ingredient(name_ar)'),
    supabase
      .from('ingredients')
      .select('id,name_ar,name_en,unit')
      .eq('is_active', true)
      .order('name_ar'),
  ])

  if (branchResult.error || !branchResult.data) {
    notFound()
  }

  const branch = branchResult.data
  let stockRows = (stockResult.data ?? []) as StockWithIngredient[]

  // Client-side filtering (search/category)
  if (search) {
    stockRows = stockRows.filter((r) =>
      r.ingredient?.name_ar.includes(search) ||
      r.ingredient?.name_en?.toLowerCase().includes(search.toLowerCase())
    )
  }
  if (category) {
    stockRows = stockRows.filter((r) => r.ingredient?.category === category)
  }

  const allIngredients = (allIngredientsResult.data ?? []) as {
    id: string; name_ar: string; name_en: string; unit: string
  }[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`${prefix}/dashboard/inventory/stock`}
              className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors"
            >
              {isAr ? 'المخزون' : 'Stock'}
            </Link>
            <span className="text-brand-muted">/</span>
            <span className="font-satoshi text-sm text-brand-text">
              {isAr ? branch.name_ar : (branch.name_en ?? branch.name_ar)}
            </span>
          </div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? branch.name_ar : (branch.name_en ?? branch.name_ar)}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {stockRows.length} {isAr ? 'مكوّن في المخزون' : 'ingredients in stock'}
          </p>
        </div>
        {allIngredients.length > 0 && (
          <OpeningBalanceModal
            branchId={branchId}
            ingredients={allIngredients}
            locale={locale}
            recordAction={recordOpeningBalance}
          />
        )}
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder={isAr ? 'بحث...' : 'Search...'}
          className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none w-48"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-surface-2 border border-brand-border px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          {isAr ? 'بحث' : 'Search'}
        </button>
      </form>

      {/* Table */}
      {stockRows.length === 0 ? (
        <div className="border border-brand-border rounded-xl p-12 text-center">
          <p className="font-satoshi text-brand-muted">
            {isAr ? 'لا توجد بيانات مخزون لهذا الفرع' : 'No stock data for this branch'}
          </p>
        </div>
      ) : (
        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الوحدة' : 'Unit'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'في المخزن' : 'On Hand'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'محجوز' : 'Reserved'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'المتاح' : 'Available'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'نقطة الإعادة' : 'Reorder Pt.'}</th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'آخر حركة' : 'Last Move'}</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row) => {
                const available = row.on_hand - row.reserved - row.catering_reserved
                const reorderPoint = row.ingredient?.reorder_point ?? null
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-brand-border transition-colors hover:bg-brand-surface-2 ${rowBgClass(available, reorderPoint)}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-satoshi text-sm font-medium text-brand-text">{row.ingredient?.name_ar ?? '—'}</p>
                      <p className="font-satoshi text-xs text-brand-muted">{row.ingredient?.name_en ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">{translateUnit(row.ingredient?.unit, isAr)}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{row.on_hand}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{row.reserved}</td>
                    <td className={`px-4 py-3 font-satoshi text-sm ${availableTextClass(available, reorderPoint)}`}>
                      {available}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{reorderPoint ?? '—'}</td>
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                      {row.last_movement_at
                        ? new Date(row.last_movement_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

