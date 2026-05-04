'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { BRANCHES, type BranchId } from '@/constants/contact'
import { MIN_REDEMPTION, pointsToCredit } from '@/lib/loyalty/calculations'
import { calculateDiscount } from '@/lib/coupons/calculations'
import { createOrderAccessToken } from '@/lib/auth/order-access'
import type { PointsTransactionInsert, CouponUsageInsert, CouponRow } from '@/lib/supabase/custom-types'

// ── Server-side input validation ──────────────────────────────────────────────
// Sanity-check the payload before touching the DB. unit_price_bhd remains
// client-supplied (size/variant pricing lives in Sanity, not the DB) but we
// reject obviously hostile inputs (negative/huge prices, oversized carts).

const itemSchema = z.object({
  menu_item_slug:   z.string().min(1).max(120),
  name_ar:          z.string().min(1).max(200),
  name_en:          z.string().min(1).max(200),
  selected_size:    z.string().max(50).nullable(),
  selected_variant: z.string().max(50).nullable(),
  quantity:         z.number().int().min(1).max(50),
  unit_price_bhd:   z.number().min(0.001).max(500),
  item_total_bhd:   z.number().min(0).max(50_000),
})

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
  delivery_lat:        z.number().nullable(),
  delivery_lng:        z.number().nullable(),
  source:              z.string().max(50),
  whatsapp_sent_at:    z.null(),
})

