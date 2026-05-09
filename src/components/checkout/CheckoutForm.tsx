'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { z } from 'zod'
import type { LucideIcon } from 'lucide-react'
import {
  Loader2,
  User,
  Phone,
  Truck,
  Notebook,
  Tag,
  ShoppingCart,
  CheckCircle,
  Plus,
  Minus,
  Trash2,
  Store,
  Edit,
  Send,
  Package,
} from 'lucide-react'
import { useCartStore, selectCartTotalFils, selectLineTotalFils, selectTotalItems } from '@/lib/cart'
import { filsToBhd, formatPrice, formatPriceFils } from '@/lib/format'
import { BRANCH_LIST, BRANCHES, type BranchId } from '@/constants/contact'
import CinematicButton from '@/components/ui/CinematicButton'
import CouponInput from '@/components/checkout/CouponInput'
import { LoyaltyRedemptionWidget } from '@/components/loyalty/LoyaltyRedemptionWidget'
import { MIN_REDEMPTION, pointsToCredit } from '@/lib/loyalty/calculations'
import { createOrderWithPoints } from '@/app/[locale]/checkout/actions'
import { createClient } from '@/lib/supabase/client'
import { gtag } from '@/lib/gtag'
import type { CustomerProfileRow } from '@/lib/supabase/custom-types'
import type { AppliedCoupon } from '@/components/checkout/CouponInput'

// ── Components ───────────────────────────────────────────────────────────────

function StepHeader({
  number,
  title,
  icon: Icon
}: {
  number: string
  title: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-center gap-3 mb-4 px-1">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-gold text-brand-black font-bold text-sm shrink-0">
        {number}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Icon size={18} className="text-brand-gold" />
        <h2 className="text-sm sm:text-base font-bold text-brand-text uppercase tracking-wider font-cairo sm:font-satoshi">
          {title}
        </h2>
      </div>
    </div>
  )
}

function SectionCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-brand-surface border border-brand-border rounded-2xl p-5 mb-6 shadow-sm ${className}`}>
      {children}
    </div>
  )
}


// ── Validation schema ─────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  customerName: z
    .string()
    .min(2, 'name_required')
    .max(100, 'name_too_long'),

  customerPhone: z
    .string()
    .regex(/^(\+?973)?[36]\d{7}$/, { message: 'phone_invalid' })
    .or(z.string().transform((v) => v.replace(/\s+/g, '')).pipe(
      z.string().regex(/^(\+?973)?[36]\d{7}$/, { message: 'phone_invalid' })
    )),

  notes: z
    .string()
    .max(500, 'notes_too_long')
    .optional()
    .transform((v) => v?.trim() || undefined),

  branchId: z.string().min(1),
})

type CheckoutValues = z.infer<typeof checkoutSchema>
type CheckoutErrorKey = keyof CheckoutValues | 'address' | 'deliveryBuilding' | 'deliveryStreet' | 'deliveryArea'

// ── Address types ─────────────────────────────────────────────────────────────

type ManualAddress = {
  block: string
  road: string
  building: string
  flat: string
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  customerProfile: CustomerProfileRow | null
}

interface BranchSupport {
  phone: string
  waLink: string
}

export default function CheckoutForm({ customerProfile }: Props) {
  const locale  = useLocale()
  const isAr    = locale === 'ar'
  const t       = useTranslations('checkout')
  const router  = useRouter()
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const items     = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotalFils = selectCartTotalFils(items)
  const subtotal = filsToBhd(subtotalFils)
  const totalItems = selectTotalItems(items)

  // ── Form fields ───────────────────────────────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState<BranchId | null>(null)
  const [branchSupport, setBranchSupport] = useState<Partial<Record<BranchId, BranchSupport>>>({})
  const [name,        setName]        = useState('')
  const [phone,       setPhone]       = useState('')
  const [notes,       setNotes]       = useState('')
  const [errors,      setErrors]      = useState<Partial<Record<CheckoutErrorKey, string>>>({})
  const [loading,       setLoading]       = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [stockWarnings, setStockWarnings] = useState<string[]>([])
  const [pendingStockMode, setPendingStockMode] = useState<'cod' | 'online' | null>(null)

  // ── Order type state (delivery / pickup) ─────────────────────────────────
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | null>(null)

  // ── Address state ─────────────────────────────────────────────────────────
  const [manualAddr, setManualAddr]   = useState<ManualAddress>({ block: '', road: '', building: '', flat: '' })
  const [gpsCoords,  setGpsCoords]    = useState<{ lat: number; lng: number } | null>(null)
  const [gpsLoading, setGpsLoading]   = useState(false)
  const [gpsError,   setGpsError]     = useState<string | null>(null)

  // ── Points state ──────────────────────────────────────────────────────────
  const [usePoints, setUsePoints] = useState(false)
  const availablePoints = customerProfile?.points_balance ?? 0
  const pointsDiscount = usePoints ? pointsToCredit(customerProfile?.points_balance ?? 0) : 0

  useEffect(() => {
    if (!customerProfile) return
    setName((current) => current || customerProfile.name || '')
    setPhone((current) => current || customerProfile.phone || '')
  }, [customerProfile])

  useEffect(() => {
    let isActive = true

    async function loadBranchSupport() {
      const supabase = createClient()
      const { data } = await supabase
        .from('branches')
        .select('id, phone, wa_link')

      if (!isActive || !data) return

      const nextSupport: Partial<Record<BranchId, BranchSupport>> = {}
      for (const branch of data) {
        const id = branch.id as BranchId
        if (id in BRANCHES) {
          nextSupport[id] = {
            phone: branch.phone,
            waLink: branch.wa_link,
          }
        }
      }
      setBranchSupport(nextSupport)
    }

    void loadBranchSupport()
    return () => { isActive = false }
  }, [])

  // ── Coupon state ───────────────────────────────────────────────────────────
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const couponDiscount  = appliedCoupon?.discount ?? 0

  // ── Final total ────────────────────────────────────────────────────────────
  const finalTotal = Math.max(0.001, subtotal - pointsDiscount - couponDiscount)
  const selectedBranchSupport = selectedBranch ? branchSupport[selectedBranch] : null

  // ── GPS ───────────────────────────────────────────────────────────────────

  function requestLocation() {
    if (!navigator.geolocation) {
      setGpsError(t('errors.gpsUnsupported'))
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsLoading(false)
      },
      () => {
        setGpsError(t('errors.gpsDenied'))
        setGpsLoading(false)
      },
      { timeout: 10000 },
    )
  }

  // ── Address formatter ─────────────────────────────────────────────────────

  function buildAddressString(): string | undefined {
    if (orderType === 'pickup') return undefined
    
    const parts: string[] = []
    
    // 1. Text address parts
    const textParts = [
      manualAddr.block    && `${t('address.blockPrefix')}${manualAddr.block}`,
      manualAddr.road     && `${t('address.roadPrefix')}${manualAddr.road}`,
      manualAddr.building && `${t('address.buildingPrefix')}${manualAddr.building}`,
      manualAddr.flat     && manualAddr.flat,
    ].filter(Boolean)
    
    if (textParts.length > 0) {
      parts.push(textParts.join(t('listSeparator')))
    }
    
    // 2. GPS link
    if (gpsCoords) {
      parts.push(`https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`)
    }
    
    return parts.length ? parts.join(' \n ') : undefined
  }

  function validateAddress(): boolean {
    if (orderType === 'pickup') return true
    // Require manual address fields even if GPS is shared, for driver clarity
    const { block, road, building } = manualAddr
    return !!(block.trim() && road.trim() && building.trim())
  }

  function localizeCheckoutError(message: string): string {
    const labels: Record<string, string> = {
      name_required: t('errors.nameRequired'),
      name_too_long: t('errors.nameTooLong'),
      phone_invalid: t('errors.phoneInvalid'),
      building_required: t('errors.buildingRequired'),
      road_required: t('errors.roadRequired'),
      block_required: t('errors.blockRequired'),
      notes_too_long: t('errors.notesTooLong'),
    }
    return labels[message] ?? message
  }

  // ── Core submit logic ─────────────────────────────────────────────────────

  async function validateAndCreate(paymentMode: 'cod' | 'online', confirmLowStock = false) {
    const newErrors: typeof errors = {}

    if (!selectedBranch) {
      newErrors.branchId = t('errors.branchRequired')
    }

    if (!orderType) {
      newErrors.address = t('errors.orderTypeRequired')
    } else if (!validateAddress()) {
      newErrors.address = t('errors.addressRequired')
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
          newErrors[field] = t('errors.nameRequired')
        } else if (issue.message === 'phone_invalid') {
          newErrors[field] = t('errors.phoneInvalid')
        } else {
          newErrors[field] = localizeCheckoutError(issue.message)
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

    const isPickup = orderType === 'pickup'
    const result = await createOrderWithPoints({
      order: {
        customer_name:       values.customerName  ?? null,
        customer_phone:      values.customerPhone ?? null,
        branch_id:           values.branchId,
        status:              'new',
        order_type:          orderType ?? 'delivery',
        notes:               values.notes ?? null,
        customer_notes:      values.notes ?? null,
        delivery_address:    isPickup ? null : deliveryAddress,
        delivery_building:   !isPickup ? manualAddr.building.trim() || null : null,
        delivery_street:     !isPickup ? manualAddr.road.trim() || null : null,
        delivery_area:       !isPickup ? manualAddr.block.trim() || null : null,
        delivery_lat:        !isPickup ? gpsCoords?.lat ?? null : null,
        delivery_lng:        !isPickup ? gpsCoords?.lng ?? null : null,
        source:              'direct',
        whatsapp_sent_at:    null,
      },
      items: items.map((item) => ({
        menu_item_slug:   item.itemId,
        selected_size:    item.selectedSize    ?? null,
        selected_variant: item.selectedVariant ?? null,
        quantity:         item.quantity,
        notes:            item.notes ?? null,
      })),
      clientSubtotalBhd: subtotal,
      paymentMode,
      idempotency_key: idempotencyKeyRef.current,
      confirmLowStock,
      locale: locale as 'ar' | 'en',
      pointsToRedeem: usePoints ? availablePoints : 0,
      coupon: appliedCoupon ? { couponId: appliedCoupon.id } : undefined,
    })

    if (result.requiresStockConfirmation && result.stock_warnings) {
      setStockWarnings(result.stock_warnings.map(w => w.name_ar))
      setPendingStockMode(paymentMode)
      setLoading(false)
      return null
    }

    if (result.error || !result.orderId) {
      if (result.fieldErrors) {
        const serverErrors: typeof errors = {}
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          const localized = localizeCheckoutError(message)
          if (field === 'order.customer_name') serverErrors.customerName = localized
          if (field === 'order.customer_phone') serverErrors.customerPhone = localized
          if (field === 'order.delivery_building') serverErrors.deliveryBuilding = localized
          if (field === 'order.delivery_street') serverErrors.deliveryStreet = localized
          if (field === 'order.delivery_area') serverErrors.deliveryArea = localized
        }
        setErrors(serverErrors)
        setLoading(false)
        return null
      }
      if (result.stock_warnings && result.stock_warnings.length > 0) {
        setStockWarnings(result.stock_warnings.map(w => w.name_ar))
      }
      throw new Error(result.error ?? t('errors.orderCreationFailed'))
    }

    if (result.stock_warnings && result.stock_warnings.length > 0) {
      setStockWarnings(result.stock_warnings.map(w => w.name_ar))
    }

    return {
      orderId: result.orderId,
      accessToken: result.accessToken ?? null,
      values,
      deliveryAddress,
      restaurantWhatsAppLink: result.restaurantWhatsAppLink,
      customerWhatsAppLink: result.customerWhatsAppLink,
    }
  }

  // ── Submit via WhatsApp ────────────────────────────────────────────────────

  async function handleWASubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitError(null)
    gtag.beginCheckout({ value: subtotal, itemCount: items.length })
    gtag.whatsappClick('checkout')

    try {
      const res = await validateAndCreate('cod')
      if (!res) return

      const { orderId, accessToken } = res
      if (res.restaurantWhatsAppLink) {
        window.open(res.restaurantWhatsAppLink, '_blank', 'noopener,noreferrer')
      }
      clearCart()
      router.push(`/order/${orderId}${accessToken ? `?t=${encodeURIComponent(accessToken)}` : ''}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(t('errors.generic', { message: msg }))
      setLoading(false)
    }
  }

  // ── Submit direct payment (no WA) ─────────────────────────────────────────

  async function handlePaymentSubmit() {
    setErrors({})
    setSubmitError(null)

    try {
      const res = await validateAndCreate('online')
      if (!res) return

      clearCart()
      router.push(`/payment/${res.orderId}${res.accessToken ? `?t=${encodeURIComponent(res.accessToken)}` : ''}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(t('errors.generic', { message: msg }))
      setLoading(false)
    }
  }

  async function handleConfirmLowStock() {
    if (!pendingStockMode) return
    setSubmitError(null)
    try {
      const res = await validateAndCreate(pendingStockMode, true)
      if (!res) return

      setPendingStockMode(null)
      if (pendingStockMode === 'cod') {
        if (res.restaurantWhatsAppLink) {
          window.open(res.restaurantWhatsAppLink, '_blank', 'noopener,noreferrer')
        }
      }
      clearCart()
      const path = pendingStockMode === 'cod' ? 'order' : 'payment'
      router.push(`/${path}/${res.orderId}${res.accessToken ? `?t=${encodeURIComponent(res.accessToken)}` : ''}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(t('errors.generic', { message: msg }))
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
          {t('emptyCart')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/menu')}
          aria-label={t('browseMenu')}
          className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors duration-150"
        >
          {t('browseMenu')}
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleWASubmit}
      dir={isAr ? 'rtl' : 'ltr'}
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-36"
    >
      {/* Header */}
      <div className={`mb-10 ${isAr ? 'text-end' : 'text-start'}`}>
        <h1
          className={`text-3xl sm:text-4xl font-black text-brand-text mb-2
            ${isAr ? 'font-cairo' : 'font-editorial'}`}
        >
          {t('title')}
        </h1>
        <p className={`text-brand-muted text-sm sm:text-base ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('subtitle')}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
        <div className="min-w-0">
      {/* STEP 1: Branch Selection */}
      <StepHeader
        number="1"
        title={t('steps.branch')}
        icon={Store}
      />
      <SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BRANCH_LIST.filter(b => b.status === 'active').map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                setSelectedBranch(branch.id)
                setErrors((prev) => { const n = { ...prev }; delete n.branchId; return n })
              }}
              className={`relative rounded-xl border p-4 text-start transition-all duration-200 group
                         ${selectedBranch === branch.id
                           ? 'border-brand-gold bg-brand-gold/10'
                           : 'border-brand-border bg-brand-surface-2 hover:border-brand-gold/40'
                         }`}
            >
              <div className={`flex justify-between items-start mb-2 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Store size={16} className={selectedBranch === branch.id ? 'text-brand-gold' : 'text-brand-muted'} />
                  <span className={`font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                    {isAr ? branch.nameAr : branch.nameEn}
                  </span>
                </div>
                {selectedBranch === branch.id && (
                  <CheckCircle size={16} className="text-brand-gold" />
                )}
              </div>
              <p className={`text-xs ${selectedBranch === branch.id ? 'text-brand-gold' : 'text-brand-muted'} ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                {isAr ? branch.hours.ar : branch.hours.en}
              </p>
              <p className={`text-[10px] mt-1 text-brand-muted/60 ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                {t('branchAvailable')}
              </p>
            </button>
          ))}
        </div>
        {errors.branchId && (
          <p className="mt-3 text-xs text-brand-error font-almarai flex items-center gap-1">
            <span className="shrink-0">⚠</span> {errors.branchId}
          </p>
        )}
        {selectedBranchSupport && (
          <div className={`mt-4 rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-3 text-sm ${isAr ? 'text-end' : 'text-start'}`}>
            <p className={`mb-2 font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('branchSupport')}
            </p>
            <div className={`flex flex-wrap gap-3 ${isAr ? 'justify-end' : 'justify-start'}`}>
              <a
                href={`tel:${selectedBranchSupport.phone}`}
                className="inline-flex items-center gap-2 text-brand-gold hover:text-brand-gold-light"
                dir="ltr"
              >
                <Phone size={14} />
                {selectedBranchSupport.phone}
              </a>
              <a
                href={selectedBranchSupport.waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-gold hover:text-brand-gold-light"
              >
                <Send size={14} />
                {t('branchWhatsapp')}
              </a>
            </div>
          </div>
        )}
      </SectionCard>

      {/* STEP 2: Customer Information */}
      <StepHeader
        number="2"
        title={t('steps.customer')}
        icon={User}
      />
      <SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="checkout-name"
              className={`text-xs font-bold text-brand-muted uppercase tracking-wide flex items-center gap-1.5
                ${isAr ? 'font-almarai flex-row-reverse' : 'font-satoshi'}`}
            >
              <User size={12} className="text-brand-gold/70" />
              {t('name')} <span className="text-brand-error">*</span>
            </label>
            <input
              id="checkout-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className={`w-full bg-brand-surface-2 border rounded-xl ps-4 pe-4 py-3 min-h-[48px]
                         text-brand-text text-sm sm:text-base placeholder:text-brand-muted/40
                         focus:border-brand-gold focus:outline-none transition-all duration-200
                         ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}
                         ${errors.customerName ? 'border-brand-error' : 'border-brand-border'}`}
            />
            {errors.customerName && (
              <p className="text-[11px] text-brand-error font-almarai">{errors.customerName}</p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="checkout-phone"
              className={`text-xs font-bold text-brand-muted uppercase tracking-wide flex items-center gap-1.5
                ${isAr ? 'font-almarai flex-row-reverse' : 'font-satoshi'}`}
            >
              <Phone size={12} className="text-brand-gold/70" />
              {t('phone')} <span className="text-brand-error">*</span>
            </label>
            <input
              id="checkout-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              dir="ltr"
              className={`w-full bg-brand-surface-2 border rounded-xl ps-4 pe-4 py-3 min-h-[48px]
                         text-brand-text text-sm sm:text-base font-satoshi placeholder:text-brand-muted/40
                         focus:border-brand-gold focus:outline-none transition-all duration-200
                         ${errors.customerPhone ? 'border-brand-error' : 'border-brand-border'}`}
            />
            {errors.customerPhone ? (
              <p className="text-[11px] text-brand-error font-almarai">{errors.customerPhone}</p>
            ) : (
              <p className={`text-[10px] text-brand-muted/60 ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                {t('phoneHint')}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* STEP 3: Delivery Method & Address */}
      <StepHeader
        number="3"
        title={t('steps.address')}
        icon={Truck}
      />
      <SectionCard className="p-4 sm:p-5">
        {/* Delivery / Pickup selector */}
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => {
              setOrderType('delivery')
              setErrors(p => { const n = { ...p }; delete n.address; return n })
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-bold text-sm
              ${orderType === 'delivery'
                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/40'}
              ${isAr ? 'font-almarai flex-row-reverse' : 'font-satoshi'}`}
          >
            <Truck size={16} className={orderType === 'delivery' ? 'text-brand-gold' : 'text-brand-muted'} />
            {t('delivery')}
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderType('pickup')
              setErrors(p => { const n = { ...p }; delete n.address; return n })
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-bold text-sm
              ${orderType === 'pickup'
                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/40'}
              ${isAr ? 'font-almarai flex-row-reverse' : 'font-satoshi'}`}
          >
            <Package size={16} className={orderType === 'pickup' ? 'text-brand-gold' : 'text-brand-muted'} />
            {t('pickup')}
          </button>
        </div>

        {/* Pickup confirmation banner */}
        {orderType === 'pickup' && (
          <div className="rounded-xl border border-brand-success/30 bg-brand-success/5 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-success/20 flex items-center justify-center shrink-0">
              <Package size={20} className="text-brand-success" />
            </div>
            <div>
              <p className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('pickupReadyTitle')}
              </p>
              <p className={`text-[11px] text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('pickupReadyHint')}
              </p>
            </div>
          </div>
        )}

        {/* Address input — delivery only */}
        {orderType === 'delivery' && (
          <div className="space-y-6">
            {/* GPS Section */}
            <div className="space-y-3">
              {!gpsCoords ? (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={gpsLoading}
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl border border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/40 transition-all font-bold text-sm
                    ${isAr ? 'font-almarai flex-row-reverse' : 'font-satoshi'}`}
                >
                  {gpsLoading ? (
                    <Loader2 size={18} className="animate-spin text-brand-gold" />
                  ) : (
                    <Send size={18} className="text-brand-muted" />
                  )}
                  {t('address.gps')}
                </button>
              ) : (
                <div className={`rounded-xl border border-brand-success/30 bg-brand-success/5 p-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-10 h-10 rounded-full bg-brand-success/20 flex items-center justify-center shrink-0">
                    <CheckCircle size={20} className="text-brand-success" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                      {t('address.gpsSuccess')}
                    </p>
                    <p className={`text-[11px] text-brand-muted font-satoshi tabular-nums ${isAr ? 'text-end' : 'text-start'}`}>
                      {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setGpsCoords(null)}
                    className="text-xs text-brand-error/60 hover:text-brand-error font-almarai px-2 py-1"
                  >
                    {isAr ? 'حذف' : 'Remove'}
                  </button>
                </div>
              )}
              
              {gpsError && (
                <div className="rounded-xl border border-brand-error/30 bg-brand-error/5 p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-error/20 flex items-center justify-center shrink-0">
                    <span className="text-brand-error font-bold">!</span>
                  </div>
                  <p className="text-xs text-brand-error font-almarai">
                    {gpsError}
                  </p>
                </div>
              )}
            </div>

            {/* Manual Fields Section */}
            <div className="space-y-4">
              <div className={`flex items-center gap-2 mb-2 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                <Edit size={14} className="text-brand-gold" />
                <span className={`text-xs font-bold text-brand-text opacity-60 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('address.manual')}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`block text-[10px] sm:text-[11px] font-bold text-brand-gold uppercase tracking-[0.1em] ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                    {t('address.block')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualAddr.block}
                    onChange={(e) => setManualAddr(p => ({ ...p, block: e.target.value }))}
                    placeholder={t('address.blockPlaceholder')}
                    className={`w-full bg-brand-surface-2 border border-brand-border rounded-xl px-4 py-3.5 text-sm sm:text-base text-brand-text focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 outline-none transition-all duration-200 ${isAr ? 'text-end font-almarai' : 'text-start font-satoshi'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] sm:text-[11px] font-bold text-brand-gold uppercase tracking-[0.1em] ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                    {t('address.road')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualAddr.road}
                    onChange={(e) => setManualAddr(p => ({ ...p, road: e.target.value }))}
                    placeholder={t('address.roadPlaceholder')}
                    className={`w-full bg-brand-surface-2 border border-brand-border rounded-xl px-4 py-3.5 text-sm sm:text-base text-brand-text focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 outline-none transition-all duration-200 ${isAr ? 'text-end font-almarai' : 'text-start font-satoshi'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] sm:text-[11px] font-bold text-brand-gold uppercase tracking-[0.1em] ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                    {t('address.building')}
                  </label>
                  <input
                    type="text"
                    value={manualAddr.building}
                    onChange={(e) => setManualAddr(p => ({ ...p, building: e.target.value }))}
                    placeholder={t('address.buildingPlaceholder')}
                    className={`w-full bg-brand-surface-2 border border-brand-border rounded-xl px-4 py-3.5 text-sm sm:text-base text-brand-text focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 outline-none transition-all duration-200 ${isAr ? 'text-end font-almarai' : 'text-start font-satoshi'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] sm:text-[11px] font-bold text-brand-gold uppercase tracking-[0.1em] ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                    {t('address.flat')}
                  </label>
                  <input
                    type="text"
                    value={manualAddr.flat}
                    onChange={(e) => setManualAddr(p => ({ ...p, flat: e.target.value }))}
                    placeholder={t('address.flatPlaceholder')}
                    className={`w-full bg-brand-surface-2 border border-brand-border rounded-xl px-4 py-3.5 text-sm sm:text-base text-brand-text focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/20 outline-none transition-all duration-200 ${isAr ? 'text-end font-almarai' : 'text-start font-satoshi'}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {errors.address && (
          <p className="mt-4 text-xs text-brand-error font-almarai flex items-center gap-2 bg-brand-error/5 p-3 rounded-lg border border-brand-error/20">
            <span className="shrink-0 text-lg">⚠</span> {errors.address}
          </p>
        )}
        {(errors.deliveryArea || errors.deliveryBuilding || errors.deliveryStreet) && (
          <div className="mt-4 text-xs text-brand-error font-almarai bg-brand-error/5 p-3 rounded-lg border border-brand-error/20">
            {[errors.deliveryArea, errors.deliveryBuilding, errors.deliveryStreet].filter(Boolean).join(t('listSeparator'))}
          </div>
        )}
      </SectionCard>

      {/* STEP 4: Notes */}
      <StepHeader
        number="4"
        title={t('steps.notes')}
        icon={Notebook}
      />
      <SectionCard>
        <textarea
          id="checkout-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
          rows={3}
          className={`w-full bg-brand-surface-2 border border-brand-border rounded-xl
                     ps-4 pe-4 py-3 min-h-[100px] resize-none
                     text-brand-text text-sm sm:text-base placeholder:text-brand-muted/40
                     focus:border-brand-gold focus:outline-none transition-all duration-200
                     ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}
        />
      </SectionCard>

      {/* STEP 5: Coupon Code */}
      <StepHeader
        number="5"
        title={t('steps.coupon')}
        icon={Tag}
      />
      <SectionCard className="p-0">
        <CouponInput
          customerId={customerProfile?.id ?? null}
          orderTotal={subtotal}
          appliedCoupon={appliedCoupon}
          onApply={setAppliedCoupon}
          onRemove={() => setAppliedCoupon(null)}
        />
      </SectionCard>

        </div>
        <aside className="min-w-0 lg:sticky lg:top-6">
      {/* STEP 6: Order Summary */}
      <StepHeader
        number="6"
        title={t('steps.summary')}
        icon={ShoppingCart}
      />
      <SectionCard className="p-0 overflow-hidden">
        <div className="divide-y divide-brand-border">
          {items.map((item) => (
            <div key={item.cartKey} className={`flex items-start gap-4 p-4 ${isAr ? 'flex-row-reverse text-end' : 'flex-row text-start'}`}>
              {/* Product Image */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-brand-border bg-brand-black">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={isAr ? item.nameAr : item.nameEn}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-muted/20">
                    <ShoppingCart size={24} />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0 py-0.5">
                <div className={`flex justify-between items-start gap-2 mb-1 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                  <h3 className={`text-sm sm:text-base font-bold text-brand-text truncate ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                    {isAr ? item.nameAr : item.nameEn}
                  </h3>
                  <button
                    type="button"
                    onClick={() => useCartStore.getState().removeItem(item.cartKey)}
                    className="text-brand-error/60 hover:text-brand-error transition-colors p-1"
                    aria-label={t('removeItem')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {(item.selectedSize || item.selectedVariant) && (
                  <p className={`text-[11px] text-brand-muted mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {[item.selectedSize, item.selectedVariant].filter(Boolean).join(' · ')}
                  </p>
                )}

                {/* Quantity Controls & Price */}
                <div className={`flex items-center justify-between mt-auto ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="flex items-center bg-brand-surface-2 border border-brand-border rounded-lg overflow-hidden h-8">
                    <button
                      type="button"
                      onClick={() => useCartStore.getState().updateQuantity(item.cartKey, item.quantity - 1)}
                      aria-label={t('decreaseQuantity')}
                      className="px-2 h-full hover:bg-brand-gold/10 text-brand-muted hover:text-brand-gold transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-brand-text font-satoshi tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => useCartStore.getState().updateQuantity(item.cartKey, item.quantity + 1)}
                      aria-label={t('increaseQuantity')}
                      className="px-2 h-full hover:bg-brand-gold/10 text-brand-muted hover:text-brand-gold transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="font-satoshi font-bold text-brand-gold text-sm tabular-nums">
                    {formatPriceFils(selectLineTotalFils(item), locale)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Breakdown */}
        <div className="bg-brand-surface-2 p-5 space-y-3">
          <div className={`flex justify-between items-center text-sm ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className={`text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('subtotal')}
            </span>
            <span className="font-satoshi text-brand-text tabular-nums">
              {formatPrice(subtotal, locale)}
            </span>
          </div>

          {couponDiscount > 0 && (
            <div className={`flex justify-between items-center text-sm ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                <Tag size={12} className="text-brand-success" />
                <span className={`text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('couponDiscount', { code: appliedCoupon?.code ?? '' })}
                </span>
              </div>
              <span className="font-satoshi text-brand-success tabular-nums">
                {formatPrice(-couponDiscount, locale)}
              </span>
            </div>
          )}

          {pointsDiscount > 0 && (
            <div className={`flex justify-between items-center text-sm ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
                <CheckCircle size={12} className="text-brand-success" />
                <span className={`text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('pointsDiscount')}
                </span>
              </div>
              <span className="font-satoshi text-brand-success tabular-nums">
                {formatPrice(-pointsDiscount, locale)}
              </span>
            </div>
          )}

          <div className={`flex justify-between items-center pt-3 border-t border-brand-border/50 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className={`text-base font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {t('total')}
            </span>
            <div className="text-end">
              <span className="font-satoshi font-black text-brand-gold text-2xl tabular-nums">
                {formatPrice(finalTotal, locale)}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Points Redemption (only if available) */}
      {customerProfile && customerProfile.points_balance >= MIN_REDEMPTION && (
        <section aria-labelledby="loyalty-heading">
          <h2 id="loyalty-heading" className="mb-3 text-sm font-semibold text-brand-text-muted">
            {t('loyalty.heading')}
          </h2>
          <LoyaltyRedemptionWidget
            pointsBalance={customerProfile.points_balance}
            isActive={usePoints}
            onToggle={setUsePoints}
            locale={locale}
            t={t}
          />
        </section>
      )}

      {/* STEP 7: Complete Your Order */}
      <StepHeader
        number="7"
        title={t('steps.complete')}
        icon={CheckCircle}
      />
      <div className="space-y-4">
        {stockWarnings.length > 0 && (
          <div className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm text-brand-gold font-almarai">
            ⚠ {t('stockWarningPrefix')} {stockWarnings.join(t('listSeparator'))}
          </div>
        )}

        {pendingStockMode && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-black/80 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-brand-gold/30 bg-brand-surface p-5 text-center">
              <p className={`mb-3 text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {t('stockLimitedTitle')}
              </p>
              <p className={`mb-5 text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {stockWarnings.join(t('listSeparator'))}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPendingStockMode(null); setLoading(false) }}
                  className="flex-1 rounded-xl border border-brand-border px-4 py-3 text-sm font-bold text-brand-muted"
                >
                  {t('back')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLowStock}
                  className="flex-1 rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold text-brand-black"
                >
                  {t('continue')}
                </button>
              </div>
            </div>
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-brand-error/50 bg-brand-error/10 px-4 py-3 text-sm text-brand-error font-almarai text-center">
            ⚠ {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CinematicButton
            type="submit"
            disabled={loading}
            isRTL={isAr}
            className="w-full py-4 text-base font-bold rounded-xl"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                {t('processing')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {t('placeOrder')}
              </span>
            )}
          </CinematicButton>

          <CinematicButton
            type="button"
            disabled={loading}
            isRTL={isAr}
            onClick={handlePaymentSubmit}
            variant="secondary" // Assuming variant exists or I'll customize className
            className="w-full py-4 text-base font-bold rounded-xl border border-brand-gold text-brand-gold bg-transparent hover:bg-brand-gold/5"
          >
            {t('payNow')}
          </CinematicButton>
        </div>

        <div className={`text-center space-y-2 mt-4`}>
          <p className={`text-[11px] text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('paymentNote')}
          </p>
          <p className={`text-[11px] text-brand-muted opacity-60 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('termsPrefix')}{' '}
            <Link href="/privacy" className="text-brand-gold hover:text-brand-gold-light">
              {t('privacyPolicy')}
            </Link>
            {' / '}
            <Link href="/terms" className="text-brand-gold hover:text-brand-gold-light">
              {t('termsOfService')}
            </Link>
            {' / '}
            <Link href="/refund-policy" className="text-brand-gold hover:text-brand-gold-light">
              {t('refundPolicy')}
            </Link>
          </p>
        </div>
      </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-brand-border bg-brand-black/95 px-4 py-3 shadow-[0_-16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md lg:hidden">
        <div className={`mx-auto flex max-w-md items-center gap-3 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`min-w-0 flex-1 ${isAr ? 'text-end' : 'text-start'}`}>
            <p className={`text-[11px] text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('mobileItems', { count: totalItems })}
            </p>
            <p className="font-satoshi text-xl font-black text-brand-gold tabular-nums">
              {formatPrice(finalTotal, locale)}
            </p>
          </div>
          <CinematicButton
            type="submit"
            disabled={loading}
            isRTL={isAr}
            className="h-12 shrink-0 rounded-xl px-5 text-sm font-bold"
          >
            {loading ? t('processing') : t('placeOrder')}
          </CinematicButton>
        </div>
      </div>
    </form>
  )
}
