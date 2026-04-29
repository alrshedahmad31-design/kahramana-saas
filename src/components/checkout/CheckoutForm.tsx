'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { z } from 'zod'
import { useCartStore, selectSubtotal } from '@/lib/cart'
import { BRANCH_LIST } from '@/constants/contact'
import { buildWhatsAppCheckoutLink } from '@/lib/whatsapp'
import CinematicButton from '@/components/ui/CinematicButton'
import TierBadge from '@/components/loyalty/TierBadge'
import CouponInput from '@/components/checkout/CouponInput'
import { pointsToCredit, formatPoints, MIN_REDEMPTION } from '@/lib/loyalty/calculations'
import { createOrderWithPoints } from '@/app/[locale]/checkout/actions'
import type { CustomerProfileRow } from '@/lib/supabase/custom-types'
import type { AppliedCoupon } from '@/components/checkout/CouponInput'

// ── Validation schema ─────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  customerName: z
    .string()
    .max(100, 'Name too long')
    .optional()
    .transform((v) => v?.trim() || undefined),

  customerPhone: z
    .string()
    .regex(/^(\+?973)?[0-9]{8}$/, { message: 'phone_invalid' })
    .optional()
    .or(z.literal(''))
    .transform((v) => (!v ? undefined : v)),

  notes: z
    .string()
    .max(500, 'Notes too long')
    .optional()
    .transform((v) => v?.trim() || undefined),

  branchId: z.enum(['riffa', 'qallali', 'badi']),
})

type CheckoutValues = z.infer<typeof checkoutSchema>

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  customerProfile: CustomerProfileRow | null
}

