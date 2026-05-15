// Recovery-flow cookie helpers (L1).
//
// The recovery cookie marks a browser as having just completed a Supabase
// `type=recovery` exchange so /set-password can accept a password change
// without re-asking for the current password (VULN-AUTH-06).
//
// Pre-L1, the cookie value was the literal string "1" — no binding to the
// user it was minted for. If the active Supabase session swapped between the
// /auth/callback hop and the /set-password submit (shared kiosk, browser
// switch-user, etc.), the recovery proof would silently apply to the wrong
// account. L1 closes that by encoding the user_id into the cookie value
// and signing with HMAC-SHA256(SESSION_BIND_SECRET).
//
// Cookie format: `<user_id>.<base64url-hmac>`
// Verification: constant-time HMAC compare + caller-side equality check
// of the bound user_id against the live session user.
//
// SESSION_BIND_SECRET is required at runtime; reads happen inside function
// bodies so `next build` page-data collection (which runs without prod env)
// doesn't trip on the throw.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const RECOVERY_COOKIE_NAME = 'kah_recovery_flow'
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 60 * 10

function getSecret(): Buffer {
  const secret = process.env.SESSION_BIND_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_BIND_SECRET must be set to a 32+ character value (generate with: openssl rand -hex 32)',
    )
  }
  return Buffer.from(secret, 'utf8')
}

function hmac(userId: string): string {
  return createHmac('sha256', getSecret())
    .update(userId, 'utf8')
    .digest('base64url')
}

export function signRecoveryCookie(userId: string): string {
  if (!userId) throw new Error('signRecoveryCookie: userId required')
  return `${userId}.${hmac(userId)}`
}

export type RecoveryVerifyResult =
  | { ok: true;  userId: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'tampered' }

export function verifyRecoveryCookie(value: string | undefined): RecoveryVerifyResult {
  if (!value) return { ok: false, reason: 'missing' }

  const dot = value.indexOf('.')
  if (dot <= 0 || dot === value.length - 1) {
    return { ok: false, reason: 'malformed' }
  }

  const userId   = value.slice(0, dot)
  const provided = value.slice(dot + 1)
  const expected = hmac(userId)

  // timingSafeEqual requires equal-length buffers. Reject mismatched lengths
  // first so the constant-time compare runs on same-shape inputs.
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return { ok: false, reason: 'tampered' }
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'tampered' }

  return { ok: true, userId }
}
