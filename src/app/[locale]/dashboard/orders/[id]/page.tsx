import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import StatusBadge from '@/components/dashboard/StatusBadge'
import OrderStatusSelect from '@/components/dashboard/OrderStatusSelect'
import OrderActions from '@/components/dashboard/OrderActions'
import type { OrderRow, OrderItemRow } from '@/lib/supabase/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { locale, id } = await params

  if (!UUID_RE.test(id)) notFound()

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  const t  = await getTranslations('dashboard')
  const tS = await getTranslations('order.status')
  const tC = await getTranslations('common')

  let order: OrderRow | null = null

  let items: Pick<OrderItemRow, 'id' | 'name_ar' | 'name_en' | 'selected_size' | 'selected_variant' | 'quantity' | 'unit_price_bhd' | 'item_total_bhd'>[] = []

  try {
    const supabase = await createServiceClient()

    const { data: orderData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !orderData) notFound()
    order = orderData as unknown as OrderRow

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('id, name_ar, name_en, selected_size, selected_variant, quantity, unit_price_bhd, item_total_bhd')
      .eq('order_id', id)
      .order('created_at', { ascending: true })

    items = (itemsData ?? []) as unknown as typeof items
  } catch {
    notFound()
  }

  if (!order) notFound()

  const isAr = locale === 'ar'

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a
            href={locale === 'en' ? '/en/dashboard/orders' : '/dashboard/orders'}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors mb-2 inline-block"
          >
            {isAr ? `${t('orders')} →` : `← ${t('orders')}`}
          </a>
          <h1 className="font-satoshi font-black text-2xl text-brand-text">
            #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-0.5">
            {new Date(order.created_at).toLocaleString(isAr ? 'ar-BH' : 'en-BH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={order.status} label={tS(order.status)} size="md" />
          <OrderActions
            orderId={order.id}
            customerName={order.customer_name}
            customerPhone={order.customer_phone}
            locale={locale}
          />
        </div>
      </div>

      {/* Status update */}
      <section className="bg-brand-surface border border-brand-border rounded-xl p-5 print:hidden">
        <p className="font-satoshi font-medium text-brand-text mb-3">{t('updateStatus')}</p>
        <OrderStatusSelect
          orderId={order.id}
          currentStatus={order.status}
          userRole={user.role}
        />
      </section>

      {/* Order info */}
      <section className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className="font-satoshi font-semibold text-brand-text mb-4">{t('orderDetails')}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="font-satoshi text-brand-muted">{t('customer')}</dt>
            <dd className="font-satoshi font-medium text-brand-text mt-0.5">
              {order.customer_name ?? t('customerGuest')}
            </dd>
          </div>
          {order.customer_phone && (
            <div>
              <dt className="font-satoshi text-brand-muted">{t('phone')}</dt>
              <dd className="font-satoshi font-medium text-brand-text mt-0.5 tabular-nums" dir="ltr">
                {order.customer_phone}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-satoshi text-brand-muted">{t('branch')}</dt>
            <dd className="font-satoshi font-medium text-brand-text mt-0.5 capitalize">
              {order.branch_id}
            </dd>
          </div>
          <div>
            <dt className="font-satoshi text-brand-muted">{t('total')}</dt>
            <dd className="font-satoshi font-medium text-brand-text mt-0.5 tabular-nums">
              {Number(order.total_bhd).toFixed(3)} {tC('currency')}
            </dd>
          </div>
          {order.notes && (
            <div className="col-span-2">
              <dt className="font-satoshi text-brand-muted">{t('notes')}</dt>
              <dd className="font-satoshi font-medium text-brand-text mt-0.5">
                {order.notes}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Order items */}
      <section className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border">
          <h2 className="font-satoshi font-semibold text-brand-text">{t('items')}</h2>
        </div>

        <div className="divide-y divide-brand-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-satoshi font-medium text-brand-text">
                  {isAr ? item.name_ar : item.name_en}
                </p>
                {(item.selected_size || item.selected_variant) && (
                  <p className="font-satoshi text-xs text-brand-muted mt-0.5">
                    {[item.selected_size, item.selected_variant].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="font-satoshi text-xs text-brand-muted tabular-nums mt-0.5">
                  {Number(item.unit_price_bhd).toFixed(3)} {tC('currency')} × {item.quantity}
                </p>
              </div>
              <p className="font-satoshi font-semibold text-brand-text tabular-nums shrink-0">
                {Number(item.item_total_bhd).toFixed(3)} {tC('currency')}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-brand-border bg-brand-surface-2">
          <span className="font-satoshi font-semibold text-brand-text">{t('total')}</span>
          <span className="font-satoshi font-black text-xl text-brand-gold tabular-nums">
            {Number(order.total_bhd).toFixed(3)} {tC('currency')}
          </span>
        </div>
      </section>
    </div>
  )
}
