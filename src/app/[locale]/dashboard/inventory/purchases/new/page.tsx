import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import POForm from '@/components/inventory/POForm'
import { createPurchaseOrder } from '../actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function PurchaseNewPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()

  const [
    { data: suppliers },
    { data: branches },
    { data: ingredients },
    { data: lowStockRaw },
  ] = await Promise.all([
    supabase.from('suppliers').select('id, name_ar').eq('is_active', true).order('name_ar'),
    supabase.from('branches').select('id, name_ar').order('name_ar'),
    supabase
      .from('ingredients')
      .select('id, name_ar, unit, cost_per_unit, reorder_qty')
      .eq('is_active', true)
      .order('name_ar'),
    supabase.rpc('rpc_low_stock_alerts').select('*').limit(50),
  ])

  // Merge low-stock alerts with ingredient cost data
  type LowStockRow = {
    ingredient_id: string
    name_ar: string
    suggested_order: number | null
    cost_per_unit: number
  }
  const ingredientMap = new Map(
    (ingredients ?? []).map((i) => [i.id, i.cost_per_unit]),
  )
  const lowStockSuggestions: LowStockRow[] = ((lowStockRaw ?? []) as Array<{
    ingredient_id: string; name_ar: string; suggested_order: number | null
  }>).map((r) => ({
    ingredient_id:  r.ingredient_id,
    name_ar:        r.name_ar,
    suggested_order: r.suggested_order,
    cost_per_unit:  ingredientMap.get(r.ingredient_id) ?? 0,
  }))

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'إنشاء طلب شراء' : 'Create Purchase Order'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr ? 'أضف مورداً وأصناف الطلب' : 'Add a supplier and order items'}
        </p>
      </div>

      <POForm
        suppliers={suppliers ?? []}
        branches={branches ?? []}
        ingredients={(ingredients ?? []) as Array<{ id: string; name_ar: string; unit: string; cost_per_unit: number; reorder_qty: number | null }>}
        lowStockSuggestions={lowStockSuggestions}
        locale={locale}
        action={createPurchaseOrder}
      />
    </div>
  )
}
