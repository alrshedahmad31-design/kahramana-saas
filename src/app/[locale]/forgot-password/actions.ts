'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

type ForgotResult =
  | { success: true }
  | { success: false; error: 'rate_limited' | 'captcha' | 'server_error' }

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Production fails closed when the secret isn't configured — password-reset
  // is an obvious abuse target and must never silently bypass Turnstile.
  // Dev/preview fall through. Matches contact/reserve post-T1 pattern.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false
    return true
  }
  if (!token) return false

  try {
    const headersList = await headers()
    const ip = headersList.get('x-real-ip')
            ?? headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? undefined

    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

async function checkRateLimit(): Promise<boolean> {
  // Dev/preview share 127.0.0.1 and burn the 3/15m budget in a minute of QA.
  // Production fails closed when Upstash isn't configured — password-reset is
  // an obvious abuse target and must never silently lose rate limiting during
  // an env-var rotation. Matches contact/reserve post-T1 pattern.
  if (process.env.NODE_ENV !== 'production') {
    return true
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    Sentry.captureMessage('forgot_password.rate_limit_unconfigured', { level: 'warning' })
    return false
  }
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(3, '15 m'),
    })
    const headersList = await headers()
    const ip = headersList.get('x-real-ip')
            ?? headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? '127.0.0.1'
    const { success } = await ratelimit.limit(`auth:forgot:${ip}`)
    return success
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: 'forgot_password.rate_limit' } })
    return false
  }
}

export async function forgotPasswordAction(
  email: string,
  turnstileToken?: string,
): Promise<ForgotResult> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { success: false, error: 'server_error' }
  }

  const captchaOk = await verifyTurnstile(turnstileToken ?? '')
  if (!captchaOk) return { success: false, error: 'captcha' }

  const allowed = await checkRateLimit()
  if (!allowed) return { success: false, error: 'rate_limited' }

  // VULN-A04 defense-in-depth: pin redirectTo to the server-known site URL so a
  // host-header attacker can't smuggle a redirect target into the reset email
  // even if Supabase's allowlist regresses to permissive.
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
  // Mirror the existing UX: don't reveal whether the account exists. We still
  // return success on Supabase error so the response is identical either way —
  // the client message is the same generic success copy.
  if (error && !error.message.includes('rate limit')) {
    return { success: false, error: 'server_error' }
  }
  return { success: true }
}
