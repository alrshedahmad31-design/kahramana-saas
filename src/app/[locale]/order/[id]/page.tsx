import { SIZE_LABELS } from '@/lib/cart'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { Link } from '@/i18n/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { getSession } from '@/lib/auth/session'
import { verifyOrderAccessToken } from '@/lib/auth/order-access'
import type { OrderWithItems } from '@/lib/supabase/custom-types'
import { formatPrice } from '@/lib/format'
import { BRANCHES } from '@/constants/contact'
import OrderTrackingStatus from '@/components/orders/OrderTrackingStatus'
import ReorderButton from '@/components/orders/ReorderButton'

// ── Metadata ──────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams?: Promise<{ t?: string }>
}


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'order' })
  return {
    title:  t('title'),
    robots: { index: false },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { locale, id } = await params
  const accessToken = (await searchParams)?.t ?? null
  const isAr = locale === 'ar'
  const t     = await getTranslations('order')

  // Validate UUID format before querying
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) notFound()

  // Fetch order using service role (bypasses RLS — guest orders are unauthed).
  // T1-5: explicit allowlist on both `orders` and `order_items` so this
  // guest-readable surface never serves staff-only fields (driver_notes,
  // actual_collected, cash_handed_over, handed_over_at, delivery_proof_url,
  // customer_signature, etc). Whitelist matches exactly what
  // OrderTrackingStatus + ReorderButton + the page body render.
  let order: OrderWithItems | null = null
  let branchEstimatedMinutes: number | null = null
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, status, order_type, branch_id, customer_name, customer_phone, total_bhd, notes, created_at, updated_at, delivery_lat, delivery_lng, order_items(id, menu_item_slug, name_ar, name_en, quantity, selected_size, selected_variant, notes, unit_price_bhd, item_total_bhd)'
      )
      .eq('id', id)
      .single()

    if (!error && data) {
      order = data as unknown as OrderWithItems
      const { data: branchSla } = await supabase
        .from('branches')
        .select('estimated_minutes')
        .eq('id', data.branch_id)
        .maybeSingle()

      branchEstimatedMinutes = branchSla?.estimated_minutes ?? null
    }
  } catch {
    // Supabase not configured — show generic confirmation below
  }

  if (order) {
    const staff = await getSession()
    const customer = await getCustomerSession()
    const isAuthorized =
      Boolean(staff?.role) ||
      verifyOrderAccessToken(id, accessToken) ||
      Boolean(customer?.phone && order.customer_phone && customer.phone === order.customer_phone)

    if (!isAuthorized) notFound()
  }

  const nonce   = (await headers()).get('x-nonce') ?? undefined
  const shortId = id.slice(-8).toUpperCase()
  const branch  = order ? BRANCHES[order.branch_id as keyof typeof BRANCHES] ?? null : null


  const schemaOrg = order
    ? {
        '@context': 'https://schema.org',
        '@type': 'Order',
        orderNumber: shortId,
        orderStatus: 'https://schema.org/OrderProcessing',
        merchant: { '@type': 'Restaurant', name: 'كهرمانة بغداد' },
        priceCurrency: 'BHD',
        price: order.total_bhd.toFixed(3),
      }
    : null


  return (
    <div className="min-h-screen bg-brand-black">
      {schemaOrg && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      )}

      <div className="px-4 sm:px-6 pt-10 pb-16 max-w-2xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>

        {/* ── Success icon ──────────────────────────────────────────── */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-xl bg-brand-gold/15 border border-brand-gold/40
                          flex items-center justify-center">
            <CheckmarkIcon />
          </div>
        </div>

        {/* ── Headline ──────────────────────────────────────────────── */}
        <div className={`text-center mb-8 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          <h1 className={`text-2xl sm:text-3xl font-black text-brand-text mb-2
            ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {t('title')}
          </h1>
          <p className="font-almarai text-brand-muted">
            {t('subtitle')}
          </p>
        </div>

        {/* ── Order card ────────────────────────────────────────────── */}
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden mb-6">

          {order ? (
            <OrderTrackingStatus
              initialOrder={order}
              branchEstimatedMinutes={branchEstimatedMinutes}
              locale={locale}
            />
          ) : (
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
              <div className="text-start">
                <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-0.5
                  ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('orderNumber')}
                </p>
                <p className="font-satoshi font-bold text-brand-text text-xl tabular-nums">
                  #{shortId}
                </p>
              </div>
            </div>
          )}

          {/* Branch */}
          {branch && (
            <div className="flex items-center gap-3 px-5 py-3 border-b border-brand-border text-start">
              <BranchIcon />
              <div>
                <p className={`text-sm font-bold text-brand-text
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {isAr ? branch.nameAr : branch.nameEn}
                </p>
                <p className="font-almarai text-xs text-brand-muted mt-0.5">
                  {isAr ? branch.hours.ar : branch.hours.en}
                </p>
              </div>
            </div>
          )}

          {/* Customer name/phone */}
          {(order?.customer_name || order?.customer_phone) && (
            <div className="px-5 py-3 border-b border-brand-border text-start">
              {order?.customer_name && (
                <p className={`text-sm font-bold text-brand-text
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {order.customer_name}
                </p>
              )}
              {order?.customer_phone && (
                <p className="font-satoshi text-xs text-brand-muted mt-0.5 tabular-nums" dir="ltr">
                  {order.customer_phone}
                </p>
              )}
            </div>
          )}

          {/* Order items */}
              {order?.order_items && order.order_items.length > 0 && (
                <div className="divide-y divide-brand-border">
                  {order.order_items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="text-start">
                    <p className={`text-sm font-bold text-brand-text
                      ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                      {isAr ? item.name_ar : item.name_en}
                      <span className="ms-1.5 font-normal text-brand-muted">×{item.quantity}</span>
                    </p>
                    {(item.selected_size || item.selected_variant) && (
                      <p className="font-almarai text-xs text-brand-muted mt-0.5">
                        {[(item.selected_size ? (SIZE_LABELS[item.selected_size]?.[isAr ? 'ar' : 'en'] ?? item.selected_size) : null), item.selected_variant].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="font-almarai text-xs text-brand-muted mt-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-satoshi text-sm text-brand-gold tabular-nums shrink-0">
                    {formatPrice(item.item_total_bhd, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          {order && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-brand-border bg-brand-surface-2">
              <span className={`text-sm font-bold text-brand-muted
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('totalLabel')}
              </span>
              <span className="font-satoshi font-bold text-brand-text text-xl tabular-nums">
                {formatPrice(order?.total_bhd ?? 0, locale)}
              </span>
            </div>
          )}

          {/* Notes */}
          {order?.notes && (
            <div className="px-5 py-3 border-t border-brand-border text-start">
              <p className={`text-xs font-bold text-brand-muted mb-1 uppercase tracking-wide
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('notesLabel')}
              </p>
              <p className="font-almarai text-sm text-brand-muted">{order.notes}</p>
            </div>
          )}
        </div>

        {/* ── Reorder ───────────────────────────────────────────────── */}
        {order?.order_items && order.order_items.length > 0 && (
          <ReorderButton
            isRTL={isAr}
            items={order.order_items.map((oi) => ({
              menu_item_slug:   oi.menu_item_slug,
              name_ar:          oi.name_ar,
              name_en:          oi.name_en,
              quantity:         oi.quantity,
              selected_size:    oi.selected_size,
              selected_variant: oi.selected_variant,
              notes:            oi.notes,
              unit_price_bhd:   oi.unit_price_bhd,
            }))}
          />
        )}

        {/* ── WhatsApp CTA ──────────────────────────────────────────── */}
        {branch && (
          <a
            href={branch.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full
                       bg-brand-gold text-brand-black
                       font-satoshi font-bold text-base
                       py-4 rounded-lg mb-3
                       hover:bg-brand-gold-light active:bg-brand-gold-dark
                       transition-colors duration-150"
          >
            <WhatsAppIcon />
            {t('contactBranchWhatsapp')}
          </a>
        )}

        {/* ── Continue shopping ─────────────────────────────────────── */}
        <Link
          href="/menu"
          className={`flex items-center justify-center gap-1 w-full
                     border border-brand-border text-brand-muted
                     font-satoshi font-medium text-sm
                     py-3.5 rounded-lg
                     hover:border-brand-gold hover:text-brand-gold
                     transition-colors duration-150`}
        >
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
         width={28} height={28} aria-hidden="true" className="text-brand-gold">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function BranchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         width={18} height={18} aria-hidden="true" className="text-brand-muted shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
