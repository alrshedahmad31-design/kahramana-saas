'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// T1-4: server-action wrapper for staff Supabase login. Moves the
// credential check off the browser-direct path so we can apply server-side
// rate limiting and Zod validation. The session cookie is still written by
// the SSR-aware createClient(), so the existing middleware-gated dashboard
// flow works without further changes.

const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
})

export type StaffLoginResult =
  | { success: true }
  | { success: false; error: 'rate_limited' | 'invalid_credentials' | 'network' }

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-real-ip')
    ?? h.get('x-forwarded-for')?.split(',')[0].trim()
    ?? '127.0.0.1'
  )
}

async function checkRateLimit(ip: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    Sentry.captureMessage('staff_login.rate_limit_unconfigured', { level: 'warning' })
    return false
  }
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '15 m'),
      prefix:  'staff_login',
    })
    const { success } = await ratelimit.limit(`staff_login:${ip}`)
    return success
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: 'staff_login.rate_limit' } })
    return false
  }
}

export async function staffLoginAction(
  emailRaw: string,
  passwordRaw: string,
): Promise<StaffLoginResult> {
  const parsed = loginSchema.safeParse({ email: emailRaw, password: passwordRaw })
  if (!parsed.success) return { success: false, error: 'invalid_credentials' }

  const ip = await getClientIp()
  const allowed = await checkRateLimit(ip)
  if (!allowed) return { success: false, error: 'rate_limited' }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email:    parsed.data.email,
      password: parsed.data.password,
    })
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      const isNetwork = msg.includes('fetch') || msg.includes('network')
      return { success: false, error: isNetwork ? 'network' : 'invalid_credentials' }
    }
    return { success: true }
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: 'staff_login.signIn' } })
    return { success: false, error: 'network' }
  }
}
