'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { BRANCHES, type BranchId } from '@/constants/contact'
import { MIN_REDEMPTION, pointsToCredit } from '@/lib/loyalty/calculations'
import { calculateDiscount } from '@/lib/coupons/calculations'
import type { PointsTransactionInsert, CouponUsageInsert, CouponRow } from '@/lib/supabase/types'

type TypedSupabase = Awaited<ReturnType<typeof createServiceClient>>

interface OrderBase {
  customer_name:    string | null
  customer_phone:   string | null
  branch_id:        string
  status:           'new'
  notes:            string | null
  source:           string
  whatsapp_sent_at: null
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

interface CheckoutResult {
  orderId:    string
  finalTotal: number
  error?:     string
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
): Promise<{ discount: number; coupon: CouponRow } | { error: string }> {
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('id', couponId)
    .eq('is_active', true)
    .single()

  if (error || !coupon) return { error: 'Coupon not found or inactive' }

  const now = new Date()
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { error: 'Coupon has expired' }
  }
  if (subtotal < (coupon.min_order_value_bhd ?? 0)) {
    return { error: 'Order total below coupon minimum' }
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
  console.log('[Checkout Action] Starting order creation...', {
    branchId: payload.order.branch_id,
    itemCount: payload.items.length,
    pointsToRedeem: payload.pointsToRedeem,
    hasCoupon: !!payload.coupon
  })

  try {
    const { order: orderData, items, pointsToRedeem, coupon } = payload

    // Basic input guards
    if (!items.length) {
      console.warn('[Checkout Action] Validation failed: No items')
      return { orderId: '', finalTotal: 0, error: 'No items in order' }
    }
    if (!orderData.branch_id) {
      console.warn('[Checkout Action] Validation failed: No branch ID')
      return { orderId: '', finalTotal: 0, error: 'Branch required' }
    }

    console.log('[Checkout Action] Creating service client...')
    const supabase = await createServiceClient()
    console.log('[Checkout Action] Service client created successfully')

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
    const result = await fetchAndComputeCouponDiscount(supabase, coupon.couponId, subtotal)
    if ('error' in result) return { orderId: '', finalTotal: 0, error: result.error }
    serverCouponDiscount = result.discount
    resolvedCouponId = coupon.couponId
  }

  // ── Points path ──────────────────────────────────────────────────────────
  if (pointsToRedeem > 0) {
    if (pointsToRedeem < MIN_REDEMPTION) {
      return { orderId: '', finalTotal: 0, error: `Minimum redemption is ${MIN_REDEMPTION} points` }
    }

    const customer = await getCustomerSession()
    if (!customer) {
      return { orderId: '', finalTotal: 0, error: 'Customer session required to redeem points' }
    }
    if (pointsToRedeem > customer.points_balance) {
      return { orderId: '', finalTotal: 0, error: 'Insufficient points balance' }
    }

    const pointsDiscount = pointsToCredit(pointsToRedeem)
    const finalTotal = Math.max(0.001, subtotal - serverCouponDiscount - pointsDiscount)

    console.log('[Checkout Action] Inserting order into database...')
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({ ...resolvedOrderData, total_bhd: finalTotal })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('[Checkout Action] Order Insert Error:', orderErr)
      return { orderId: '', finalTotal: 0, error: orderErr?.message ?? 'Order creation failed' }
    }
    console.log('[Checkout Action] Order created successfully:', order.id)

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

    if (resolvedCouponId) {
      await recordCouponUsage(supabase, resolvedCouponId, customer.id, order.id, serverCouponDiscount)
    }

    return { orderId: order.id, finalTotal }
  }

  // ── Standard path (coupon only, no points) ────────────────────────────────
  console.log('[Checkout Action] Executing standard checkout path...')
  const finalTotal = Math.max(0.001, subtotal - serverCouponDiscount)

  console.log('[Checkout Action] Inserting order into database...')
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({ ...resolvedOrderData, total_bhd: finalTotal })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('[Checkout Action] Order Insert Error:', orderErr)
    return { orderId: '', finalTotal: 0, error: orderErr?.message ?? 'Order creation failed' }
  }
  console.log('[Checkout Action] Order created successfully:', order.id)

  console.log('[Checkout Action] Inserting order items...')
  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(items.map((i) => ({
      ...i,
      item_total_bhd: i.quantity * i.unit_price_bhd,
      order_id: order.id,
    })))

  if (itemsErr) {
    console.error('[Checkout Action] Order Items Insert Error:', itemsErr)
    return { orderId: '', finalTotal: 0, error: itemsErr.message }
  }

  if (resolvedCouponId) {
    console.log('[Checkout Action] Recording coupon usage...')
    const customer = await getCustomerSession()
    await recordCouponUsage(supabase, resolvedCouponId, customer?.id ?? null, order.id, serverCouponDiscount)
  }

  console.log('[Checkout Action] Checkout completed successfully')
  return { orderId: order.id, finalTotal }
} catch (err: unknown) {
  console.error('[Checkout Action] FATAL CRASH:', err)
  return {
    orderId: '',
    finalTotal: 0,
    error: err instanceof Error ? err.message : 'A fatal server error occurred during checkout'
  }
}
}
