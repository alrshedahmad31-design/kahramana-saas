'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { getSession } from '@/lib/auth/session'
import { appendOrderAccessToken, verifyOrderAccessToken } from '@/lib/auth/order-access'
import { generateStaticQR } from '@/lib/payments/benefit'
import { createCharge } from '@/lib/payments/tap-client'
import type { Json, PaymentMethod, PaymentStatus } from '@/lib/supabase/custom-types'

export interface InitPaymentResult {
  paymentId: string
  qrBase64?: string
  error?:    string
}

// ── Authorization helpers ─────────────────────────────────────────────────────
// A request is authorized when EITHER:
//   1. The caller is active staff (any role), OR
//   2. The caller is the customer who owns the order (matched by phone).
//
// We always re-fetch the order from the DB and ignore any client-supplied
// amount or customer fields when making the decision.

type Authorized =
  | { ok: true;  order: { id: string; total_bhd: number; customer_phone: string | null } }
  | { ok: false; error: string }

async function authorizeOrderAccess(
  orderId: string,
  accessToken?: string | null,
): Promise<Authorized> {
  const supabase = await createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, total_bhd, customer_phone')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) return { ok: false, error: 'Order not found' }

  // Path 0 — guest checkout link with a server-signed order capability token
  if (verifyOrderAccessToken(orderId, accessToken)) {
    return { ok: true, order }
  }

  // Path 1 — staff with active profile
  const staff = await getSession()
  if (staff?.role) {
    return { ok: true, order }
  }

  // Path 2 — customer owning the order (phone match)
  const customer = await getCustomerSession()
  if (
    customer?.phone &&
    order.customer_phone &&
    customer.phone === order.customer_phone
  ) {
    return { ok: true, order }
  }

  return { ok: false, error: 'Forbidden' }
}

async function authorizeByPaymentId(
  paymentId: string,
  accessToken?: string | null,
): Promise<Authorized> {
  const supabase = await createServiceClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('order_id')
    .eq('id', paymentId)
    .maybeSingle()

  if (!payment?.order_id) return { ok: false, error: 'Payment not found' }
  return authorizeOrderAccess(payment.order_id, accessToken)
}

// ── Public actions ────────────────────────────────────────────────────────────

// Creates a payment record (idempotent — returns existing if already created).
// Trusts the DB-side total_bhd, NOT the client-supplied amount.
export async function initializePayment(
  orderId:   string,
  method:    PaymentMethod,
  _amountBHD: number, // kept for API compatibility; ignored — server uses DB value
  accessToken?: string | null,
): Promise<InitPaymentResult> {
  const auth = await authorizeOrderAccess(orderId, accessToken)
  if (!auth.ok) return { paymentId: '', error: auth.error }

  const amountBHD = Number(auth.order.total_bhd)
  if (!Number.isFinite(amountBHD) || amountBHD <= 0) {
    return { paymentId: '', error: 'Invalid order total' }
  }

  const supabase = await createServiceClient()

  // Return existing payment (handles page refresh / back navigation)
  const { data: existing } = await supabase
    .from('payments')
    .select('id, status, method')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'completed') {
      return { paymentId: existing.id, error: 'already_completed' }
    }

    // VULN-001: an existing online payment row (tap_card / tap_knet /
    // benefit_qr) must not be flippable to 'cash'. Allowing that would let a
    // customer convert a Tap-pending order into a COD-confirmed one without
    // ever paying. Online → cash transitions are forbidden post-creation.
    if (method === 'cash' && existing.method && existing.method !== 'cash') {
      return { paymentId: existing.id, error: 'method_locked' }
    }

    const nextStatus = method === 'cash' ? 'pending_cod' : 'pending'
    const { error: updateError } = await supabase
      .from('payments')
      .update({ method, status: nextStatus })
      .eq('id', existing.id)

    if (updateError) return { paymentId: '', error: updateError.message }

    const qrBase64 = method === 'benefit_qr'
      ? await generateStaticQR(orderId, amountBHD)
      : undefined
    return { paymentId: existing.id, qrBase64 }
  }

  const expiresAt = method === 'cash'
    ? null
    : new Date(Date.now() + 20 * 60 * 1000).toISOString()
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      order_id:   orderId,
      amount_bhd: amountBHD,
      method,
      status:     method === 'cash' ? 'pending_cod' : 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !payment) {
    return { paymentId: '', error: error?.message ?? 'Failed to create payment' }
  }

  const qrBase64 = method === 'benefit_qr'
    ? await generateStaticQR(orderId, amountBHD)
    : undefined

  return { paymentId: payment.id, qrBase64 }
}

// Completes a cash payment — DB trigger advances order to 'accepted'.
// SECURITY: Cash confirmation must happen at the cashier (staff), never by the
// customer browsing the page. Restricted to cash-handling roles AND scoped to
// the order's branch — a cashier at branch A cannot settle a COD order taken
// at branch B.
const CASH_SETTLE_ROLES: ReadonlyArray<NonNullable<Awaited<ReturnType<typeof getSession>>>['role']> = [
  'owner',
  'general_manager',
  'branch_manager',
  'cashier',
  'waiter',
]

