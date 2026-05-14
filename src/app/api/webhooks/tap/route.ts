import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import {
  verifyWebhookSignature,
  tapStatusToPaymentStatus,
  extractOrderReference,
  extractAmountScalar,
} from '@/lib/payments/tap-client'
import { toSafeError } from '@/lib/utils/safe-error'
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

// ── IP allowlist (KAH-2026-05-07) ────────────────────────────────────────────
// Tap's webhook source IPs are not publicly documented; operator pulls the
// real production list from Tap support (or observes them in
// payment_webhooks) and pins them via TAP_WEBHOOK_ALLOWED_IPS.
// Soft-launch mode: when the env var is unset, the check is skipped so the
// gate can be deployed before we have the canonical IP list.
// Parsed once per Function instance; Fluid Compute reuse keeps this hot.
let allowedIpsCache: Set<string> | null = null
let allowedIpsRaw: string | undefined = undefined

function getAllowedIps(): Set<string> | null {
  const raw = process.env.TAP_WEBHOOK_ALLOWED_IPS
  if (!raw) return null
  if (allowedIpsCache && allowedIpsRaw === raw) return allowedIpsCache
  allowedIpsRaw = raw
  allowedIpsCache = new Set(
    raw.split(',').map((s) => s.trim()).filter(Boolean),
  )
  return allowedIpsCache
}

function isIpAllowed(ip: string): { allowed: boolean; enforced: boolean } {
  const list = getAllowedIps()
  if (!list) return { allowed: true, enforced: false }
  return { allowed: list.has(ip), enforced: true }
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

  const ip = await getClientIp()

  // ── IP allowlist (KAH-2026-05-07) ───────────────────────────────────────────
  // Earliest gate when enforced — runs before rate-limit so a hostile source
  // can't burn the per-IP rate-limit budget for a legitimate Tap source IP.
  // Soft-launch (env unset) skips the check.
  const ipCheck = isIpAllowed(ip)
  if (ipCheck.enforced && !ipCheck.allowed) {
    const supabase = await createServiceClient()
    await supabase.from('webhook_errors').insert({
      provider:   'tap',
      gateway_id: null,
      order_id:   null,
      reason:     'ip_not_allowed',
      payload:    { ip } as unknown as Json,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Rate limit (KAH-2026-05-02) ─────────────────────────────────────────────
  // Earliest cheap gate after IP allowlist. Flooders are blocked before we
  // touch JSON parsing or HMAC verification.
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
  // PAYMENT_WEBHOOK_SECRET is unset and normalizes the object-form `amount`.
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
  // Extract the order field consistently and validate UUID shape. Empty/invalid
  // values become null — VULN-1.05 closed by passing null through (the RPC
  // then short-circuits the order-reference fallback).
  const referenceRaw = extractOrderReference(body as Record<string, unknown>)
  const orderReference = referenceRaw && UUID_RE.test(referenceRaw) ? referenceRaw : null

  // ── Server-side order binding (VULN-CRY-01) ─────────────────────────────────
  // Tap's hashstring does NOT cover `reference.order`, so a replayed payload
  // with rewritten reference would otherwise be accepted. We bind here using
  // the mapping persisted at charge creation (initiateTapPayment writes
  // payments.gateway_transaction_id = charge.id immediately after
  // createCharge returns — see src/app/[locale]/payment/[orderId]/actions.ts).
  // If we find a payment row keyed by gateway_id whose order_id differs from
  // the webhook's reference.order, treat the request as a replay and reject.
  //
  // Absence of the mapping when reference.order IS present is treated as an
  // attack: the RPC has an order_id fallback path that would otherwise mark
  // the attacker-supplied order as paid. The "race" the fallback was designed
  // for (Tap fires before our update commits) is effectively non-existent in
  // production — initiateTapPayment writes the binding synchronously before
  // returning the redirect URL, and the user-side roundtrip through Tap's
  // payment page takes seconds. Reject + audit; operator can reconcile any
  // genuine orphan via the staff payments dashboard.
  if (orderReference) {
    const { data: paymentRow } = await supabase
      .from('payments')
      .select('order_id')
      .eq('gateway_transaction_id', gatewayId)
      .maybeSingle()

    if (paymentRow && paymentRow.order_id !== orderReference) {
      // Stash an audit row for security review; do not leak the mismatch
      // detail to the caller (which on a real attack is the attacker).
      await supabase.from('webhook_errors').insert({
        provider:   'tap',
        gateway_id: gatewayId,
        order_id:   orderReference,
        reason:     'order_reference_mismatch',
        payload:    body as unknown as Json,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!paymentRow) {
      await supabase.from('webhook_errors').insert({
        provider:   'tap',
        gateway_id: gatewayId,
        order_id:   orderReference,
        reason:     'binding_absent_with_reference',
        payload:    body as unknown as Json,
      })
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }
  }

  // VULN-101: pass the normalized amount scalar so the RPC can enforce
  // ABS(amount - payments.amount_bhd) <= 0.001 BHD before flipping status
  // to a captured-class state. For BHD, Tap echoes the same scale we sent
  // on charge creation (fils — i.e. amount * 1000); the RPC (migration 142)
  // detects p_amount > 500 and divides by 1000 to reach major units.
  const amountScalar = extractAmountScalar(body as Record<string, unknown>)

  const { data, error } = await supabase.rpc('process_tap_webhook', {
    p_payload:         body as unknown as Json,
    p_event_type:      eventType,
    p_gateway_id:      gatewayId,
    p_status:          status ?? 'pending',
    p_order_reference: orderReference ?? '',
    p_amount:          amountScalar,
  })

  if (error) {
    // VULN-101: amount-mismatch raises a domain-specific 22023 exception.
    // Return 400 (not 500) and never echo the underlying message to the
    // caller — toSafeError collapses it in production.
    if (error.message?.includes('AMOUNT_MISMATCH') || error.code === '22023') {
      if (process.env.NODE_ENV === 'development') {
        console.error('[webhooks/tap] amount mismatch:', error.message)
      }
      return NextResponse.json({ error: toSafeError(error) }, { status: 400 })
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[webhooks/tap] rpc error:', error.message)
    }
    return NextResponse.json({ error: toSafeError(error) }, { status: 500 })
  }

  const processed = typeof data === 'object' && data !== null && 'processed' in data
    ? Boolean((data as Record<string, unknown>).processed)
    : false

  if (!processed) {
    return NextResponse.json({ received: true, processed: false }, { status: 202 })
  }

  return NextResponse.json({ received: true })
}
