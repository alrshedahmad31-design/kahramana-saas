import { createHmac } from 'crypto'

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

// Tap webhooks include a `hashstring` field in the JSON body.
// Hash = HMAC-SHA256( id + amount + currency + status + secret )
export function verifyWebhookSignature(
  payload:    Record<string, unknown>,
  hashstring: string,
): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || !hashstring) return false

  const toHash = [
    String(payload['id']       ?? ''),
    String(payload['amount']   ?? ''),
    String(payload['currency'] ?? ''),
    String(payload['status']   ?? ''),
    secret,
  ].join('')

  const expected = createHmac('sha256', secret).update(toHash).digest('hex')
  return expected === hashstring
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
