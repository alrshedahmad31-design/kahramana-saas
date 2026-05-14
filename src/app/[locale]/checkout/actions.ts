'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { BRANCHES, type BranchId } from '@/constants/contact'
import { pointsToCredit } from '@/lib/loyalty/calculations'
import { getLoyaltyConfig } from '@/lib/loyalty/config'
import { calculateDiscount } from '@/lib/coupons/calculations'
import { createOrderAccessToken } from '@/lib/auth/order-access'
import type { CouponUsageInsert, CouponRow } from '@/lib/supabase/custom-types'
import { resolveCheckoutMenuItemPrice } from '@/lib/menu'
import { resolveBestPromotion } from '@/lib/promotions/server'
import { buildOrderTrackingUrl, buildPricedCheckoutWhatsAppLinks } from '@/lib/whatsapp'
import { sendOrderConfirmation } from '@/lib/email/send'
import { geocodeBahrainAddress } from '@/lib/utils/geocode'
import { toSafeError } from '@/lib/utils/safe-error'

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-().]/g, '')
  if (s.startsWith('00973')) return '+973' + s.slice(5)
  if (s.startsWith('+973')) return s
  if (s.startsWith('973') && s.length === 11) return '+' + s
  if (/^\d{8}$/.test(s)) return '+973' + s
  return s
}

// ── Server-side input validation ──────────────────────────────────────────────
// Sanity-check the payload before touching the DB. unit_price_bhd remains
// client-supplied (size/variant pricing lives in Sanity, not the DB) but we
// reject obviously hostile inputs (negative/huge prices, oversized carts).

const itemSchema = z.object({
  menu_item_slug:   z.string().min(1).max(120),
  selected_size:    z.string().max(50).nullable(),
  selected_variant: z.string().max(50).nullable(),
  quantity:         z.number().int().min(1).max(50),
  notes:            z.string().max(300).nullable().optional(),
})

const BAHRAIN_PHONE_RE = /^(\+?973)?[36]\d{7}$/

function isValidBahrainPhone(value: string | null): boolean {
  if (!value) return false
  return BAHRAIN_PHONE_RE.test(value.replace(/\s+/g, ''))
}

const orderSchema = z.object({
  customer_name:       z.string().max(120).nullable(),
  customer_phone:      z.string().max(20).nullable(),
  branch_id:           z.string().min(1).max(50),
  status:              z.literal('new'),
  order_type:          z.enum(['delivery', 'pickup']),
  notes:               z.string().max(500).nullable(),
  customer_notes:      z.string().max(500).nullable(),
  delivery_address:    z.string().max(1000).nullable(),
  delivery_building:   z.string().max(120).nullable(),
  delivery_street:     z.string().max(120).nullable(),
  delivery_area:       z.string().max(120).nullable(),
  delivery_lat:        z.number().nullable(),
  delivery_lng:        z.number().nullable(),
  source:              z.string().max(50),
  whatsapp_sent_at:    z.null(),
})

const checkoutSchema = z.object({
  order:          orderSchema,
  items:          z.array(itemSchema).min(1).max(60),
  clientSubtotalBhd: z.number().min(0.001).max(50_000),
  paymentMode:    z.enum(['cod', 'online']),
  idempotency_key: z.string().uuid(),
  confirmLowStock: z.boolean().optional(),
  locale:         z.enum(['ar', 'en']),
  pointsToRedeem: z.number().int().min(0).max(1_000_000),
  coupon:         z.object({ couponId: z.string().uuid() }).optional(),
}).superRefine((value, ctx) => {
  const name = value.order.customer_name?.trim() ?? ''
  if (name.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['order', 'customer_name'],
      message: 'name_required',
    })
  }

  if (!isValidBahrainPhone(value.order.customer_phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['order', 'customer_phone'],
      message: 'phone_invalid',
    })
  }

  if (value.order.order_type === 'delivery') {
    if (!value.order.delivery_building?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['order', 'delivery_building'],
        message: 'building_required',
      })
    }
    if (!value.order.delivery_street?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['order', 'delivery_street'],
        message: 'road_required',
      })
    }
    if (!value.order.delivery_area?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['order', 'delivery_area'],
        message: 'block_required',
      })
    }
  }
})

type TypedSupabase = Awaited<ReturnType<typeof createServiceClient>>

