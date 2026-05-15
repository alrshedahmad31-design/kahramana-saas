'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

type ForgotResult =
  | { success: true }
  | { success: false; error: 'rate_limited' | 'captcha' | 'server_error' }

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Soft-launch: when the secret is unset, fall through. Becomes mandatory
  // the moment TURNSTILE_SECRET_KEY lands in env. Matches contact/reserve.
  if (!secret) return true
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
  // Production-only — in dev every request shares 127.0.0.1 and a 3/15m budget
  // burns inside a minute of normal QA. Matches the gate in contact/reserve.
  if (
    process.env.NODE_ENV !== 'production'
    || !process.env.UPSTASH_REDIS_REST_URL
    || !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return true
  }
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
}

export async function forgotPasswordAction(
  email: string,
  redirectTo: string,
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
