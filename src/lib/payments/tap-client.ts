import { createHmac, timingSafeEqual } from 'crypto'

const TAP_BASE = 'https://api.tap.company/v2'

export interface TapChargeRequest {
  amount:      number  // BHD — converted to fils (× 1000) internally
  currency:    'BHD'
  orderId:     string
  customer: {
    name?:  string
    phone?: string
  }
  redirectUrl: string
}

export interface TapCharge {
  id:       string
  status:   string
  amount:   number
  currency: string
  transaction: {
    url:     string
    created: string
    expiry:  { period: number; type: string }
  }
  reference: {
    order:       string
    transaction: string
  }
}

export async function createCharge(req: TapChargeRequest): Promise<TapCharge> {
  const secretKey = process.env.TAP_SECRET_KEY
  if (!secretKey) throw new Error('TAP_SECRET_KEY not configured')

  // Tap expects amount in the smallest currency unit (fils for BHD: 1 BHD = 1000 fils)
  const amountFils = Math.round(req.amount * 1000)

  const nameParts  = (req.customer.name ?? '').trim().split(/\s+/)
  const firstName  = nameParts[0] ?? 'Customer'
  const lastName   = nameParts.slice(1).join(' ') || '-'

  const body = {
    amount:   amountFils,
    currency: req.currency,
    customer: {
      first_name: firstName,
      last_name:  lastName,
      phone:      req.customer.phone
        ? { country_code: '973', number: req.customer.phone.replace(/^\+?973/, '') }
        : undefined,
    },
    source:      { id: 'src_all' },
    redirect:    { url: req.redirectUrl },
    reference:   { order: req.orderId },
    description: `Kahramana Order #${req.orderId.slice(-8).toUpperCase()}`,
    receipt:     { email: false, sms: !!req.customer.phone },
  }

  const res = await fetch(`${TAP_BASE}/charges`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${secretKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Tap API ${res.status}: ${errText}`)
  }

  return res.json() as Promise<TapCharge>
}

// ── Amount + reference normalizers (KAH-2026-05-04 / VULN-CRY-03) ─────────────
// Tap's webhook body uses `amount` either as a numeric scalar OR as
// `{ value, currency }`. Without this normalization `String({value,currency})`
// becomes the literal "[object Object]" — the canonicalization-fragile bug
// described by VULN-CRY-03: every object-form charge fails signature
// verification with 401. The same helper is also re-exported for the
// webhook route to use during DB-binding checks.
export function extractAmountScalar(payload: Record<string, unknown>): number | null {
  const raw = payload['amount']
  if (typeof raw === 'number') return raw
  if (raw !== null && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
    const v = (raw as Record<string, unknown>).value
    return typeof v === 'number' ? v : null
  }
  return null
}

// `reference` can be a plain string or `{ order, transaction }`. Returns the
// order field (or the string itself) — caller is responsible for asserting
// UUID shape before trusting it as a DB key.
export function extractOrderReference(payload: Record<string, unknown>): string | null {
  const raw = payload['reference']
  if (typeof raw === 'string') return raw
  if (raw !== null && typeof raw === 'object') {
    const order = (raw as Record<string, unknown>).order
    return typeof order === 'string' ? order : null
  }
  return null
}

// Tap webhooks include a `hashstring` field in the JSON body.
// Tap-side hash recipe = HMAC-SHA256( id + amount + currency + status + secret )
// where `amount` is the canonical numeric scalar (in fils for BHD). We
// normalize before hashing so both wire shapes verify against Tap's signature
// — the previous String(payload.amount) path turned the object form into
// "[object Object]" and broke verification end-to-end.
//
// Note: VULN-CRY-01 (cross-order replay via attacker-rewritten
// `reference.order`) is NOT mitigated by changing this recipe — Tap signs
// what Tap signs. The replay-binding check lives in the webhook route, which
// looks up the order from the previously persisted
// `payments.gateway_transaction_id` mapping and rejects mismatches.
export function verifyWebhookSignature(
  payload:    Record<string, unknown>,
  hashstring: string,
): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || !hashstring) return false

  const amountScalar = extractAmountScalar(payload)
  // Currency may live at top level (scalar-amount form) or nested under
  // amount.currency (object-amount form). Match Tap's serialization order.
  let currency = payload['currency']
  if (currency === undefined && typeof payload['amount'] === 'object' && payload['amount'] !== null) {
    currency = (payload['amount'] as Record<string, unknown>).currency
  }

  const toHash = [
    String(payload['id']    ?? ''),
    amountScalar === null ? '' : String(amountScalar),
    String(currency         ?? ''),
    String(payload['status'] ?? ''),
    secret,
  ].join('')

  const expected = createHmac('sha256', secret).update(toHash).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf   = Buffer.from(hashstring, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

// ── Refund flow (VULN-102) ───────────────────────────────────────────────────
// Hits POST /v2/refunds with the original charge id. Tap accepts amount in
// the smallest currency unit (fils for BHD: 1 BHD = 1000 fils) — same scale
// as createCharge above. Throws TapRefundError on any non-2xx response so
// the caller can short-circuit BEFORE flipping local DB state.

export class TapRefundError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body:   string,
  ) {
    super(message)
    this.name = 'TapRefundError'
  }
}

export interface TapRefund {
  id:       string
  status:   string
  amount:   number
  currency: string
  charge:   { id: string }
}

export async function refundCharge(
  chargeId: string,
  amountBhd: number,
): Promise<{ id: string; status: string }> {
  const secretKey = process.env.TAP_SECRET_KEY
  if (!secretKey) throw new TapRefundError('TAP_SECRET_KEY not configured', 0, '')

  const amountFils = Math.round(amountBhd * 1000)

  const body = {
    charge_id: chargeId,
    amount:    amountFils,
    currency:  'BHD',
    reason:    'requested_by_customer',
  }

  const res = await fetch(`${TAP_BASE}/refunds`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${secretKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new TapRefundError(`Tap refund API ${res.status}`, res.status, errText)
  }

  const json = await res.json() as TapRefund
  return { id: json.id, status: json.status }
}

// Maps Tap charge status strings to our payment_status enum
export function tapStatusToPaymentStatus(
  tapStatus: string,
): 'processing' | 'completed' | 'failed' | null {
  switch (tapStatus.toUpperCase()) {
    case 'CAPTURED':   return 'completed'
    case 'AUTHORIZED': return 'processing'
    case 'DECLINED':
    case 'CANCELLED':
    case 'VOID':       return 'failed'
    default:           return null
  }
}