interface OrderBase {
  customer_name:       string | null
  customer_phone:      string | null
  branch_id:           string
  status:              'new'
  order_type:          'delivery' | 'pickup'
  notes:               string | null
  customer_notes:      string | null
  delivery_address:    string | null
  delivery_building:   string | null
  delivery_street:     string | null
  delivery_area:       string | null
  delivery_lat:        number | null
  delivery_lng:        number | null
  source:              string
  whatsapp_sent_at:    null
}

interface ItemBase {
  menu_item_slug:   string
  selected_size:    string | null
  selected_variant: string | null
  quantity:         number
  notes?:           string | null
}

interface PricedItemBase extends ItemBase {
  name_ar:          string
  name_en:          string
  unit_price_bhd:   number
  item_total_bhd:   number
}

interface CouponPayload {
  couponId: string
}

interface CheckoutPayload {
  order:          OrderBase
  items:          ItemBase[]
  clientSubtotalBhd: number
  paymentMode:    'cod' | 'online'
  idempotency_key: string
  confirmLowStock?: boolean
  locale:         'ar' | 'en'
  pointsToRedeem: number
  coupon?:        CouponPayload
}

interface StockWarning {
  menu_item_slug:     string
  name_ar:            string
  shortage_ingredient: string | null
  shortage_required?: number
  shortage_available?: number
}

interface CheckoutResult {
  orderId:       string
  finalTotal:    number
  accessToken?:  string
  error?:        string
  fieldErrors?:  Record<string, string>
  stock_warnings?: StockWarning[]
  requiresStockConfirmation?: boolean
  restaurantWhatsAppLink?: string
  customerWhatsAppLink?: string
}

function getPaymentExpiresAt(paymentMode: 'cod' | 'online'): string | null {
  if (paymentMode === 'cod') return null
  return new Date(Date.now() + 20 * 60 * 1000).toISOString()
}

function buildCheckoutLinks(
  orderId: string,
  accessToken: string,
  locale: 'ar' | 'en',
  branchId: BranchId,
  orderData: OrderBase,
  pricedItems: PricedItemBase[],
  subtotalBhd: number,
  totalBhd: number,
) {
  return buildPricedCheckoutWhatsAppLinks(
    pricedItems.map((item) => ({
      nameAr: item.name_ar,
      nameEn: item.name_en,
      quantity: item.quantity,
      selectedSize: item.selected_size,
      selectedVariant: item.selected_variant,
      unitPriceBhd: item.unit_price_bhd,
      lineTotalBhd: item.item_total_bhd,
      notes: item.notes,
    })),
    {
      locale,
      branchId,
      orderId,
      orderNumber: orderId.slice(-8).toUpperCase(),
      orderType: orderData.order_type,
      customerName: orderData.customer_name ?? '',
      customerPhone: orderData.customer_phone ?? '',
      address: orderData.delivery_address,
      notes: orderData.notes,
      trackingUrl: buildOrderTrackingUrl(orderId, locale, accessToken),
      subtotalBhd,
      totalBhd,
    },
  )
}

async function createInitialPayment(
  supabase: TypedSupabase,
  orderId: string,
  amountBhd: number,
  paymentMode: 'cod' | 'online',
  expiresAt: string | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payments')
    .insert({
      order_id:    orderId,
      amount_bhd:  amountBhd,
      method:      paymentMode === 'cod' ? 'cash' : null,
      status:      paymentMode === 'cod' ? 'pending_cod' : 'pending',
      expires_at:  expiresAt,
    })

  return { error: error?.message }
}

async function findExistingOrderByIdempotencyKey(
  supabase: TypedSupabase,
  idempotencyKey: string,
): Promise<CheckoutResult | null> {
  const { data: existing, error } = await supabase
    .from('orders')
    .select('id, total_bhd')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error || !existing) return null

  return {
    orderId: existing.id,
    finalTotal: Number(existing.total_bhd),
    accessToken: createOrderAccessToken(existing.id),
  }
}

function mapValidationErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path) fieldErrors[path] = issue.message
  }
  return fieldErrors
}

function isBranchId(value: string): value is BranchId {
  return value in BRANCHES
}