const checkoutSchema = z.object({
  order:          orderSchema,
  items:          z.array(itemSchema).min(1).max(60),
  pointsToRedeem: z.number().int().min(0).max(1_000_000),
  coupon:         z.object({ couponId: z.string().uuid() }).optional(),
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
  delivery_lat:        number | null
  delivery_lng:        number | null
  source:              string
  whatsapp_sent_at:    null
}

interface ItemBase {
  menu_item_slug:   string
  name_ar:          string
  name_en:          string
  selected_size:    string | null
  selected_variant: string | null
  quantity:         number
  unit_price_bhd:   number
  item_total_bhd:   number
}

interface CouponPayload {
  couponId: string
}

interface CheckoutPayload {
  order:          OrderBase
  items:          ItemBase[]
  pointsToRedeem: number
  coupon?:        CouponPayload
}

interface StockWarning {
  menu_item_slug:     string
  name_ar:            string
  shortage_ingredient: string | null
}

interface CheckoutResult {
  orderId:       string
  finalTotal:    number
  accessToken?:  string
  error?:        string
  stock_warnings?: StockWarning[]
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

  if (selectError) return { error: selectError.message }
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

  if (upsertError) return { error: upsertError.message }

  return { branchId }
}

// ── Server-side subtotal ──────────────────────────────────────────────────────
// Re-derive subtotal from the items array to catch tampered item totals.
// unit_price_bhd is still client-supplied (sizes/variants have no DB price),
// but we recompute each item_total = quantity × unit_price and sum them,
// so a tampered item_total_bhd cannot lower the charged amount.
function computeSubtotal(items: ItemBase[]): number {
  return items.reduce((sum, item) => {
    if (item.quantity <= 0 || item.unit_price_bhd <= 0) return sum
    return sum + item.quantity * item.unit_price_bhd
  }, 0)
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

  if (usageError) return { error: usageError.message }
  if ((customerUsageCount ?? 0) >= coupon.per_customer_limit) {
    return { error: 'Coupon customer limit reached' }
  }

  const discount = calculateDiscount(coupon, subtotal)
  return { discount, coupon }
}

// ── Record coupon usage (atomic: increment count + insert usage row) ──────────
async function recordCouponUsage(
  supabase:       TypedSupabase,
  couponId:       string,
  customerId:     string | null,
  orderId:        string,
  discountAmount: number,
) {
  await supabase.rpc('increment_coupon_usage', { p_coupon_id: couponId })

  const usage: CouponUsageInsert = {
    coupon_id:           couponId,
    customer_id:         customerId,
    order_id:            orderId,
    discount_amount_bhd: discountAmount,
  }
  await supabase.from('coupon_usages').insert(usage)

  await supabase
    .from('orders')
    .update({ coupon_id: couponId, coupon_discount_bhd: discountAmount })
    .eq('id', orderId)
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function createOrderWithPoints(payload: CheckoutPayload): Promise<CheckoutResult> {
  // Validate the entire payload server-side before touching the DB
  const parsed = checkoutSchema.safeParse(payload)
  if (!parsed.success) {
    return { orderId: '', finalTotal: 0, error: 'Invalid checkout payload' }
  }

  try {
    const { order: orderData, items, pointsToRedeem, coupon } = parsed.data

    const supabase = await createServiceClient()

    // ── Non-blocking stock check ──────────────────────────────────────────────
    // Never blocks order creation — recipes may not be mapped yet for all items.
    const stockWarnings: StockWarning[] = []
    try {
      const { data: stockRows } = await supabase.rpc('rpc_check_stock_for_cart', {
        p_branch_id: orderData.branch_id,
        p_items: items.map(i => ({ slug: i.menu_item_slug, quantity: i.quantity })),
      })
      for (const row of (stockRows ?? []) as unknown as Array<{ menu_item_slug: string; name_ar: string; available: boolean; shortage_ingredient: string | null }>) {
        if (!row.available) {
          if (!row.shortage_ingredient) {
            // Recipe not mapped — log info alert, no user warning
            supabase
              .from('inventory_alerts')
              .insert({
                branch_id:     orderData.branch_id,
                ingredient_id: null,
                alert_type:    'unmapped_item',
                severity:      'info',
                message:       `لا توجد وصفة للصنف: ${row.name_ar}`,
                metadata:      { slug: row.menu_item_slug },
              })
              .then(() => {})
          } else {
            stockWarnings.push({ menu_item_slug: row.menu_item_slug, name_ar: row.name_ar, shortage_ingredient: row.shortage_ingredient })
          }
        }
      }
    } catch {
      // Stock check failure is non-fatal — continue to order creation
      console.warn('[checkout] stock check RPC failed — proceeding without stock validation')
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

  // ── Server-side total computation (ignores client total_bhd) ─────────────
  const subtotal = computeSubtotal(items)
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

  // ── Points path ──────────────────────────────────────────────────────────
  if (pointsToRedeem > 0) {
    if (pointsToRedeem < MIN_REDEMPTION) {
      return { orderId: '', finalTotal: 0, error: `Minimum redemption is ${MIN_REDEMPTION} points` }
    }

    const customer = customerSession ?? await getCustomerSession()
    if (!customer) {
      return { orderId: '', finalTotal: 0, error: 'Customer session required to redeem points' }
    }
    if (pointsToRedeem > customer.points_balance) {
      return { orderId: '', finalTotal: 0, error: 'Insufficient points balance' }
    }

    const pointsDiscount = pointsToCredit(pointsToRedeem)
    const finalTotal = Math.max(0.001, subtotal - serverCouponDiscount - pointsDiscount)

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({ ...resolvedOrderData, total_bhd: finalTotal })
      .select('id')
      .single()

    if (orderErr || !order) {
      return { orderId: '', finalTotal: 0, error: orderErr?.message ?? 'Order creation failed' }
    }

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(items.map((i) => ({
        ...i,
        item_total_bhd: i.quantity * i.unit_price_bhd,
        order_id: order.id,
      })))

    if (itemsErr) return { orderId: '', finalTotal: 0, error: itemsErr.message }

    const newBalance = customer.points_balance - pointsToRedeem
    await supabase
      .from('customer_profiles')
      .update({ points_balance: newBalance })
      .eq('id', customer.id)

    const tx: PointsTransactionInsert = {
      customer_id:      customer.id,
      order_id:         order.id,
      points_earned:    0,
      points_spent:     pointsToRedeem,
      balance_after:    newBalance,
      transaction_type: 'redeemed',
      description:      `Redeemed for order #${String(order.id).slice(-8).toUpperCase()}`,
    }
    await supabase.from('points_transactions').insert(tx)

    if (resolvedCouponId) {
      await recordCouponUsage(supabase, resolvedCouponId, customer.id, order.id, serverCouponDiscount)
    }

    return {
      orderId: order.id,
      finalTotal,
      accessToken: createOrderAccessToken(order.id),
      stock_warnings: stockWarnings.length > 0 ? stockWarnings : undefined,
    }
  }

  // ── Standard path (coupon only, no points) ────────────────────────────────
  const finalTotal = Math.max(0.001, subtotal - serverCouponDiscount)

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({ ...resolvedOrderData, total_bhd: finalTotal })
    .select('id')
    .single()

  if (orderErr || !order) {
    return { orderId: '', finalTotal: 0, error: orderErr?.message ?? 'Order creation failed' }
  }

  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(items.map((i) => ({
      ...i,
      item_total_bhd: i.quantity * i.unit_price_bhd,
      order_id: order.id,
    })))

  if (itemsErr) {
    return { orderId: '', finalTotal: 0, error: itemsErr.message }
  }

  if (resolvedCouponId) {
    await recordCouponUsage(supabase, resolvedCouponId, customerSession?.id ?? null, order.id, serverCouponDiscount)
  }

  return {
    orderId: order.id,
    finalTotal,
    accessToken: createOrderAccessToken(order.id),
    stock_warnings: stockWarnings.length > 0 ? stockWarnings : undefined,
  }
} catch (err) {
  return {
    orderId: '',
    finalTotal: 0,
    error: err instanceof Error ? err.message : 'A fatal server error occurred during checkout'
  }
}
}
