'use server'

import { headers }                  from 'next/headers'
import * as Sentry                  from '@sentry/nextjs'
import { createServiceClient }      from '@/lib/supabase/server'
import { sendContactNotification }  from '@/lib/email/send'
import { z }                        from 'zod'
import { PUBLIC_PHONE_RE }          from '@/lib/validation/phone'

const schema = z.object({
  name:      z.string().min(2).max(100).refine((v) => !/[\r\n]/.test(v), 'invalid_input'),
  email:     z.string().email(),
  phone:     z.string().max(20).regex(PUBLIC_PHONE_RE).optional().or(z.literal('')),
  branch_id: z.string().max(50).optional().or(z.literal('')),
  message:   z.string().min(10).max(2000),
})

type Result = { success: true } | { success: false; error: 'rate_limit' | 'server_error' | 'captcha' }

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Production fails-closed when the secret isn't configured — no silent
  // bypass. Dev/preview fall back to honeypot-only so local testing stays
  // unblocked before the env var is wired.
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

export async function submitContactMessage(payload: {
  name: string; email: string; phone: string
  branch_id: string; message: string; website: string
  turnstileToken?: string
}): Promise<Result> {

  // Honeypot — bots fill this; real users leave it empty
  if (payload.website) return { success: true }

  // Cloudflare Turnstile — verifies a real human if configured.
  const captchaOk = await verifyTurnstile(payload.turnstileToken ?? '')
  if (!captchaOk) return { success: false, error: 'captcha' }

  const result = schema.safeParse(payload)
  if (!result.success) return { success: false, error: 'server_error' }

  // Sliding-window rate limit: 5 submits / IP / hour. Production fails
  // closed when Upstash isn't configured or the call throws — we never
  // want a forgotten env var or a transient Redis outage to silently
  // disable abuse protection. Dev/preview share 127.0.0.1 (no x-forwarded-for)
  // and the Upstash counter persists across restarts, so the gate stays
  // skipped there. Same pattern as reserve/actions.ts.
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      Sentry.captureMessage('contact.rate_limit_unconfigured', { level: 'warning' })
      return { success: false, error: 'rate_limit' }
    }
    try {
      const [{ Ratelimit }, { Redis }] = await Promise.all([
        import('@upstash/ratelimit'),
        import('@upstash/redis'),
      ])
      const ratelimit = new Ratelimit({
        redis:   Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(5, '1 h'),
      })
      const headersList = await headers()
      const ip = headersList.get('x-real-ip')
              ?? headersList.get('x-forwarded-for')?.split(',')[0].trim()
              ?? '127.0.0.1'

      const { success: allowed } = await ratelimit.limit(`contact:${ip}`)
      if (!allowed) return { success: false, error: 'rate_limit' }
    } catch (err) {
      Sentry.captureException(err, { tags: { stage: 'contact.rate_limit' } })
      return { success: false, error: 'rate_limit' }
    }
  }

  const service = await createServiceClient()
  const { error } = await service.from('contact_messages').insert({
    name:      result.data.name,
    email:     result.data.email,
    phone:     result.data.phone || null,
    branch_id: result.data.branch_id || null,
    message:   result.data.message,
  })

  if (error) return { success: false, error: 'server_error' }

  // Fire-and-forget — a failed email must never block the user's submission
  void sendContactNotification({
    name:       result.data.name,
    email:      result.data.email,
    phone:      result.data.phone || undefined,
    message:    result.data.message,
    receivedAt: new Date().toLocaleString('ar-BH', {
      timeZone:     'Asia/Bahrain',
      dateStyle:    'long',
      timeStyle:    'short',
    }),
  })

  return { success: true }
}
