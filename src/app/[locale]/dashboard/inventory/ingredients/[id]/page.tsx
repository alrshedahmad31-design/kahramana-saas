import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { InventoryMovementType, IngredientRow } from '@/lib/supabase/custom-types'
import IngredientForm from '@/components/inventory/IngredientForm'
import { upsertIngredient } from './actions'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

function movementBadge(type: InventoryMovementType | string) {
  const colors: Record<string, string> = {
    purchase: 'bg-green-500/10 text-green-400',
    consumption: 'bg-red-500/10 text-red-400',
    waste: 'bg-red-500/10 text-red-400',
    count_adjust: 'bg-blue-500/10 text-blue-400',
    opening_balance: 'bg-brand-gold/10 text-brand-gold',
    adjustment: 'bg-blue-500/10 text-blue-400',
    reservation: 'bg-brand-gold/10 text-brand-gold',
    release: 'bg-green-500/10 text-green-400',
  }
  return colors[type] ?? 'bg-brand-surface-2 text-brand-muted'
}

export default async function IngredientDetailPage({ params }: PageProps) {
  const { locale, id } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [
    ingredientResult,
    allergensResult,
    priceHistoryResult,
    movementsResult,
    suppliersResult,
  ] = await Promise.all([
    supabase.from('ingredients').select('*').eq('id', id).single(),
    supabase.from('ingredient_allergens').select('allergen').eq('ingredient_id', id),
    supabase
      .from('supplier_price_history')
      .select('unit_cost, effective_at')
      .eq('ingredient_id', id)
      .order('effective_at', { ascending: false })
      .limit(10),
    supabase
      .from('inventory_movements')
      .select('id, movement_type, quantity, performed_at, branch_id, notes')
      .eq('ingredient_id', id)
      .order('performed_at', { ascending: false })
      .limit(20),
    supabase
      .from('suppliers')
      .select('id, name_ar, name_en')
      .eq('is_active', true)
      .order('name_ar'),
  ])

  if (ingredientResult.error || !ingredientResult.data) {
    notFound()
  }

  const ingredient = ingredientResult.data
  const allergens = (allergensResult.data ?? []).map((a: { allergen: string }) => a.allergen)
  const priceHistory = priceHistoryResult.data ?? []
  const movements = movementsResult.data ?? []

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`${prefix}/dashboard/inventory/ingredients`}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors"
          >
            {isAr ? 'المكونات' : 'Ingredients'}
          </Link>
          <span className="text-brand-muted">/</span>
          <span className="font-satoshi text-sm text-brand-text">{ingredient.name_ar}</span>
        </div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">{ingredient.name_ar}</h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">{ingredient.name_en}</p>
      </div>

      {/* Edit Form */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <h2 className="font-cairo text-lg font-black text-brand-text mb-4">
          {isAr ? 'تعديل المكوّن' : 'Edit Ingredient'}
        </h2>
        <IngredientForm
          ingredient={{ ...(ingredient as unknown as IngredientRow), allergens }}
          suppliers={suppliersResult.data ?? []}
          locale={locale}
          action={upsertIngredient}
        />
      </div>

      {/* Price History */}
      {priceHistory.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
          <h2 className="font-cairo text-lg font-black text-brand-text mb-4">
            {isAr ? 'سجل الأسعار' : 'Price History'}
          </h2>
          <div className="border border-brand-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-surface-2">
                <tr>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'التكلفة / وحدة' : 'Cost / Unit'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'التاريخ' : 'Date'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((ph, i) => (
                  <tr key={i} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3 font-satoshi text-sm font-medium text-brand-gold">
                      {Number(ph.unit_cost).toFixed(3)} BD
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {ph.effective_at ? new Date(ph.effective_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Movements */}
      {movements.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
          <h2 className="font-cairo text-lg font-black text-brand-text mb-4">
            {isAr ? 'آخر الحركات' : 'Recent Movements'}
          </h2>
          <div className="border border-brand-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-surface-2">
                <tr>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'النوع' : 'Type'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'الكمية' : 'Quantity'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'الفرع' : 'Branch'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'التاريخ' : 'Date'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${movementBadge(m.movement_type)}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{m.quantity}</td>
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">{m.branch_id ?? '—'}</td>
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                      {m.performed_at ? new Date(m.performed_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

