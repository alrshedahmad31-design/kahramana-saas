import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/server'
import {
  requireDashboardSection,
  isDashboardGuardError,
  isGlobalDashboardAdmin,
} from '@/lib/auth/dashboard-guards'
import StatusBadge from '@/components/dashboard/StatusBadge'
import OrderStatusSelect from '@/components/dashboard/OrderStatusSelect'
import OrderActions from '@/components/dashboard/OrderActions'
import type { OrderRow, OrderItemRow } from '@/lib/supabase/custom-types'
import { SIZE_LABELS } from '@/lib/cart'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { locale, id } = await params
  const prefix = locale === 'en' ? '/en' : ''

  if (!UUID_RE.test(id)) notFound()

  // Section guard: only roles in `orders` SECTION_ROLES can hit /dashboard/orders/*
  // (replaces the previous getSession + canViewOrder branch-only gate).
  let user
  try {
    user = await requireDashboardSection('orders')
  } catch (e) {
    if (isDashboardGuardError(e)) redirect(`${prefix}/dashboard`)
    throw e
  }

  const t  = await getTranslations('dashboard')
  const tS = await getTranslations('order.status')
  const tC = await getTranslations('common')

  const supabase = await createServiceClient()

  // Order fetch — failures are real errors, missing rows are 404.
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderError) {
    // PGRST116 = "row not found". Treat as 404; everything else is a real failure.
    if (orderError.code === 'PGRST116') notFound()
    throw orderError
  }
  if (!orderData) notFound()
  const order = orderData as unknown as OrderRow

  // Branch scope: branch-bound staff may only view orders within their branch.
  // Fail-closed for null user.branch_id — a non-global staff session without a
  // branch is an invalid state, not a wildcard (same shape as VULN-RBAC-01).
  if (!isGlobalDashboardAdmin(user) && (!user.branch_id || user.branch_id !== order.branch_id)) {
    redirect(`${prefix}/dashboard/orders`)
  }

  // Items fetch — separate error handling so a query failure doesn't 404 the whole page.
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('id, name_ar, name_en, selected_size, selected_variant, quantity, unit_price_bhd, item_total_bhd, notes')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  if (itemsError) throw itemsError
  const items = (itemsData ?? []) as Pick<OrderItemRow, 'id' | 'name_ar' | 'name_en' | 'selected_size' | 'selected_variant' | 'quantity' | 'unit_price_bhd' | 'item_total_bhd' | 'notes'>[]

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
          {(order.notes || order.customer_notes) && (
            <div className="col-span-2">
              <dt className="font-satoshi text-brand-muted">{t('notes')}</dt>
              <dd className="font-satoshi font-medium text-brand-text mt-0.5">
                {order.customer_notes || order.notes}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Delivery Proof */}
      {order.delivery_proof_url && (
        <section className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <h2 className="font-satoshi font-semibold text-brand-text mb-4">{t('deliveryProof')}</h2>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-brand-border bg-black/20">
            <Image
              src={order.delivery_proof_url}
              alt="Delivery Proof"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
            />
            <a 
              href={order.delivery_proof_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-brand-gold hover:text-black transition-all"
            >
              {t('openInNewTab')}
            </a>
          </div>
        </section>
      )}

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
                    {[
                      item.selected_size
                        ? (SIZE_LABELS[item.selected_size]?.[isAr ? 'ar' : 'en'] ?? item.selected_size)
                        : null,
                      item.selected_variant,
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                {item.notes && (
                  <p className="mt-1 text-sm font-semibold text-red-500 bg-red-50 px-2 py-1 rounded inline-block">
                    {isAr ? 'ملاحظة: ' : 'Note: '}{item.notes}
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
