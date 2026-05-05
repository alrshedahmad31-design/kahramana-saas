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
import { BRANCHES } from '@/constants/contact'
import AutoRefresh from '@/components/ui/AutoRefresh'

// ── Metadata ──────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams?: Promise<{ t?: string }>
}

type OrderEtaInput = Pick<OrderWithItems, 'order_type' | 'status'>

function getEtaText(order: OrderEtaInput | null, estimatedMinutes: number | null, isAr: boolean) {
  if (!order) return null

  if (['delivered', 'completed'].includes(order.status)) {
    return isAr ? 'تم اكتمال الطلب' : 'Order completed'
  }
  if (order.status === 'cancelled') {
    return isAr ? 'تم إلغاء الطلب' : 'Order cancelled'
  }
  if (order.status === 'ready') {
    return order.order_type === 'pickup'
      ? (isAr ? 'جاهز للاستلام الآن' : 'Ready for pickup now')
      : (isAr ? 'طلبك جاهز وسيخرج للتوصيل قريباً' : 'Ready and will leave for delivery soon')
  }
  if (order.status === 'out_for_delivery') {
    return isAr ? 'طلبك في الطريق' : 'Your order is on the way'
  }

  const fallback = order.order_type === 'pickup'
    ? (isAr ? '٢٥-٣٥ دقيقة' : '25-35 min')
    : (isAr ? '٣٠-٤٥ دقيقة' : '30-45 min')
  const duration = estimatedMinutes
    ? (isAr ? `${estimatedMinutes} دقيقة` : `${estimatedMinutes} min`)
    : fallback

  return order.order_type === 'pickup'
    ? (isAr ? `الاستلام المتوقع خلال ${duration}` : `Estimated pickup in ${duration}`)
    : (isAr ? `التوصيل المتوقع خلال ${duration}` : `Estimated delivery in ${duration}`)
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
  const tCommon = await getTranslations('common')

  // Validate UUID format before querying
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) notFound()

  // Fetch order using service role (bypasses RLS — guest orders are unauthed)
  let order: OrderWithItems | null = null
  let branchEstimatedMinutes: number | null = null
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
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
  const etaText = getEtaText(order, branchEstimatedMinutes, isAr)

  const schemaOrg = order
    ? {
        '@context': 'https://schema.org',
        '@type': 'Order',
        orderNumber: shortId,
        orderStatus: 'https://schema.org/OrderProcessing',
        merchant: { '@type': 'Restaurant', name: 'كهرمانة بغداد' },
        priceCurrency: 'IQD',
        price: order.total_bhd.toFixed(3),
      }
    : null

  const isTerminal = order && ['delivered', 'completed', 'cancelled', 'payment_failed'].includes(order.status)

  return (
    <div className="min-h-screen bg-brand-black">
      {!isTerminal && <AutoRefresh intervalMs={30_000} />}
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

          {/* Order number + status */}
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
            <StatusBadge status={order?.status ?? 'new'} isAr={isAr} />
          </div>

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

          {etaText && (
            <div className="px-5 py-3 border-b border-brand-border text-start">
              <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-0.5
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'الوقت المتوقع' : 'Estimated time'}
              </p>
              <p className={`text-sm font-bold text-brand-gold
                ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {etaText}
              </p>
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
                        {[item.selected_size, item.selected_variant].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="font-almarai text-xs text-brand-muted mt-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-satoshi text-sm text-brand-gold tabular-nums shrink-0">
                    {item.item_total_bhd.toFixed(3)} {tCommon('currency')}
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
                {tCommon('currency') && t('title') && isAr ? 'الإجمالي' : 'Total'}
              </span>
              <span className="font-satoshi font-bold text-brand-text text-xl tabular-nums">
                {order?.total_bhd?.toFixed(3) ?? '0.000'} {tCommon('currency')}
              </span>
            </div>
          )}

          {/* Notes */}
          {order?.notes && (
            <div className="px-5 py-3 border-t border-brand-border text-start">
              <p className={`text-xs font-bold text-brand-muted mb-1 uppercase tracking-wide
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'ملاحظات' : 'Notes'}
              </p>
              <p className="font-almarai text-sm text-brand-muted">{order.notes}</p>
            </div>
          )}
        </div>

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
            {isAr ? 'تواصل مع الفرع عبر واتساب' : 'Contact Branch via WhatsApp'}
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

// ── Sub-components ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bgClass: string; textClass: string }> = {
  pending_payment: { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  confirmed:       { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  new:             { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  under_review:    { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  accepted:        { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  preparing:       { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  ready:           { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  out_for_delivery:{ bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  delivered:       { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  completed:       { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  cancelled:       { bgClass: 'bg-brand-error/15',    textClass: 'text-brand-error'       },
  payment_failed:  { bgClass: 'bg-brand-error/15',    textClass: 'text-brand-error'       },
}

const STATUS_LABELS_AR: Record<string, string> = {
  pending_payment:  'بانتظار الدفع',
  confirmed:        'مؤكد',
  new:              'جديد',
  under_review:     'قيد المراجعة',
  accepted:         'مقبول',
  preparing:        'يُحضَّر',
  ready:            'جاهز',
  out_for_delivery: 'في الطريق',
  delivered:        'تم التوصيل',
  completed:        'مكتمل',
  cancelled:        'ملغي',
  payment_failed:   'فشل الدفع',
}

const STATUS_LABELS_EN: Record<string, string> = {
  pending_payment:  'Pending Payment',
  confirmed:        'Confirmed',
  new:              'New',
  under_review:     'Under Review',
  accepted:         'Accepted',
  preparing:        'Preparing',
  ready:            'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  completed:        'Completed',
  cancelled:        'Cancelled',
  payment_failed:   'Payment Failed',
}

function StatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['new']
  const label = isAr
    ? (STATUS_LABELS_AR[status] ?? status)
    : (STATUS_LABELS_EN[status] ?? status)
  return (
    <span className={`font-satoshi text-xs font-bold rounded-lg
                     ps-3 pe-3 pt-1.5 pb-1.5
                     ${style.bgClass} ${style.textClass}`}>
      {label}
    </span>
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