export default function CheckoutForm({ customerProfile }: Props) {
  const locale  = useLocale()
  const isAr    = locale === 'ar'
  const t       = useTranslations('checkout')
  const tL      = useTranslations('loyalty')
  const tCommon = useTranslations('common')
  const router  = useRouter()

  const items     = useCartStore((s) => s.items)
  const branchId  = useCartStore((s) => s.branchId)
  const setBranch = useCartStore((s) => s.setBranch)
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotal  = selectSubtotal(items)

  const [name,        setName]        = useState('')
  const [phone,       setPhone]       = useState('')
  const [notes,       setNotes]       = useState('')
  const [errors,      setErrors]      = useState<Partial<Record<keyof CheckoutValues, string>>>({})
  const [loading,     setLoading]     = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Points state ──────────────────────────────────────────────────────────
  const [usePoints, setUsePoints] = useState(false)
  const availablePoints = customerProfile?.points_balance ?? 0
  const canRedeem       = availablePoints >= MIN_REDEMPTION
  const pointsDiscount  = usePoints && canRedeem ? pointsToCredit(availablePoints) : 0

  // ── Coupon state ───────────────────────────────────────────────────────────
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const couponDiscount  = appliedCoupon?.discount ?? 0

  // ── Final total ────────────────────────────────────────────────────────────
  const finalTotal = Math.max(0.001, subtotal - pointsDiscount - couponDiscount)

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitError(null)

    const parsed = checkoutSchema.safeParse({
      customerName:  name,
      customerPhone: phone,
      notes,
      branchId,
    })

    if (!parsed.success) {
      const fieldErrors: typeof errors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CheckoutValues
        fieldErrors[field] = issue.message === 'phone_invalid'
          ? (isAr ? 'رقم الهاتف غير صحيح (+973XXXXXXXX)' : 'Invalid Bahrain number (+973XXXXXXXX)')
          : issue.message
      }
      setErrors(fieldErrors)
      return
    }

    const values = parsed.data
    setLoading(true)

    try {
      // ── Unified checkout path — always via Server Action ──────────────────
      console.log('[Checkout Form] Submitting order payload:', {
        customer: values.customerName,
        phone: values.customerPhone,
        branch: values.branchId,
        itemCount: items.length,
        points: usePoints ? availablePoints : 0,
        coupon: appliedCoupon?.id
      })

      const result = await createOrderWithPoints({
        order: {
          customer_name:    values.customerName  ?? null,
          customer_phone:   values.customerPhone ?? null,
          branch_id:        values.branchId,
          status:           'new',
          notes:            values.notes ?? null,
          source:           'direct',
          whatsapp_sent_at: null,
        },
        items: items.map((item) => ({
          menu_item_slug:   item.itemId,
          name_ar:          item.nameAr,
          name_en:          item.nameEn,
          selected_size:    item.selectedSize    ?? null,
          selected_variant: item.selectedVariant ?? null,
          quantity:         item.quantity,
          unit_price_bhd:   item.priceBhd,
          item_total_bhd:   parseFloat((item.priceBhd * item.quantity).toFixed(3)),
        })),
        pointsToRedeem: usePoints ? availablePoints : 0,
        coupon: appliedCoupon
          ? { couponId: appliedCoupon.id }
          : undefined,
      })
      
      console.log('[Checkout Form] Result:', result)

      if (result.error || !result.orderId) {
        throw new Error(result.error ?? 'Order creation failed')
      }

      const orderId = result.orderId

      // ── Open WhatsApp and redirect ───────────────────────────────────────
      const shortOrderId = orderId.slice(-8).toUpperCase()
      const waLink = buildWhatsAppCheckoutLink(items, values.branchId, {
        customerName:  values.customerName,
        customerPhone: values.customerPhone,
        notes:         values.notes,
        orderNumber:   shortOrderId,
      })

      window.open(waLink, '_blank', 'noopener,noreferrer')
      clearCart()
      router.push(`/payment/${orderId}`)
    } catch (err) {
      console.error('Order checkout error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(
        isAr
          ? `حدث خطأ أثناء إرسال الطلب. ${msg}`
          : `An error occurred while sending your order. ${msg}`,
      )
      setLoading(false)
    }
  }


  // ── Empty cart guard ──────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4"
      >
        <p className={`text-lg font-bold text-brand-text
          ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {isAr ? 'سلتك فارغة' : 'Your cart is empty'}
        </p>
        <a
          href={isAr ? '/' : '/en'}
          className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light
                     transition-colors duration-150"
        >
          {isAr ? 'تصفح المنيو' : 'Browse the menu'}
        </a>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      dir={isAr ? 'rtl' : 'ltr'}
      className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-16"
    >
      <h1
        className={`text-2xl sm:text-3xl font-black text-brand-text mb-8
          ${isAr ? 'font-cairo text-end' : 'font-editorial text-start'}`}
      >
        {t('title')}
      </h1>

      {/* ── Branch selector ──────────────────────────────────────────── */}
      <fieldset className="mb-6">
        <legend className={`text-xs font-bold text-brand-muted mb-3 block uppercase tracking-wide
          ${isAr ? 'font-almarai w-full text-end' : 'font-satoshi w-full text-start'}`}>
          {t('branch')}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BRANCH_LIST.filter(b => b.status === 'active').map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setBranch(branch.id)}
              className={`rounded-lg border ps-4 pe-4 py-4 text-sm font-bold text-start
                         transition-colors duration-150 w-full
                         ${isAr ? 'font-cairo text-end' : 'font-satoshi text-start'}
                         ${branchId === branch.id
                           ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
                           : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/50'
                         }`}
            >
              <span className="block font-bold">
                {isAr ? branch.nameAr : branch.nameEn}
              </span>
              <span className={`text-xs font-normal mt-0.5 block
                ${branchId === branch.id ? 'text-brand-gold' : 'text-brand-muted'}`}>
                {isAr ? branch.hours.ar : branch.hours.en}
              </span>
            </button>
          ))}
        </div>
        {errors.branchId && (
          <p className="mt-1.5 text-xs text-brand-error font-almarai">{errors.branchId}</p>
        )}
      </fieldset>

      {/* ── Customer details ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Name */}
        <div>
          <label
            htmlFor="checkout-name"
            className={`text-xs font-bold text-brand-muted mb-1.5 block uppercase tracking-wide
              ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
          >
            {t('name')}
            <span className="ms-1 font-normal normal-case text-brand-muted/60">
              ({tCommon('optional')})
            </span>
          </label>
          <input
            id="checkout-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            autoComplete="name"
            dir={isAr ? 'rtl' : 'ltr'}
            className={`w-full bg-brand-surface-2 border rounded-lg
                       ps-4 pe-4 py-3 min-h-[48px]
                       text-brand-text text-base placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none transition-colors duration-150
                       ${isAr ? 'font-almarai' : 'font-satoshi'}
                       ${errors.customerName ? 'border-brand-error' : 'border-brand-border'}`}
          />
          {errors.customerName && (
            <p className="mt-1 text-xs text-brand-error font-almarai">{errors.customerName}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="checkout-phone"
            className={`text-xs font-bold text-brand-muted mb-1.5 block uppercase tracking-wide
              ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
          >
            {t('phone')}
            <span className="ms-1 font-normal normal-case text-brand-muted/60">
              ({tCommon('optional')})
            </span>
          </label>
          <input
            id="checkout-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('phonePlaceholder')}
            autoComplete="tel"
            dir="ltr"
            className={`w-full bg-brand-surface-2 border rounded-lg
                       ps-4 pe-4 py-3 min-h-[48px]
                       text-brand-text text-base font-satoshi
                       placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none transition-colors duration-150
                       ${errors.customerPhone ? 'border-brand-error' : 'border-brand-border'}`}
          />
          <p className={`mt-1 text-xs text-brand-muted
            ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('phoneHint')}
          </p>
          {errors.customerPhone && (
            <p className="mt-1 text-xs text-brand-error font-almarai">{errors.customerPhone}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="checkout-notes"
            className={`text-xs font-bold text-brand-muted mb-1.5 block uppercase tracking-wide
              ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
          >
            {t('notes')}
            <span className="ms-1 font-normal normal-case text-brand-muted/60">
              ({tCommon('optional')})
            </span>
          </label>
          <textarea
            id="checkout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={3}
            dir={isAr ? 'rtl' : 'ltr'}
            className={`w-full bg-brand-surface-2 border rounded-lg
                       ps-4 pe-4 py-3 min-h-[80px] resize-none
                       text-brand-text text-base placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none transition-colors duration-150
                       ${isAr ? 'font-almarai' : 'font-satoshi'}
                       ${errors.notes ? 'border-brand-error' : 'border-brand-border'}`}
          />
          {errors.notes && (
            <p className="mt-1 text-xs text-brand-error font-almarai">{errors.notes}</p>
          )}
        </div>
      </div>

      {/* ── Coupon input ──────────────────────────────────────────────── */}
      <CouponInput
        customerId={customerProfile?.id ?? null}
        orderTotal={subtotal}
        appliedCoupon={appliedCoupon}
        onApply={setAppliedCoupon}
        onRemove={() => setAppliedCoupon(null)}
      />

      {/* ── Points redemption panel ───────────────────────────────────── */}
      {customerProfile && canRedeem && (
        <div className="bg-brand-surface border border-brand-border rounded-xl mb-6 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TierBadge tier={customerProfile.loyalty_tier} size="sm" locale={locale} />
              <div>
                <p className={`text-sm font-bold text-brand-text
                  ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {formatPoints(availablePoints)} {tL('points')}
                </p>
                <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  ≈ {pointsToCredit(availablePoints).toFixed(3)} {tCommon('currency')}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={usePoints}
              onClick={() => setUsePoints(!usePoints)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
                         transition-colors duration-200
                         ${usePoints
                           ? 'bg-brand-gold'
                           : 'bg-brand-surface-2 border border-brand-border'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white
                           shadow-sm transition-transform duration-200
                           ${usePoints ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
          {usePoints && (
            <p className={`mt-3 text-xs text-brand-gold
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'خصم النقاط:' : 'Points discount:'}{' '}
              {pointsToCredit(availablePoints).toFixed(3)} {tCommon('currency')}
            </p>
          )}
        </div>
      )}

      {/* ── Order summary ─────────────────────────────────────────────── */}
      <div className="bg-brand-surface-2 border border-brand-border rounded-xl mb-6 overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide
            ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('orderSummary')}
          </h2>
        </div>

        <div className="divide-y divide-brand-border">
          {items.map((item) => (
            <div
              key={item.cartKey}
              className="flex items-center gap-3 px-4 py-3 text-start"
            >
              {item.imageUrl && (
                <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 border border-brand-border">
                  <Image
                    src={item.imageUrl}
                    alt={isAr ? item.nameAr : item.nameEn}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold text-brand-text line-clamp-1
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {isAr ? item.nameAr : item.nameEn}
                </p>
                {(item.selectedSize || item.selectedVariant) && (
                  <p className="font-almarai text-xs text-brand-muted mt-0.5">
                    {[item.selectedSize, item.selectedVariant].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className={`text-sm font-satoshi tabular-nums shrink-0 ${isAr ? 'text-start' : 'text-end'}`}>
                <span className="text-brand-gold font-medium">
                  {(item.priceBhd * item.quantity).toFixed(3)}
                </span>
                <span className="text-brand-muted ms-1">{tCommon('currency')}</span>
                {item.quantity > 1 && (
                  <span className="text-brand-muted text-xs ms-1">×{item.quantity}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Subtotal — only shown when any discount applies */}
        {(pointsDiscount > 0 || couponDiscount > 0) && (
          <div className="px-4 py-2 border-t border-brand-border flex items-center justify-between">
            <span className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'المجموع الفرعي' : 'Subtotal'}
            </span>
            <span className="font-satoshi text-brand-muted tabular-nums text-sm">
              {subtotal.toFixed(3)} {tCommon('currency')}
            </span>
          </div>
        )}

        {/* Coupon discount row */}
        {couponDiscount > 0 && (
          <div className="px-4 py-2 border-t border-brand-border flex items-center justify-between">
            <span className={`text-sm text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? `كوبون ${appliedCoupon?.code}` : `Coupon ${appliedCoupon?.code}`}
            </span>
            <span className="font-satoshi text-brand-gold tabular-nums text-sm">
              -{couponDiscount.toFixed(3)} {tCommon('currency')}
            </span>
          </div>
        )}

        {/* Points discount row */}
        {pointsDiscount > 0 && (
          <div className="px-4 py-2 border-t border-brand-border flex items-center justify-between">
            <span className={`text-sm text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'خصم النقاط' : 'Points discount'}
            </span>
            <span className="font-satoshi text-brand-gold tabular-nums text-sm">
              -{pointsDiscount.toFixed(3)} {tCommon('currency')}
            </span>
          </div>
        )}

        {/* Total row */}
        <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between">
          <span className={`text-sm font-bold text-brand-muted
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('total')}
          </span>
          <span className="font-satoshi font-bold text-brand-text text-lg tabular-nums">
            {finalTotal.toFixed(3)} {tCommon('currency')}
          </span>
        </div>
      </div>

      {/* ── Payment note ──────────────────────────────────────────────── */}
      <p className={`text-xs text-brand-muted mb-6
        ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
        {t('paymentNote')}
      </p>

      {/* ── Submit error ──────────────────────────────────────────────── */}
      {submitError && (
        <div className="mb-4 rounded-lg border border-brand-error/50 bg-brand-error/10
                        px-4 py-3 text-sm text-brand-error font-almarai">
          {submitError}
        </div>
      )}

      {/* ── Submit button ─────────────────────────────────────────────── */}
      <CinematicButton
        type="submit"
        disabled={loading}
        isRTL={isAr}
        className="w-full py-4 text-base font-bold rounded-full"
      >
        {loading ? t('processing') : t('placeOrder')}
      </CinematicButton>

      {/* Terms */}
      <p className={`mt-3 text-xs text-brand-muted text-center
        ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('terms')}
      </p>
    </form>
  )
}
