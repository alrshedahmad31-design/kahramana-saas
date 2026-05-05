import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, tapStatusToPaymentStatus } from '@/lib/payments/tap-client'
import type { Json } from '@/lib/supabase/custom-types'

// Hard cap on webhook body size to keep a malicious POST from filling up
// payment_webhooks with multi-MB JSON. 64 KiB is far above any real Tap event.
const MAX_BODY_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  // ── Body-size guard ─────────────────────────────────────────────────────────
  const lengthHeader = request.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // ── Signature verification ──────────────────────────────────────────────────
  // verifyWebhookSignature already fails-closed when PAYMENT_WEBHOOK_SECRET is
  // unset, so an unauthenticated POST cannot persist anything below.
  const hashstring = String(body['hashstring'] ?? '')
  if (!verifyWebhookSignature(body, hashstring)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase   = await createServiceClient()
  const gatewayId  = String(body['id'] ?? '')
  const eventType = String(body['object'] ?? '')
  const status = eventType === 'charge'
    ? tapStatusToPaymentStatus(String(body['status'] ?? ''))
    : null
  const reference = (body['reference'] as Record<string, string> | undefined)?.order
  const orderReference = reference && UUID_RE.test(reference) ? reference : null

  const { data, error } = await supabase.rpc('process_tap_webhook', {
    p_payload:         body as unknown as Json,
    p_event_type:      eventType,
    p_gateway_id:      gatewayId,
    p_status:          status,
    p_order_reference: orderReference,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const processed = typeof data === 'object' && data !== null && 'processed' in data
    ? Boolean((data as Record<string, unknown>).processed)
    : false

  if (!processed) {
    return NextResponse.json({ received: true, processed: false }, { status: 202 })
  }

  return NextResponse.json({ received: true })
}
