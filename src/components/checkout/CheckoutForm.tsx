'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { z } from 'zod'
import { MapPin, Navigation, Loader2 } from 'lucide-react'
import { useCartStore, selectSubtotal } from '@/lib/cart'
import { BRANCH_LIST, type BranchId } from '@/constants/contact'
import { buildOrderTrackingUrl, buildWhatsAppCheckoutLink } from '@/lib/whatsapp'
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
    .min(2, 'name_required')
    .max(100, 'Name too long'),

  customerPhone: z
    .string()
    .regex(/^(\+?973)?[0-9]{8}$/, { message: 'phone_invalid' }),

  notes: z
    .string()
    .max(500, 'Notes too long')
    .optional()
    .transform((v) => v?.trim() || undefined),

  branchId: z.enum(['riffa', 'qallali', 'badi']),
})

type CheckoutValues = z.infer<typeof checkoutSchema>

// ── Address types ─────────────────────────────────────────────────────────────

type AddressMode = 'manual' | 'location' | null

interface ManualAddress {
  building: string
  villa: string
  road: string
  block: string
}

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
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotal  = selectSubtotal(items)

  // ── Form fields ───────────────────────────────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState<BranchId | null>(null)
  const [name,        setName]        = useState('')
  const [phone,       setPhone]       = useState('')
  const [notes,       setNotes]       = useState('')
  const [errors,      setErrors]      = useState<Partial<Record<keyof CheckoutValues | 'address', string>>>({})
  const [loading,     setLoading]     = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Address state ─────────────────────────────────────────────────────────
  const [addressMode, setAddressMode] = useState<AddressMode>(null)
  const [manualAddr, setManualAddr]   = useState<ManualAddress>({ building: '', villa: '', road: '', block: '' })
  const [gpsCoords,  setGpsCoords]    = useState<{ lat: number; lng: number } | null>(null)
  const [gpsLoading, setGpsLoading]   = useState(false)
  const [gpsError,   setGpsError]     = useState<string | null>(null)

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

  // ── GPS ───────────────────────────────────────────────────────────────────

  function requestLocation() {
    if (!navigator.geolocation) {
      setGpsError(isAr ? 'المتصفح لا يدعم تحديد الموقع' : 'Geolocation not supported')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsLoading(false)
        setAddressMode('location')
      },
      () => {
        setGpsError(isAr ? 'تعذّر الوصول للموقع — تأكد من الصلاحيات' : 'Location access denied')
        setGpsLoading(false)
      },
      { timeout: 10000 },
    )
  }

  // ── Address formatter ─────────────────────────────────────────────────────

  function buildAddressString(): string | undefined {
    if (addressMode === 'location' && gpsCoords) {
      return `https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`
    }
    if (addressMode === 'manual') {
      const parts = [
        manualAddr.block    && `م${manualAddr.block}`,
        manualAddr.road     && `ش${manualAddr.road}`,
        manualAddr.building && `م${manualAddr.building}`,
        manualAddr.villa    && manualAddr.villa,
      ].filter(Boolean)
      return parts.length ? parts.join('، ') : undefined
    }
    return undefined
  }

  function validateAddress(): boolean {
    if (addressMode === 'location' && gpsCoords) return true
    if (addressMode === 'manual') {
      const { road, block } = manualAddr
      return !!(road.trim() || block.trim())
    }
    return false
  }

  // ── Core submit logic ─────────────────────────────────────────────────────

  async function validateAndCreate() {
    const newErrors: typeof errors = {}

    if (!selectedBranch) {
      newErrors.branchId = isAr ? 'الرجاء اختيار الفرع' : 'Please select a branch'
    }

    if (!validateAddress()) {
      newErrors.address = isAr
        ? 'الرجاء إدخال العنوان أو مشاركة موقعك'
        : 'Please enter your address or share your location'
    }

    const parsed = checkoutSchema.safeParse({
      customerName:  name,
      customerPhone: phone,
      notes,
      branchId:      selectedBranch ?? 'riffa',
    })

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CheckoutValues
        if (issue.message === 'name_required') {
          newErrors[field] = isAr ? 'الاسم مطلوب (حرفان على الأقل)' : 'Name is required (min 2 chars)'
        } else if (issue.message === 'phone_invalid') {
          newErrors[field] = isAr ? 'رقم الهاتف غير صحيح (+973XXXXXXXX)' : 'Invalid Bahrain number (+973XXXXXXXX)'
        } else {
          newErrors[field] = issue.message
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return null
    }

    const values = parsed.data!
    const deliveryAddress = buildAddressString() ?? null
    setLoading(true)

    const result = await createOrderWithPoints({
      order: {
        customer_name:       values.customerName  ?? null,
        customer_phone:      values.customerPhone ?? null,
        branch_id:           values.branchId,
        status:              'new',
        notes:               values.notes ?? null,
        customer_notes:      values.notes ?? null,
        delivery_address:    deliveryAddress,
        delivery_building:   addressMode === 'manual' ? manualAddr.building.trim() || null : null,
        delivery_street:     addressMode === 'manual' ? manualAddr.road.trim() || null : null,
        delivery_lat:        addressMode === 'location' ? gpsCoords?.lat ?? null : null,
        delivery_lng:        addressMode === 'location' ? gpsCoords?.lng ?? null : null,
        source:              'direct',
        whatsapp_sent_at:    null,
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
      coupon: appliedCoupon ? { couponId: appliedCoupon.id } : undefined,
    })

    if (result.error || !result.orderId) {
      throw new Error(result.error ?? 'Order creation failed')
    }

    return { orderId: result.orderId, values, deliveryAddress }
  }

  // ── Submit via WhatsApp ────────────────────────────────────────────────────

  async function handleWASubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitError(null)

    try {
      const res = await validateAndCreate()
      if (!res) return

      const { orderId, values } = res
      const shortOrderId = orderId.slice(-8).toUpperCase()
      const waLink = buildWhatsAppCheckoutLink(items, values.branchId, {
        customerName:  values.customerName,
        customerPhone: values.customerPhone,
        address:       res.deliveryAddress ?? undefined,
        notes:         values.notes,
        orderNumber:   shortOrderId,
        trackingUrl:   buildOrderTrackingUrl(orderId, locale),
      })

      window.open(waLink, '_blank', 'noopener,noreferrer')
      clearCart()
      router.push(`/payment/${orderId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(isAr ? `حدث خطأ: ${msg}` : `Error: ${msg}`)
      setLoading(false)
    }
  }

  // ── Submit direct payment (no WA) ─────────────────────────────────────────

  async function handlePaymentSubmit() {
    setErrors({})
    setSubmitError(null)

    try {
      const res = await validateAndCreate()
      if (!res) return

      clearCart()
      router.push(`/payment/${res.orderId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(isAr ? `حدث خطأ: ${msg}` : `Error: ${msg}`)
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
        <p className={`text-lg font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {isAr ? 'سلتك فارغة' : 'Your cart is empty'}
        </p>
        <a
          href={isAr ? '/' : '/en'}
          className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors duration-150"
        >
          {isAr ? 'تصفح المنيو' : 'Browse the menu'}
        </a>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleWASubmit}
      dir={isAr ? 'rtl' : 'ltr'}
      className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-16"
    >
      <h1
        className={`text-2xl sm:text-3xl font-black text-brand-text mb-8
          ${isAr ? 'font-cairo text-end' : 'font-editorial text-start'}`}
      >
        {t('title')}
      </h1>

      {/* ── Branch selector (required) ────────────────────────────────── */}
      <fieldset className="mb-6">
        <legend className={`text-xs font-bold text-brand-muted mb-1 block uppercase tracking-wide
          ${isAr ? 'font-almarai w-full text-end' : 'font-satoshi w-full text-start'}`}>
          {isAr ? 'اختر الفرع الأقرب إليك' : 'Select Your Nearest Branch'}
          <span className="ms-1 text-brand-error">*</span>
        </legend>
        <p className={`text-[11px] text-brand-muted/60 mb-3
          ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
          {isAr ? 'إجباري — لم يتم اختيار فرع' : 'Required — no branch selected'}
          {selectedBranch && ` ✓`}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BRANCH_LIST.filter(b => b.status === 'active').map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                setSelectedBranch(branch.id)
                setErrors((prev) => { const n = { ...prev }; delete n.branchId; return n })
              }}
              className={`rounded-lg border ps-4 pe-4 py-4 text-sm font-bold text-start
                         transition-colors duration-150 w-full
                         ${isAr ? 'font-cairo text-end' : 'font-satoshi text-start'}
                         ${selectedBranch === branch.id
                           ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
                           : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/50'
                         }`}
            >
              <span className="block font-bold">
                {isAr ? branch.nameAr : branch.nameEn}
              </span>
              <span className={`text-xs font-normal mt-0.5 block
                ${selectedBranch === branch.id ? 'text-brand-gold' : 'text-brand-muted'}`}>
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
        {/* Name — required */}
        <div>
          <label
            htmlFor="checkout-name"
            className={`text-xs font-bold text-brand-muted mb-1.5 block uppercase tracking-wide
              ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
          >
            {t('name')} <span className="text-brand-error">*</span>
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

        {/* Phone — required */}
        <div>
          <label
            htmlFor="checkout-phone"
            className={`text-xs font-bold text-brand-muted mb-1.5 block uppercase tracking-wide
              ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
          >
            {t('phone')} <span className="text-brand-error">*</span>
          </label>
          <input
            id="checkout-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={isAr ? '3XXXXXXX أو +97336XXXXXX' : '3XXXXXXX or +97336XXXXXX'}
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

        {/* Address — required (dual mode) */}
        <div>
          <label className={`text-xs font-bold text-brand-muted mb-1.5 block uppercase tracking-wide
            ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {isAr ? 'عنوان التوصيل' : 'Delivery Address'} <span className="text-brand-error">*</span>
          </label>
          <p className={`text-[11px] text-brand-muted/60 mb-3
            ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {isAr ? 'اختر أحد الطريقتين' : 'Choose one method'}
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setAddressMode(addressMode === 'manual' ? null : 'manual')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors
                ${addressMode === 'manual'
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
                  : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/40'}
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              <MapPin size={14} />
              {isAr ? 'كتابة يدوية' : 'Manual entry'}
            </button>
            <button
              type="button"
              onClick={requestLocation}
              disabled={gpsLoading}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors
                ${addressMode === 'location' && gpsCoords
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
                  : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/40'}
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {gpsLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <Navigation size={14} />}
              {isAr ? 'مشاركة موقعي' : 'Share location'}
            </button>
          </div>

          {/* GPS result */}
          {addressMode === 'location' && gpsCoords && (
            <div className={`rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2 text-xs text-brand-gold
              ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
              ✓ {isAr ? 'تم تحديد موقعك' : 'Location captured'}
              {' '}({gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)})
            </div>
          )}
          {gpsError && (
            <p className="text-xs text-brand-error font-almarai mt-1">{gpsError}</p>
          )}

          {/* Manual fields */}
          {addressMode === 'manual' && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                ['building', isAr ? 'رقم المبنى' : 'Building No.'],
                ['villa',    isAr ? 'فيلا / شقة' : 'Villa / Apt'],
                ['road',     isAr ? 'طريق' : 'Road'],
                ['block',    isAr ? 'مجمع' : 'Block'],
              ] as [keyof ManualAddress, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className={`text-[10px] text-brand-muted/60 mb-1 block ${isAr ? 'font-almarai text-end' : 'font-satoshi'}`}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={manualAddr[field]}
                    onChange={(e) => setManualAddr((prev) => ({ ...prev, [field]: e.target.value }))}
                    dir={isAr ? 'rtl' : 'ltr'}
                    className={`w-full bg-brand-surface-2 border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/40 focus:border-brand-gold focus:outline-none transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                  />
                </div>
              ))}
            </div>
          )}

          {errors.address && (
            <p className="mt-1.5 text-xs text-brand-error font-almarai">{errors.address}</p>
          )}
        </div>

        {/* Order notes — optional */}
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
                <p className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
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
            <p className={`mt-3 text-xs text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
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
            <div key={item.cartKey} className="flex items-start gap-3 px-4 py-3 text-start">
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
                {item.notes && (
                  <p className={`text-[11px] text-brand-gold/70 mt-0.5 italic
                    ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    ↳ {item.notes}
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

        <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between">
          <span className={`text-sm font-bold text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('total')}
          </span>
          <span className="font-satoshi font-bold text-brand-text text-lg tabular-nums">
            {finalTotal.toFixed(3)} {tCommon('currency')}
          </span>
        </div>
      </div>

      {/* ── Payment note ──────────────────────────────────────────────── */}
      <p className={`text-xs text-brand-muted mb-6 ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
        {t('paymentNote')}
      </p>

      {/* ── Submit error ──────────────────────────────────────────────── */}
      {submitError && (
        <div className="mb-4 rounded-lg border border-brand-error/50 bg-brand-error/10 px-4 py-3 text-sm text-brand-error font-almarai">
          {submitError}
        </div>
      )}

      {/* ── Submit buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <CinematicButton
          type="submit"
          disabled={loading}
          isRTL={isAr}
          className="flex-1 py-4 text-base font-bold rounded-full"
        >
          {loading ? t('processing') : (isAr ? 'إرسال عبر واتساب' : 'Send via WhatsApp')}
        </CinematicButton>

        <CinematicButton
          type="button"
          disabled={loading}
          isRTL={isAr}
          onClick={handlePaymentSubmit}
          className="flex-1 py-4 text-base font-bold rounded-full"
        >
          {isAr ? 'الدفع' : 'Pay Now'}
        </CinematicButton>
      </div>

      {/* Terms */}
      <p className={`mt-3 text-xs text-brand-muted text-center ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('terms')}
      </p>
    </form>
  )
}
