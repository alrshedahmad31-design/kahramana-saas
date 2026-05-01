import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import POStatusTimeline from '@/components/inventory/POStatusTimeline'
import POReceiveForm from '@/components/inventory/POReceiveForm'
import { receivePurchaseOrder } from './actions'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function PODetailPage({ params }: PageProps) {
  const { locale, id: poId } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(
      `id, branch_id, status, expected_at, received_at, notes, is_auto_generated, created_at,
       supplier:suppliers(id, name_ar, name_en, phone),
       branch:branches(name_ar),
       purchase_order_items(
         id, ingredient_id, quantity_ordered, quantity_received, unit_cost,
         lot_number, expiry_date, quality_rating, discrepancy_note,
         ingredient:ingredients(name_ar, name_en, unit)
       )`,
    )
    .eq('id', poId)
    .single()

  if (error || !po) notFound()

  type POItem = {
    id: string
    ingredient_id: string
    quantity_ordered: number
    quantity_received: number
    unit_cost: number
    lot_number: string | null
    expiry_date: string | null
    quality_rating: number | null
    discrepancy_note: string | null
    ingredient: { name_ar: string; name_en: string; unit: string } | null
  }

  interface PODetail {
    id: string
    branch_id: string
    status: string
    expected_at: string | null
    received_at: string | null
    notes: string | null
    is_auto_generated: boolean | null
    created_at: string
    supplier: { id: string; name_ar: string; name_en: string | null; phone: string | null } | null
    branch: { name_ar: string } | null
    purchase_order_items: POItem[]
  }

  const typedPO = po as unknown as PODetail
  const supplier = typedPO.supplier
  const branch   = typedPO.branch

  const totalOrdered = typedPO.purchase_order_items.reduce(
    (s: number, i: POItem) => s + i.quantity_ordered * i.unit_cost,
    0,
  )
  const totalReceived = typedPO.purchase_order_items.reduce(
    (s: number, i: POItem) => s + i.quantity_received * i.unit_cost,
    0,
  )

  const canReceive = ['draft', 'sent', 'confirmed', 'partial'].includes(typedPO.status)

  const STATUS_LABEL_AR: Record<string, string> = {
    draft:     'مسودة',
    sent:      'مُرسَل',
    confirmed: 'مؤكَّد',
    partial:   'مستلم جزئياً',
    received:  'مستلم',
    cancelled: 'ملغي',
  }

  const STATUS_BADGE: Record<string, string> = {
    draft:     'bg-brand-surface-2 text-brand-muted',
    sent:      'bg-blue-500/10 text-blue-400',
    confirmed: 'bg-brand-gold/10 text-brand-gold',
    partial:   'bg-orange-500/10 text-orange-400',
    received:  'bg-green-500/10 text-green-400',
    cancelled: 'bg-red-500/10 text-red-400',
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-cairo text-2xl font-black text-brand-text font-mono">
              {typedPO.id.slice(0, 8).toUpperCase()}
            </h1>
            {typedPO.is_auto_generated && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium bg-brand-gold/10 text-brand-gold">
                {isAr ? 'تلقائي' : 'Auto'}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${STATUS_BADGE[typedPO.status] ?? 'bg-brand-surface-2 text-brand-muted'}`}
            >
              {isAr ? STATUS_LABEL_AR[typedPO.status] ?? typedPO.status : typedPO.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 mt-1">
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'المورد:' : 'Supplier:'}{' '}
              <span className="text-brand-text">
                {isAr ? supplier?.name_ar : supplier?.name_en ?? supplier?.name_ar ?? '—'}
              </span>
            </p>
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'الفرع:' : 'Branch:'}{' '}
              <span className="text-brand-text">{branch?.name_ar ?? typedPO.branch_id}</span>
            </p>
            {typedPO.expected_at && (
              <p className="font-satoshi text-sm text-brand-muted">
                {isAr ? 'التسليم المتوقع:' : 'Expected:'}{' '}
                <span className="text-brand-text">
                  {new Date(typedPO.expected_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}
                </span>
              </p>
            )}
            {supplier?.phone && (
              <p className="font-satoshi text-sm text-brand-muted">
                {isAr ? 'هاتف:' : 'Phone:'}{' '}
                <span className="text-brand-text">{supplier.phone}</span>
              </p>
            )}
          </div>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/purchases`}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
        >
          {isAr ? '← رجوع' : '← Back'}
        </Link>
      </div>

      {/* Status timeline */}
      <POStatusTimeline status={typedPO.status} locale={locale} />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'إجمالي الطلب' : 'Total Ordered'}
          </p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">
            {totalOrdered.toFixed(3)} BD
          </p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'إجمالي المستلم' : 'Total Received'}
          </p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">
            {totalReceived.toFixed(3)} BD
          </p>
        </div>
      </div>

      {/* Receive form or read-only table */}
      {canReceive ? (
        <POReceiveForm
          poId={typedPO.id}
          items={typedPO.purchase_order_items.map((item) => ({
            id:                item.id,
            ingredient_name_ar: (item.ingredient as { name_ar: string; name_en: string; unit: string } | null)?.name_ar ?? item.ingredient_id,
            unit:              (item.ingredient as { name_ar: string; name_en: string; unit: string } | null)?.unit ?? '',
            quantity_ordered:  item.quantity_ordered,
            quantity_received: item.quantity_received,
            unit_cost:         item.unit_cost,
            lot_number:        item.lot_number,
            expiry_date:       item.expiry_date,
            quality_rating:    item.quality_rating,
          }))}
          locale={locale}
          receiveAction={receivePurchaseOrder}
        />
      ) : (
        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'المكوّن' : 'Ingredient'}
                </th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'مطلوب' : 'Ordered'}
                </th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'مستلم' : 'Received'}
                </th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'تكلفة/وحدة' : 'Unit Cost'}
                </th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'رقم الدفعة' : 'Lot #'}
                </th>
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'تاريخ الانتهاء' : 'Expiry'}
                </th>
              </tr>
            </thead>
            <tbody>
              {typedPO.purchase_order_items.map((item) => {
                const ingr = item.ingredient as { name_ar: string; name_en: string; unit: string } | null
                return (
                  <tr key={item.id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                      {isAr ? ingr?.name_ar : ingr?.name_en ?? ingr?.name_ar}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {item.quantity_ordered} {ingr?.unit}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                      {item.quantity_received} {ingr?.unit}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {item.unit_cost.toFixed(3)} BD
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {item.lot_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                      {item.expiry_date
                        ? new Date(item.expiry_date).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')
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
