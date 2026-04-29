'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { generateStaticQR } from '@/lib/payments/benefit'
import { createCharge } from '@/lib/payments/tap-client'
import type { PaymentMethod, PaymentStatus } from '@/lib/supabase/types'

export interface InitPaymentResult {
  paymentId: string
  qrBase64?: string
  error?:    string
}

// Creates a payment record (idempotent — returns existing if already created)
export async function initializePayment(
  orderId:   string,
  method:    PaymentMethod,
  amountBHD: number,
): Promise<InitPaymentResult> {
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

// Completes a cash payment — DB trigger advances order to 'accepted'
export async function completeCashPayment(
  paymentId: string,
): Promise<{ error?: string }> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('payments')
    .update({ status: 'completed' })
    .eq('id', paymentId)
    .eq('status', 'pending')
  return { error: error?.message }
}

// Phase 6: manual Benefit confirmation — customer taps "I've Paid"
// Phase 7+: Benefit Pay API webhook will replace this
export async function confirmBenefitPayment(
  paymentId: string,
): Promise<{ error?: string }> {
  return completeCashPayment(paymentId)
}

// Initiates a Tap charge and returns the Tap checkout URL
export async function initiateTapPayment(
  paymentId:     string,
  orderId:       string,
  amountBHD:     number,
  customerName:  string | null,
  customerPhone: string | null,
  locale:        string,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const supabase    = await createServiceClient()
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
