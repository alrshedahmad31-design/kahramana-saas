import { createHmac, timingSafeEqual } from 'crypto'

const EXPIRY_SECONDS = 72 * 3600 // 72 hours

function getOrderAccessSecret(): string | null {
  return process.env.ORDER_TOKEN_SECRET || process.env.ORDER_ACCESS_SECRET || null
}

export function createOrderAccessToken(orderId: string): string {
  const secret = getOrderAccessSecret()
  if (!secret) {
    throw new Error('Missing ORDER_ACCESS_SECRET or fallback signing secret')
  }

  const expires = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS
  const payload = `${orderId}:${expires}`
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false

  try {
    const secret = getOrderAccessSecret()
    if (!secret) return false

    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const firstColon  = decoded.indexOf(':')
    const secondColon = decoded.indexOf(':', firstColon + 1)
    if (firstColon === -1 || secondColon === -1) return false

    const tokenOrderId = decoded.slice(0, firstColon)
    const expiresStr   = decoded.slice(firstColon + 1, secondColon)
    const sig          = decoded.slice(secondColon + 1)

    if (tokenOrderId !== orderId) return false

    const expires = parseInt(expiresStr, 10)
    if (isNaN(expires) || Math.floor(Date.now() / 1000) > expires) return false

    const expectedSig = createHmac('sha256', secret)
      .update(`${orderId}:${expiresStr}`)
      .digest('base64url')

    const expectedBuf = Buffer.from(expectedSig)
    const actualBuf   = Buffer.from(sig)
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}

export function appendOrderAccessToken(path: string, token: string | null | undefined): string {
  if (!token) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}t=${encodeURIComponent(token)}`
}
