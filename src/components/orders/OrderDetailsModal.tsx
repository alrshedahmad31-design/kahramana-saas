'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import StatusBadge from '@/components/dashboard/StatusBadge'
import OrderStatusSelect from '@/components/dashboard/OrderStatusSelect'
import OrderTimeline from '@/components/orders/OrderTimeline'
import { BRANCHES } from '@/constants/contact'
import { getOrderDetails, type OrderDetails } from '@/app/[locale]/dashboard/orders/actions'
import type { OrderStatus, StaffRole } from '@/lib/supabase/types'

interface Props {
  orderId:  string | null
  isRTL:    boolean
  userRole: StaffRole | null
  onClose:  () => void
  onStatusChange?: (orderId: string, next: OrderStatus) => void
}

export default function OrderDetailsModal({ orderId, isRTL, userRole, onClose, onStatusChange }: Props) {
  const t  = useTranslations('dashboard')
  const tS = useTranslations('order.status')
  const tC = useTranslations('common')

  const [order,   setOrder]   = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [,        startTrans] = useTransition()

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (orderId) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [orderId])

  // Fetch on open
  useEffect(() => {
    if (!orderId) { setOrder(null); return }
    setLoading(true)
    startTrans(async () => {
      const data = await getOrderDetails(orderId)
      setOrder(data)
      setLoading(false)
    })
  }, [orderId])

  if (!orderId) return null

  const branch   = order ? BRANCHES[order.branch_id as keyof typeof BRANCHES] : null
  const shortId  = order?.id.slice(-8).toUpperCase() ?? '…'
  const itemsSubtotal = order?.order_items.reduce((s, i) => s + Number(i.item_total_bhd), 0) ?? 0
  const couponDiscount = Number(order?.coupon_discount_bhd ?? 0)

  const formattedDate = order
    ? new Date(order.created_at).toLocaleString(isRTL ? 'ar-BH' : 'en-BH', {
        dateStyle: 'medium', timeStyle: 'short',
      })
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-brand-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 end-0 z-50 w-full max-w-lg bg-brand-surface shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Modal header */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-brand-border">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-satoshi font-black text-xl text-brand-text tabular-nums">
              #{shortId}
            </h2>
            {order && (
              <StatusBadge status={order.status} label={tS(order.status)} size="md" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors duration-150"
            aria-label={t('closeModal')}
          >
            <XIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading || !order ? (
            <ModalSkeleton />
          ) : (
            <div className="flex flex-col divide-y divide-brand-border">

              {/* Customer */}
              <section className="px-5 py-5">
                <SectionTitle isRTL={isRTL}>{isRTL ? 'معلومات العميل' : 'Customer'}</SectionTitle>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-4">
                  <InfoRow label={t('customer')} isRTL={isRTL}>
                    <span className={isRTL ? 'font-almarai' : 'font-satoshi'}>
                      {order.customer_name ?? t('customerGuest')}
                    </span>
                  </InfoRow>
                  {order.customer_phone && (
                    <InfoRow label={t('phone')} isRTL={isRTL}>
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="font-satoshi tabular-nums text-brand-gold hover:underline"
                        dir="ltr"
                      >
                        {order.customer_phone}
                      </a>
                    </InfoRow>
                  )}
                  <InfoRow label={t('branch')} isRTL={isRTL}>
                    <span className={isRTL ? 'font-almarai' : 'font-satoshi'}>
                      {branch ? (isRTL ? branch.nameAr : branch.nameEn) : order.branch_id}
                    </span>
                  </InfoRow>
                  <InfoRow label={t('createdAt')} isRTL={isRTL}>
                    <span className="font-satoshi tabular-nums text-xs">{formattedDate}</span>
                  </InfoRow>
                  {order.notes && (
                    <div className="col-span-2">
                      <dt className="font-satoshi text-xs text-brand-muted uppercase tracking-wider mb-1">{t('notes')}</dt>
                      <dd className={`font-satoshi text-sm text-brand-text leading-relaxed ${isRTL ? 'font-almarai' : ''}`}>
                        {order.notes}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Items */}
              <section className="px-5 py-5">
                <SectionTitle isRTL={isRTL}>{isRTL ? 'الأصناف' : 'Items'}</SectionTitle>
                <div className="mt-4 flex flex-col gap-2">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg bg-brand-surface-2 px-3 py-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="font-satoshi font-black text-brand-gold tabular-nums shrink-0 text-sm pt-0.5">
                          ×{item.quantity}
                        </span>
                        <div className="min-w-0">
                          <p className={`font-satoshi text-sm font-medium text-brand-text leading-snug ${isRTL ? 'font-almarai' : ''}`}>
                            {isRTL ? item.name_ar : item.name_en}
                          </p>
                          {(item.selected_size || item.selected_variant) && (
                            <p className="font-satoshi text-xs text-brand-muted mt-0.5">
                              {[item.selected_size, item.selected_variant].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          <p className="font-satoshi text-xs text-brand-muted/60 tabular-nums mt-0.5">
                            {Number(item.unit_price_bhd).toFixed(3)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-satoshi font-semibold text-sm text-brand-text tabular-nums shrink-0">
                        {Number(item.item_total_bhd).toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Payment summary */}
              <section className="px-5 py-5">
                <SectionTitle isRTL={isRTL}>{t('paymentSummary')}</SectionTitle>
                <div className="mt-4 flex flex-col gap-2 text-sm font-satoshi">
                  <div className="flex justify-between">
                    <span className="text-brand-muted">{t('itemsSubtotal')}</span>
                    <span className="tabular-nums text-brand-text">{itemsSubtotal.toFixed(3)} {tC('currency')}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-brand-muted">{t('couponDiscount')}</span>
                      <span className="tabular-nums text-brand-success">−{couponDiscount.toFixed(3)} {tC('currency')}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-brand-border">
                    <span className="font-semibold text-brand-text">{t('total')}</span>
                    <span className="font-black text-xl text-brand-gold tabular-nums">
                      {Number(order.total_bhd).toFixed(3)} {tC('currency')}
                    </span>
                  </div>
                </div>
              </section>

              {/* Timeline */}
              <section className="px-5 py-5">
                <SectionTitle isRTL={isRTL}>{t('statusTimeline')}</SectionTitle>
                <div className="mt-4">
                  <OrderTimeline
                    status={order.status}
                    createdAt={order.created_at}
                    updatedAt={order.updated_at}
                    isRTL={isRTL}
                  />
                </div>
              </section>

              {/* Status update */}
              <section className="px-5 py-5">
                <SectionTitle isRTL={isRTL}>{t('updateStatus')}</SectionTitle>
                <div className="mt-4">
                  <OrderStatusSelect
                    orderId={order.id}
                    currentStatus={order.status}
                    userRole={userRole}
                    onStatusChange={(next) => onStatusChange?.(order.id, next)}
                  />
                </div>
              </section>

            </div>
          )}
        </div>

        {/* Footer actions */}
        {order && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-brand-border bg-brand-surface-2">
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-success hover:border-brand-success/30 font-satoshi text-sm transition-colors duration-150 min-h-[44px]"
              >
                <PhoneIcon />
                {isRTL ? 'اتصال بالعميل' : 'Call Customer'}
              </a>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:border-brand-gold/40 font-satoshi text-sm transition-colors duration-150 min-h-[44px] ms-auto"
            >
              <PrintIcon />
              {t('printReceipt')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children, isRTL }: { children: React.ReactNode; isRTL: boolean }) {
  return (
    <h3 className={`font-satoshi font-black text-xs uppercase tracking-wider text-brand-muted ${isRTL ? 'font-almarai' : ''}`}>
      {children}
    </h3>
  )
}

function InfoRow({ label, children, isRTL }: { label: string; children: React.ReactNode; isRTL: boolean }) {
  return (
    <div>
      <dt className={`font-satoshi text-xs text-brand-muted uppercase tracking-wider mb-0.5 ${isRTL ? 'font-almarai' : ''}`}>{label}</dt>
      <dd className="font-satoshi font-medium text-sm text-brand-text">{children}</dd>
    </div>
  )
}

function ModalSkeleton() {
  return (
    <div className="flex flex-col gap-0 animate-pulse">
      {[120, 180, 100, 200].map((h, i) => (
        <div key={i} className="px-5 py-5 border-b border-brand-border">
          <div className="h-3 w-20 rounded bg-brand-surface-2 mb-4" />
          <div className="flex flex-col gap-3">
            <div style={{ height: h / 4 }} className="rounded bg-brand-surface-2 w-full" />
            <div style={{ height: h / 5 }} className="rounded bg-brand-surface-2 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function XIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
    </svg>
  )
}