async function ensureCheckoutBranch(
  supabase: TypedSupabase,
  branchId: string,
): Promise<{ branchId: BranchId } | { error: string }> {
  if (!isBranchId(branchId)) {
    return { error: 'Invalid branch selected' }
  }

  const branch = BRANCHES[branchId]
  if (branch.status !== 'active') {
    return { error: 'Selected branch is not accepting orders' }
  }

  const { data: existing, error: selectError } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .maybeSingle()

  if (selectError) return { error: toSafeError(selectError) }
  if (existing) return { branchId }

  const { error: upsertError } = await supabase
    .from('branches')
    .upsert({
      id:        branch.id,
      name_ar:   branch.nameAr,
      name_en:   branch.nameEn,
      phone:     branch.phone,
      whatsapp:  branch.whatsapp,
      wa_link:   branch.waLink,
      maps_url:  branch.mapsUrl,
      is_active: branch.status === 'active',
    }, { onConflict: 'id' })

  if (upsertError) return { error: toSafeError(upsertError) }

  return { branchId }
}

// ── Server-side subtotal ──────────────────────────────────────────────────────
// Use item_total_bhd which is already computed as quantity × unitPriceBhd
// inside repriceCheckoutItems (server-resolved price). This prevents a
// client-tampered unit_price_bhd from silently under-billing on edge cases.
function computeSubtotal(items: PricedItemBase[]): number {
  return items.reduce((sum, item) => sum + item.item_total_bhd, 0)
}

function repriceCheckoutItems(
  items: ItemBase[],
): { items: PricedItemBase[]; subtotal: number } | { error: string } {
  const pricedItems: PricedItemBase[] = []

  for (const item of items) {
    const resolved = resolveCheckoutMenuItemPrice(item.menu_item_slug, {
      size: (item.selected_size && item.selected_size !== '') ? item.selected_size : undefined,
      variant: (item.selected_variant && item.selected_variant !== '') ? item.selected_variant : undefined,
    })

    if ('error' in resolved) return { error: resolved.error }

    pricedItems.push({
      menu_item_slug:   resolved.item.slug,
      name_ar:          resolved.item.name.ar,
      name_en:          resolved.item.name.en,
      selected_size:    item.selected_size,
      selected_variant: resolved.selectedVariant,
      quantity:         item.quantity,
      notes:            item.notes?.trim() || null,
      unit_price_bhd:   resolved.unitPriceBhd,
      item_total_bhd:   Number((item.quantity * resolved.unitPriceBhd).toFixed(3)),
    })
  }

  const subtotal = Number(computeSubtotal(pricedItems).toFixed(3))
  return { items: pricedItems, subtotal }
}

