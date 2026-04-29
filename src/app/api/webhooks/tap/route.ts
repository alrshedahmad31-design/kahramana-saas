import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, tapStatusToPaymentStatus } from '@/lib/payments/tap-client'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify Tap HMAC signature
  const hashstring = String(body['hashstring'] ?? '')
  if (!verifyWebhookSignature(body, hashstring)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase   = await createServiceClient()
  const gatewayId  = String(body['id'] ?? '')

  // Idempotency: skip if this gateway event was already processed
  if (gatewayId) {
    const { data: dup } = await supabase
      .from('payment_webhooks')
      .select('id, processed')
      .contains('payload', { id: gatewayId })
      .maybeSingle()

    if (dup?.processed) {
      return NextResponse.json({ received: true })
    }
  }

  // Store webhook for audit trail
  const { data: webhook } = await supabase
    .from('payment_webhooks')
    .insert({
      provider:   'tap',
      event_type: String(body['object'] ?? ''),
      payload:    body,
    })
    .select('id')
    .single()

  // Handle charge events
  if (body['object'] === 'charge') {
    const tapStatus = String(body['status'] ?? '')
    const status    = tapStatusToPaymentStatus(tapStatus)

    if (status) {
      // Update by gateway_transaction_id (set when charge was created)
      const { data: updated } = await supabase
        .from('payments')
        .update({
          status,
          gateway_transaction_id: gatewayId,
          gateway_response:       body,
        })
        .eq('gateway_transaction_id', gatewayId)
        .select('id')

      // Fallback: match by order reference when gateway_transaction_id not yet stored
      if (!updated?.length) {
        const reference = (body['reference'] as Record<string, string> | undefined)?.order
        if (reference) {
          await supabase
            .from('payments')
            .update({
              status,
              gateway_transaction_id: gatewayId,
              gateway_response:       body,
            })
            .eq('order_id', reference)
            .in('status', ['pending', 'processing'])
        }
      }
    }
  }

  // Mark webhook processed
  if (webhook?.id) {
    await supabase
      .from('payment_webhooks')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', webhook.id)
  }

  return NextResponse.json({ received: true })
}
