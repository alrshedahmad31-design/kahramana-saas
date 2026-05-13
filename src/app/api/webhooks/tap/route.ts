import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, tapStatusToPaymentStatus } from '@/lib/payments/tap-client'
import type { Json } from '@/lib/supabase/custom-types'

// Hard cap on webhook body size to keep a malicious POST from filling up
// payment_webhooks with multi-MB JSON. 64 KiB is far above any real Tap event.
const MAX_BODY_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Zod schema for the Tap webhook body (KAH-2026-05-01) ─────────────────────
// Tap's actual webhook for charges uses `amount` as a number + top-level
// `currency`. The user-supplied spec also covers the alternative
// `amount: { value, currency }` shape that Tap returns from some API endpoints.
// Accepting both keeps the route compatible across Tap's gateway versions.
// `card` is whitelisted here because the new migration 133 extracts
// `card.brand` and `card.last_four` into the (now-stripped) `gateway_response`.
const tapWebhookSchema = z.object({
  id:         z.string().min(1).max(100),
  status:     z.string().min(1).max(50),
  amount:     z.union([
    z.number(),
    z.object({ value: z.number(), currency: z.string().min(1).max(8) }).passthrough(),
  ]).optional(),
  currency:   z.string().min(1).max(8).optional(),
  reference:  z.union([
    z.string().max(200),
    z.object({
      order:       z.string().max(200).optional(),
      transaction: z.string().max(200).optional(),
    }).passthrough(),
  ]).optional(),
  response:   z.object({}).passthrough().optional(),
  card:       z.object({
    brand:     z.string().max(40).optional(),
    last_four: z.string().max(8).optional(),
  }).passthrough().optional(),
  object:     z.string().max(40).optional(),
  hashstring: z.string().min(1).max(200),
}).passthrough()

// ── Rate limiter (KAH-2026-05-02) ────────────────────────────────────────────
// 60 requests / minute per IP. Lazy singleton so the Redis client is built
// once per Function instance under Fluid Compute. Gated on NODE_ENV +
// presence of Upstash env vars — matches the pattern in clock/actions.ts
// (per `feedback_rate_limit_node_env_gate` memory: dev shares 127.0.0.1 and
// the budget would collapse otherwise).
let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  ratelimit = new Ratelimit({
    redis:   Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix:  'webhook_tap',
  })
  return ratelimit
}

async function getClientIp(): Promise<string> {
  const h = await headers()
  // Platform-set headers first; `x-forwarded-for` is the request-echoed
  // last-resort and we drop to the leftmost token only.
  return (
    h.get('x-real-ip')?.trim()
    ?? h.get('cf-connecting-ip')?.trim()
    ?? h.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'noip'
  )
}

async function checkRateLimit(ip: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true
  const rl = getRatelimit()
  if (!rl) return true
  const { success } = await rl.limit(ip)
  return success
}

export async function POST(request: Request) {
  // ── Body-size guard ─────────────────────────────────────────────────────────
  const lengthHeader = request.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  // ── Rate limit (KAH-2026-05-02) ─────────────────────────────────────────────
  // Earliest cheap gate. Flooders are blocked before we touch JSON parsing
  // or HMAC verification.
  const ip = await getClientIp()
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Zod validation (KAH-2026-05-01) ─────────────────────────────────────────
  // Reject any payload whose shape doesn't match Tap's contract before we
  // call the signature check. Saves an HMAC roundtrip on malformed posts.
  const schemaResult = tapWebhookSchema.safeParse(parsedJson)
  if (!schemaResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload shape' },
      { status: 400 },
    )
  }
  const body = schemaResult.data

  // ── Signature verification ──────────────────────────────────────────────────
  // Last gate before any DB write. verifyWebhookSignature fails-closed when
  // PAYMENT_WEBHOOK_SECRET is unset.
  if (!verifyWebhookSignature(body as Record<string, unknown>, body.hashstring)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── DB write path (only reached for signed, well-shaped payloads) ───────────
  const supabase   = await createServiceClient()
  const gatewayId  = body.id
  const eventType  = body.object ?? ''
  const status = eventType === 'charge'
    ? tapStatusToPaymentStatus(body.status)
    : null

  // `reference` may be a string ('order-id') or an object ({order, transaction}).
  // Extract the order field consistently and validate UUID shape.
  const referenceRaw =
    typeof body.reference === 'string'
      ? body.reference
      : body.reference?.order
  const orderReference = referenceRaw && UUID_RE.test(referenceRaw) ? referenceRaw : null

  const { data, error } = await supabase.rpc('process_tap_webhook', {
    p_payload:         body as unknown as Json,
    p_event_type:      eventType,
    p_gateway_id:      gatewayId,
    p_status:          status ?? 'pending',
    p_order_reference: orderReference ?? '',
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
