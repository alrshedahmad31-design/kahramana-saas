import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import ReorderButton, { type ReorderItem } from '@/components/orders/ReorderButton'

interface Props {
  customerId: string
  locale:     string
}

// Last 5 orders for the signed-in customer. RLS policy
// `orders_select_own_customer` matches on customer_phone via customer_profiles,
// so the cookie-bound client is sufficient — no service-role escalation.
// We pull order_items in the same round-trip so ReorderButton has everything
// it needs without a per-row fetch.
export default async function OrderHistorySection({ customerId, locale }: Props) {
  const isAr     = locale === 'ar'
  const t        = await getTranslations({ locale, namespace: 'account.orderHistory' })
  const tStatus  = await getTranslations({ locale, namespace: 'order.status' })
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total_bhd,
      created_at,
      order_items (
        menu_item_slug,
        name_ar,
        name_en,
        quantity,
        selected_size,
        selected_variant,
        notes,
        unit_price_bhd
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  const orders = rows ?? []

  return (
    <section aria-labelledby="order-history-heading" data-customer-id={customerId}>
      <h2
        id="order-history-heading"
        className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}
      >
        {t('title')}
      </h2>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 text-center">
          <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('empty')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const shortId  = order.id.slice(-8).toUpperCase()
            // Latin digits in AR (-u-nu-latn recipe), DD MMM YYYY in EN via en-GB.
            const dateTag  = isAr ? 'ar-BH-u-nu-latn' : 'en-GB'
            const dateText = new Date(order.created_at).toLocaleDateString(dateTag, {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            // PostgREST returns NUMERIC as string — coerce before toFixed.
            const totalBhd = Number(order.total_bhd ?? 0).toFixed(3)
            const statusLabel = tStatus(order.status as Parameters<typeof tStatus>[0])

            const reorderItems: ReorderItem[] = (order.order_items ?? []).map((oi) => ({
              menu_item_slug:   oi.menu_item_slug,
              name_ar:          oi.name_ar,
              name_en:          oi.name_en,
              quantity:         oi.quantity,
              selected_size:    oi.selected_size,
              selected_variant: oi.selected_variant,
              notes:            oi.notes,
              unit_price_bhd:   oi.unit_price_bhd,
            }))

            return (
              <li
                key={order.id}
                className="rounded-2xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 text-start">
                    <p className="font-satoshi font-bold text-brand-text text-base tabular-nums">
                      #{shortId}
                    </p>
                    <p className="font-satoshi text-xs text-brand-muted tabular-nums">
                      {dateText}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5 text-end">
                    <p className="font-satoshi font-bold text-brand-gold text-base tabular-nums">
                      {totalBhd} BD
                    </p>
                    <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {statusLabel}
                    </p>
                  </div>
                </div>

                <ReorderButton items={reorderItems} isRTL={isAr} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
