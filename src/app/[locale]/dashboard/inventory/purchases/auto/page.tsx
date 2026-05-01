import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AutoPOActions from './AutoPOActions'
import { updatePOStatus } from '../actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function AutoPOPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()

  const { data: autoPOs } = await supabase
    .from('purchase_orders')
    .select(
      `id, branch_id, expected_at, created_at,
       supplier:suppliers(name_ar),
       branch:branches(name_ar),
       purchase_order_items(
         id, ingredient_id, quantity_ordered, unit_cost,
         ingredient:ingredients(name_ar, unit)
       )`,
    )
    .eq('is_auto_generated', true)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })

  type AutoPOItem = {
    id: string
    ingredient_id: string
    quantity_ordered: number
    unit_cost: number
    ingredient: { name_ar: string; unit: string } | null
  }

  type AutoPO = {
    id: string
    branch_id: string
    expected_at: string | null
    created_at: string
    supplier: { name_ar: string } | null
    branch: { name_ar: string } | null
    purchase_order_items: AutoPOItem[]
  }

  const typedPOs = (autoPOs ?? []) as AutoPO[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'طلبات الشراء التلقائية' : 'Auto-Generated Purchase Orders'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr
              ? 'طلبات مقترحة بناءً على انخفاض المخزون'
              : 'Suggested orders based on low stock levels'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/purchases`}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
        >
          {isAr ? '← رجوع' : '← Back'}
        </Link>
      </div>

      {typedPOs.length === 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-8 text-center">
          <p className="font-satoshi text-sm text-brand-muted">
            {isAr ? 'لا توجد طلبات تلقائية معلقة' : 'No pending auto-generated orders'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {typedPOs.map((po) => {
          const supplier = po.supplier as { name_ar: string } | null
          const branchObj = po.branch as { name_ar: string } | null
          const totalValue = po.purchase_order_items.reduce(
            (sum, item) => sum + item.quantity_ordered * item.unit_cost,
            0,
          )

          return (
            <div
              key={po.id}
              className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <p className="font-cairo text-base font-bold text-brand-text">
                    {supplier?.name_ar ?? '—'}
                  </p>
                  <p className="font-satoshi text-xs text-brand-muted">
                    {branchObj?.name_ar ?? po.branch_id} ·{' '}
                    {new Date(po.created_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-satoshi text-sm text-brand-gold font-semibold">
                    {totalValue.toFixed(3)} BD
                  </span>
                  <AutoPOActions
                    poId={po.id}
                    locale={locale}
                    updateStatusAction={updatePOStatus}
                  />
                </div>
              </div>

              {/* Items list */}
              <div className="border border-brand-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-brand-surface-2">
                    <tr>
                      <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                        {isAr ? 'المكوّن' : 'Ingredient'}
                      </th>
                      <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                        {isAr ? 'الكمية' : 'Qty'}
                      </th>
                      <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                        {isAr ? 'التكلفة/وحدة' : 'Unit Cost'}
                      </th>
                      <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                        {isAr ? 'الإجمالي' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.purchase_order_items.map((item) => {
                      const ingr = item.ingredient as { name_ar: string; unit: string } | null
                      return (
                        <tr key={item.id} className="border-t border-brand-border">
                          <td className="px-3 py-2 font-satoshi text-sm text-brand-text">
                            {ingr?.name_ar ?? item.ingredient_id}
                          </td>
                          <td className="px-3 py-2 font-satoshi text-sm text-brand-muted">
                            {item.quantity_ordered} {ingr?.unit}
                          </td>
                          <td className="px-3 py-2 font-satoshi text-sm text-brand-muted">
                            {item.unit_cost.toFixed(3)} BD
                          </td>
                          <td className="px-3 py-2 font-satoshi text-sm text-brand-text">
                            {(item.quantity_ordered * item.unit_cost).toFixed(3)} BD
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
