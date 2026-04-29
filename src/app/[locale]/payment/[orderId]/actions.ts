'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { getSession } from '@/lib/auth/session'
import { generateStaticQR } from '@/lib/payments/benefit'
import { createCharge } from '@/lib/payments/tap-client'
import type { PaymentMethod, PaymentStatus } from '@/lib/supabase/types'

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

async function authorizeOrderAccess(orderId: string): Promise<Authorized> {
  const supabase = await createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, total_bhd, customer_phone')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) return { ok: false, error: 'Order not found' }

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

async function authorizeByPaymentId(paymentId: string): Promise<Authorized> {
  const supabase = await createServiceClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('order_id')
    .eq('id', paymentId)
    .maybeSingle()

  if (!payment?.order_id) return { ok: false, error: 'Payment not found' }
  return authorizeOrderAccess(payment.order_id)
}

// ── Public actions ────────────────────────────────────────────────────────────

// Creates a payment record (idempotent — returns existing if already created).
// Trusts the DB-side total_bhd, NOT the client-supplied amount.
export async function initializePayment(
  orderId:   string,
  method:    PaymentMethod,
  _amountBHD: number, // kept for API compatibility; ignored — server uses DB value
): Promise<InitPaymentResult> {
  const auth = await authorizeOrderAccess(orderId)
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
    const qrBase64 = existing.method === 'benefit_qr'
      ? await generateStaticQR(orderId, amountBHD)
      : undefined
    return { paymentId: existing.id, qrBase64 }
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({ order_id: orderId, amount_bhd: amountBHD, method })
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
// customer browsing the page. Restrict to staff only.
export async function completeCashPayment(
  paymentId: string,
): Promise<{ error?: string }> {
  const staff = await getSession()
  if (!staff?.role) return { error: 'Unauthorized' }

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('payments')
    .update({ status: 'completed' })
    .eq('id', paymentId)
    .eq('status', 'pending')
  return { error: error?.message }
}

// Phase 6: manual Benefit confirmation — customer taps "I've Paid".
// Allowed for the order's owning customer OR for staff. The Benefit Pay
// webhook (Phase 7+) will replace this with verified gateway events.
export async function confirmBenefitPayment(
  paymentId: string,
): Promise<{ error?: string }> {
  const auth = await authorizeByPaymentId(paymentId)
  if (!auth.ok) return { error: auth.error }

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('payments')
    .update({ status: 'completed' })
    .eq('id', paymentId)
    .eq('status', 'pending')
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
): Promise<{ checkoutUrl?: string; error?: string }> {
  const auth = await authorizeOrderAccess(orderId)
  if (!auth.ok) return { error: auth.error }

  const supabase = await createServiceClient()

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
  const redirectUrl = `${siteUrl}/${locale}/order/${orderId}`

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

    await supabase
      .from('payments')
      .update({
        status:                 'processing',
        gateway_transaction_id: charge.id,
        gateway_response:       charge as unknown as Record<string, unknown>,
      })
      .eq('id', paymentId)

    return { checkoutUrl: charge.transaction.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('payments')
      .update({
        status:           'failed',
        gateway_response: { error: msg } as Record<string, unknown>,
      })
      .eq('id', paymentId)
    return { error: msg }
  }
}

// Polls current payment status for an order
export async function getPaymentStatus(
  orderId: string,
): Promise<{ status: PaymentStatus | null; paymentId: string | null }> {
  const auth = await authorizeOrderAccess(orderId)
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