// ── Server-side coupon re-validation ─────────────────────────────────────────
// Ignore client-supplied couponDiscount. Fetch the coupon from DB and
// recompute the discount server-side so it cannot be inflated by the client.
async function fetchAndComputeCouponDiscount(
  supabase: TypedSupabase,
  couponId: string,
  subtotal: number,
  customerId: string,
  branchId: string,
): Promise<{ discount: number; coupon: CouponRow } | { error: string }> {
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('id', couponId)
    .eq('is_active', true)
    .single()

  if (error || !coupon) return { error: 'Coupon not found or inactive' }

  const now = new Date()
  if (coupon.paused) {
    return { error: 'Coupon is paused' }
  }
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { error: 'Coupon is not active yet' }
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { error: 'Coupon has expired' }
  }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return { error: 'Coupon usage limit reached' }
  }
  if (subtotal < (coupon.min_order_value_bhd ?? 0)) {
    return { error: 'Order total below coupon minimum' }
  }
  if (coupon.applicable_branches?.length && !coupon.applicable_branches.includes(branchId)) {
    return { error: 'Coupon is not valid for this branch' }
  }
  if (coupon.days_active?.length && !coupon.days_active.includes(now.getDay())) {
    return { error: 'Coupon is not valid today' }
  }

  const currentTime = now.toTimeString().slice(0, 5)
  if (coupon.time_start && currentTime < coupon.time_start.slice(0, 5)) {
    return { error: 'Coupon is not active at this time' }
  }
  if (coupon.time_end && currentTime > coupon.time_end.slice(0, 5)) {
    return { error: 'Coupon is not active at this time' }
  }

  const { count: customerUsageCount, error: usageError } = await supabase
    .from('coupon_usages')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', couponId)
    .eq('customer_id', customerId)

  if (usageError) return { error: toSafeError(usageError) }
  if ((customerUsageCount ?? 0) >= coupon.per_customer_limit) {
    return { error: 'Coupon customer limit reached' }
  }

  const discount = calculateDiscount(coupon, subtotal)
  return { discount, coupon }
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function createOrderWithPoints(payload: CheckoutPayload): Promise<CheckoutResult> {
  // Normalize phone to +973XXXXXXXX before validation so the DB lookup matches customer_profiles
  const normalizedPayload: CheckoutPayload = payload.order.customer_phone
    ? { ...payload, order: { ...payload.order, customer_phone: normalizePhone(payload.order.customer_phone) } }
    : payload

  const parsed = checkoutSchema.safeParse(normalizedPayload)
  if (!parsed.success) {
    return {
      orderId: '',
      finalTotal: 0,
      error: 'Invalid checkout payload',
      fieldErrors: mapValidationErrors(parsed.error),
    }
  }

  try {
    const {
      order: orderData, items, clientSubtotalBhd, paymentMode,
      idempotency_key, confirmLowStock, locale, pointsToRedeem, coupon,
    } = parsed.data

    const pointsDiscount = pointsToCredit(pointsToRedeem ?? 0)

    const supabase = await createServiceClient()

    // Early idempotency check — avoids the full RPC round-trip on duplicate submission
    const existingOrder = await findExistingOrderByIdempotencyKey(supabase, idempotency_key)
    if (existingOrder) return existingOrder

    const repriced = repriceCheckoutItems(items)
    if ('error' in repriced) {
      return { orderId: '', finalTotal: 0, error: repriced.error }
    }

    if (Math.abs(repriced.subtotal - clientSubtotalBhd) > 0.001) {
      return { orderId: '', finalTotal: 0, error: 'PRICE_MISMATCH' }
    }

    // ── Blocking stock check before order insertion ───────────────────────────
    const lowStockWarnings: StockWarning[] = []
    const hardStockFailures: StockWarning[] = []
    try {
      const { data: stockRows, error: stockError } = await supabase.rpc('rpc_check_stock_for_cart', {
        p_branch_id: orderData.branch_id,
        p_items: repriced.items.map(i => ({ slug: i.menu_item_slug, qty: i.quantity })),
      })

      if (stockError) {
        return { orderId: '', finalTotal: 0, error: toSafeError(stockError) }
      }

      for (const row of stockRows ?? []) {
        if (row.available) continue

        const item = repriced.items.find((candidate) => candidate.menu_item_slug === row.menu_item_slug)
        const warning: StockWarning = {
          menu_item_slug: row.menu_item_slug,
          name_ar: item?.name_ar ?? row.menu_item_slug,
          shortage_ingredient: row.shortage_ingredient,
          shortage_required: row.shortage_required,
          shortage_available: row.shortage_available,
        }

        if (row.shortage_available <= 0) {
          hardStockFailures.push(warning)
        } else {
          lowStockWarnings.push(warning)
        }
      }
    } catch {
      return { orderId: '', finalTotal: 0, error: 'Stock check failed' }
    }

    if (hardStockFailures.length > 0) {
      return {
        orderId: '',
        finalTotal: 0,
        error: 'OUT_OF_STOCK',
        stock_warnings: hardStockFailures,
      }
    }

    if (lowStockWarnings.length > 0 && !confirmLowStock) {
      return {
        orderId: '',
        finalTotal: 0,
        error: 'LOW_STOCK_CONFIRMATION_REQUIRED',
        stock_warnings: lowStockWarnings,
        requiresStockConfirmation: true,
      }
    }

    // Any flow involving loyalty redemption or a coupon requires a verified
    // customer session — we cannot trust a client-supplied couponId / points
    // amount without knowing who is redeeming.
    let customerSession: Awaited<ReturnType<typeof getCustomerSession>> = null
    if (pointsToRedeem > 0 || coupon) {
      customerSession = await getCustomerSession()
      if (!customerSession) {
        return { orderId: '', finalTotal: 0, error: 'Login required to use points or coupons' }
      }
    }

    const branchResult = await ensureCheckoutBranch(supabase, orderData.branch_id)
    if ('error' in branchResult) {
      return { orderId: '', finalTotal: 0, error: branchResult.error }
    }

    const resolvedOrderData = {
      ...orderData,
      branch_id: branchResult.branchId,
    }

    // ── Nominatim geocoding (free, server-side, silent fallback) ─────────────
    // Only runs when the customer hasn't shared GPS manually.
    // Converts block/road/building numbers to lat/lng so the driver's
    // Google Maps navigation opens on the exact location.
    if (
      resolvedOrderData.order_type === 'delivery' &&
      resolvedOrderData.delivery_lat == null &&
      resolvedOrderData.delivery_lng == null
    ) {
      const coords = await geocodeBahrainAddress({
        block:    resolvedOrderData.delivery_area,
        road:     resolvedOrderData.delivery_street,
        building: resolvedOrderData.delivery_building,
      })
      if (coords) {
        resolvedOrderData.delivery_lat = coords.lat
        resolvedOrderData.delivery_lng = coords.lng
      }
    }

    const expiresAt = getPaymentExpiresAt(paymentMode)

    // ── Server-side total computation (ignores client total_bhd) ─────────────
    const subtotal = repriced.subtotal
    if (subtotal <= 0) return { orderId: '', finalTotal: 0, error: 'Invalid order total' }

    // ── Coupon: re-fetch and recompute server-side ────────────────────────────
    let serverCouponDiscount = 0
    let resolvedCouponId: string | null = null

    if (coupon) {
      if (!customerSession) {
        return { orderId: '', finalTotal: 0, error: 'Login required to use coupons' }
      }
      const result = await fetchAndComputeCouponDiscount(
        supabase,
        coupon.couponId,
        subtotal,
        customerSession.id,
        resolvedOrderData.branch_id,
      )
      if ('error' in result) return { orderId: '', finalTotal: 0, error: result.error }
      serverCouponDiscount = result.discount
      resolvedCouponId = coupon.couponId
    }

    // ── Points: early balance + cap check (RPC performs the atomic final check) ─
    if (pointsToRedeem > 0) {
      const cfg = await getLoyaltyConfig()
      if (pointsToRedeem < cfg.minRedemptionPoints) {
        return { orderId: '', finalTotal: 0, error: `Minimum redemption is ${cfg.minRedemptionPoints} points` }
      }

      // Enforce server-configured redemption cap before hitting the RPC
      if (pointsDiscount > subtotal * cfg.maxRedemptionRatio) {
        return { orderId: '', finalTotal: 0, error: `Points discount cannot exceed ${Math.round(cfg.maxRedemptionRatio * 100)}% of order subtotal` }
      }

      const customer = customerSession ?? await getCustomerSession()
      if (!customer) {
        return { orderId: '', finalTotal: 0, error: 'Customer session required to redeem points' }
      }
      if (pointsToRedeem > customer.points_balance) {
        return { orderId: '', finalTotal: 0, error: 'Insufficient points balance' }
      }
    }

    const finalTotal = Math.max(0.001, subtotal - serverCouponDiscount - pointsDiscount)

    // ── Atomic RPC ────────────────────────────────────────────────────────────
    // Best-effort promotion match — never blocks order creation.
    const promo = await resolveBestPromotion(
      resolvedOrderData.branch_id,
      repriced.items.map((i) => ({
        menu_item_slug: i.menu_item_slug,
        quantity:       i.quantity,
        unit_price_bhd: i.unit_price_bhd,
      })),
    )

    // Idempotency guard + coupon lock/increment + loyalty deduction +
    // order insert + order_items insert — all in one DB transaction.
    const { data: orderId, error: rpcError } = await supabase.rpc('rpc_create_order', {
      p_idempotency_key:        idempotency_key,
      p_customer_name:          resolvedOrderData.customer_name ?? '',
      p_customer_phone:         resolvedOrderData.customer_phone ?? '',
      p_branch_id:              resolvedOrderData.branch_id,
      p_order_type:             resolvedOrderData.order_type,
      p_items:                  repriced.items.map((i) => ({
        menu_item_slug:   i.menu_item_slug,
        name_ar:          i.name_ar,
        name_en:          i.name_en,
        selected_size:    i.selected_size    ?? null,
        selected_variant: i.selected_variant ?? null,
        quantity:         i.quantity,
        notes:            i.notes            ?? null,
        unit_price_bhd:   i.unit_price_bhd,
        item_total_bhd:   i.item_total_bhd,
      })),
      p_total_bhd:              finalTotal,
      p_notes:                  resolvedOrderData.notes            ?? undefined,
      p_customer_notes:         resolvedOrderData.customer_notes   ?? undefined,
      p_delivery_address:       resolvedOrderData.delivery_address  ?? undefined,
      p_delivery_building:      resolvedOrderData.delivery_building ?? undefined,
      p_delivery_street:        resolvedOrderData.delivery_street   ?? undefined,
      p_delivery_area:          resolvedOrderData.delivery_area     ?? undefined,
      p_delivery_lat:           resolvedOrderData.delivery_lat      ?? undefined,
      p_delivery_lng:           resolvedOrderData.delivery_lng      ?? undefined,
      p_source:                 resolvedOrderData.source,
      p_coupon_id:              resolvedCouponId    ?? undefined,
      p_coupon_discount_bhd:    serverCouponDiscount,
      p_points_to_redeem:       pointsToRedeem,
      // C-1: pass customer UUID so service_role call can lock the correct profile
      p_customer_id:            customerSession?.id ?? undefined,
      p_promotion_id:           promo?.promotion_id ?? null,
      p_promotion_discount_bhd: promo?.discount_bhd ?? 0,
    })

    if (rpcError) {
      if (rpcError.message.includes('COUPON_INVALID')) {
        return { orderId: '', finalTotal: 0, error: 'Coupon is no longer valid' }
      }
      if (rpcError.message.includes('INSUFFICIENT_POINTS')) {
        return { orderId: '', finalTotal: 0, error: 'Insufficient points balance' }
      }
      if (rpcError.message.includes('POINTS_OVER_CAP')) {
        return { orderId: '', finalTotal: 0, error: 'Points discount cannot exceed 50% of order subtotal' }
      }
      if (rpcError.message.includes('PRICE_MISMATCH')) {
        return { orderId: '', finalTotal: 0, error: 'Item prices have changed, please refresh and try again' }
      }
      if (rpcError.message.includes('AUTH_REQUIRED')) {
        return { orderId: '', finalTotal: 0, error: 'Authentication required' }
      }
      if (rpcError.code === '23505') {
        const existing = await findExistingOrderByIdempotencyKey(supabase, idempotency_key)
        if (existing) return existing
      }
      // Sentinel codes above (COUPON_INVALID, PRICE_MISMATCH, AUTH_REQUIRED)
      // pass through with user-safe strings. Anything else collapses to a
      // generic message to keep RPC internals out of the public response.
      return { orderId: '', finalTotal: 0, error: toSafeError(rpcError) }
    }

    if (!orderId) return { orderId: '', finalTotal: 0, error: 'Order creation failed' }

    // ── Payment record ────────────────────────────────────────────────────────
    const paymentResult = await createInitialPayment(supabase, orderId, finalTotal, paymentMode, expiresAt)
    if (paymentResult.error) return { orderId: '', finalTotal: 0, error: paymentResult.error }

    // ── Coupon usage record (increment already committed inside the RPC) ──────
    if (resolvedCouponId && customerSession) {
      const usage: CouponUsageInsert = {
        coupon_id:           resolvedCouponId,
        customer_id:         customerSession.id,
        order_id:            orderId,
        discount_amount_bhd: serverCouponDiscount,
      }
      await supabase.from('coupon_usages').insert(usage)
    }

    const accessToken = createOrderAccessToken(orderId)
    const links = buildCheckoutLinks(
      orderId,
      accessToken,
      locale,
      branchResult.branchId,
      resolvedOrderData,
      repriced.items,
      subtotal,
      finalTotal,
    )

    // Fire-and-forget order confirmation email (logged-in customers only)
    if (customerSession?.email) {
      const branch = BRANCHES[branchResult.branchId]
      sendOrderConfirmation(customerSession.email, {
        customerName: resolvedOrderData.customer_name ?? '',
        orderId,
        orderItems: repriced.items.map((i) => ({
          name:     locale === 'ar' ? i.name_ar : i.name_en,
          quantity: i.quantity,
          price:    i.item_total_bhd,
        })),
        totalBhd:     finalTotal,
        branchName:   locale === 'ar' ? branch.nameAr : branch.nameEn,
        deliveryType: resolvedOrderData.order_type,
      }).catch(() => {})
    }

    return {
      orderId,
      finalTotal,
      accessToken,
      restaurantWhatsAppLink: links.restaurantLink,
      customerWhatsAppLink:   links.customerLink,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { orderId: '', finalTotal: 0, error: message }
  }
}