export async function completeCashPayment(
  paymentId: string,
): Promise<{ error?: string }> {
  const staff = await getSession()
  if (!staff?.role || !CASH_SETTLE_ROLES.includes(staff.role)) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createServiceClient()

  // Branch scope: re-fetch the order's branch via the payment row and assert
  // the staff member belongs to that branch. Owner / general_manager are
  // global (no branch_id) and bypass this check.
  const { data: paymentRow } = await supabase
    .from('payments')
    .select('id, order_id, orders!inner(branch_id)')
    .eq('id', paymentId)
    .maybeSingle()

  if (!paymentRow) return { error: 'Payment not found' }

  const orderBranchId =
    (paymentRow as { orders: { branch_id: string | null } | null }).orders?.branch_id ?? null

  const isGlobalRole = staff.role === 'owner' || staff.role === 'general_manager'
  if (!isGlobalRole) {
    if (!staff.branch_id || staff.branch_id !== orderBranchId) {
      return { error: 'Forbidden' }
    }
  }

  // CAS: only flip a genuine pending_cod row. 'pending' is the pre-init state
  // for online methods (tap_card / tap_knet / benefit_qr) and must never be
  // settled as cash.
  const { error } = await supabase
    .from('payments')
    .update({ status: 'completed' })
    .eq('id', paymentId)
    .eq('status', 'pending_cod')
  return { error: error?.message }
}

// Customer Benefit confirmation only queues staff/payment-provider review.
// It must never mark the payment as completed from the customer-facing page.
export async function confirmBenefitPayment(
  paymentId: string,
  accessToken?: string | null,
): Promise<{ error?: string }> {
  const auth = await authorizeByPaymentId(paymentId, accessToken)
  if (!auth.ok) return { error: auth.error }

  const supabase = await createServiceClient()
  // Method pin: tap_card / tap_knet rows are also 'pending' before
  // initiateTapPayment flips them to 'processing'. Without the method check
  // a customer could self-park a Tap order into awaiting_manual_review and
  // confuse the staff settlement queue.
  const { error } = await supabase
    .from('payments')
    .update({ status: 'awaiting_manual_review' })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .eq('method', 'benefit_qr')
  return { error: error?.message }
}

// Initiates a Tap charge and returns the Tap checkout URL.
// Trusts ONLY the DB amount and DB customer details. All client args (except
// orderId / paymentId / locale) are ignored to prevent amount-tampering.
export async function initiateTapPayment(
  paymentId:      string,
  orderId:        string,
  _amountBHD:     number,
  _customerName:  string | null,
  _customerPhone: string | null,
  locale:         string,
  accessToken?:   string | null,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const auth = await authorizeOrderAccess(orderId, accessToken)
  if (!auth.ok) return { error: auth.error }

  const supabase = await createServiceClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id')
    .eq('id', paymentId)
    .eq('order_id', orderId)
    .maybeSingle()

  if (!payment) {
    return { error: 'Payment not found' }
  }

  // Re-fetch the canonical name + phone from the DB (never trust the client)
  const { data: orderRow } = await supabase
    .from('orders')
    .select('customer_name, customer_phone, total_bhd')
    .eq('id', orderId)
    .single()

  const amountBHD     = Number(orderRow?.total_bhd ?? 0)
  const customerName  = orderRow?.customer_name  ?? null
  const customerPhone = orderRow?.customer_phone ?? null

  if (!Number.isFinite(amountBHD) || amountBHD <= 0) {
    return { error: 'Invalid order total' }
  }

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kahramanat.com'
  const redirectUrl = appendOrderAccessToken(`${siteUrl}/${locale}/order/${orderId}`, accessToken)

  try {
    const charge = await createCharge({
      amount:   amountBHD,
      currency: 'BHD',
      orderId,
      customer: {
        name:  customerName  ?? undefined,
        phone: customerPhone ?? undefined,
      },
      redirectUrl,
    })

    // Persist the tap_charge_id → order_id binding. The Tap webhook handler
    // reads this back to detect cross-order replay (VULN-CRY-01): if a
    // signed webhook arrives whose `reference.order` doesn't match the
    // order_id we stored against this charge.id, the handler rejects it.
    await supabase
      .from('payments')
      .update({
        status:                 'processing',
        gateway_transaction_id: charge.id,
        gateway_response:       charge as unknown as Json,
      })
      .eq('id', paymentId)
      .eq('order_id', orderId)

    return { checkoutUrl: charge.transaction.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('payments')
      .update({
        status:           'failed',
        gateway_response: { error: msg } as unknown as Json,
      })
      .eq('id', paymentId)
      .eq('order_id', orderId)
    return { error: msg }
  }
}

// Polls current payment status for an order
export async function getPaymentStatus(
  orderId: string,
  accessToken?: string | null,
): Promise<{ status: PaymentStatus | null; paymentId: string | null }> {
  const auth = await authorizeOrderAccess(orderId, accessToken)
  if (!auth.ok) return { status: null, paymentId: null }

  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('payments')
    .select('id, status')
    .eq('order_id', orderId)
    .maybeSingle()

  return {
    status:    (data?.status as PaymentStatus | null) ?? null,
    paymentId: data?.id ?? null,
  }
}
