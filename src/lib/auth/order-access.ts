import { createHmac, timingSafeEqual } from 'crypto'

function getOrderAccessSecret(): string | null {
  return (
    process.env.ORDER_ACCESS_SECRET ||
    process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  )
}

export function createOrderAccessToken(orderId: string): string {
  const secret = getOrderAccessSecret()
  if (!secret) {
    throw new Error('Missing ORDER_ACCESS_SECRET or fallback signing secret')
  }

  return createHmac('sha256', secret)
    .update(orderId)
    .digest('base64url')
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false

  try {
    const expected = createOrderAccessToken(orderId)
    const expectedBuffer = Buffer.from(expected)
    const tokenBuffer = Buffer.from(token)

    return (
      expectedBuffer.length === tokenBuffer.length &&
      timingSafeEqual(expectedBuffer, tokenBuffer)
    )
  } catch {
    return false
  }
}

export function appendOrderAccessToken(path: string, token: string | null | undefined): string {
  if (!token) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}t=${encodeURIComponent(token)}`
}
