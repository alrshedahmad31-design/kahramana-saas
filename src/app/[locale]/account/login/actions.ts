'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type AuthError = 'rate_limited' | 'invalid_credentials' | 'signup_error'
type AuthResult = { success: true } | { success: false; error: AuthError }

async function checkRateLimit(key: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return true
  }
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ])
  const ratelimit = new Ratelimit({
    redis:   Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
  })
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim()
          ?? headersList.get('x-real-ip')
          ?? '127.0.0.1'
  const { success } = await ratelimit.limit(`auth:${key}:${ip}`)
  return success
}

export async function loginAction(email: string, password: string): Promise<AuthResult> {
  const allowed = await checkRateLimit('login')
  if (!allowed) return { success: false, error: 'rate_limited' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: 'invalid_credentials' }
  return { success: true }
}

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-().]/g, '')
  if (s.startsWith('00973')) return '+973' + s.slice(5)
  if (s.startsWith('+973')) return s
  if (s.startsWith('973') && s.length === 11) return '+' + s
  if (/^\d{8}$/.test(s)) return '+973' + s
  return s
}

export async function registerAction(
  email: string,
  password: string,
  phone: string,
  name: string,
): Promise<AuthResult> {
  const allowed = await checkRateLimit('register')
  if (!allowed) return { success: false, error: 'rate_limited' }

  const normalizedPhone = normalizePhone(phone)
  if (!/^\+973[0-9]{8}$/.test(normalizedPhone)) {
    return { success: false, error: 'signup_error' }
  }

  const supabase = await createClient()

  const { data: authData, error: signUpErr } = await supabase.auth.signUp({ email, password })
  if (signUpErr || !authData.user?.id) {
    Sentry.captureException(signUpErr ?? new Error('signUp returned no user id'), {
      tags: { stage: 'auth.signUp' },
    })
    return { success: false, error: 'signup_error' }
  }

  // Insert the customer profile via service-role.
  //
  // Why service-role and not the rpc_create_customer_profile RPC: the RPC
  // requires auth.uid() to resolve, but Supabase's email-confirmation flow
  // does NOT create a session on signUp — no session cookies are set, so
  // auth.uid() returns NULL and the RPC raises AUTH_REQUIRED. Bypassing
  // RLS with service-role and using the user.id from the signUp response
  // works regardless of email-confirmation settings.
  const admin = createServiceClient()
  const { error: profileErr } = await admin
    .from('customer_profiles')
    .insert({
      id:    authData.user.id,
      phone: normalizedPhone,
      name:  name.trim() || null,
      email,
    })

  if (profileErr) {
    Sentry.captureException(profileErr, {
      tags: { stage: 'customer_profile.insert' },
      extra: { userId: authData.user.id },
    })
    return { success: false, error: 'signup_error' }
  }

  return { success: true }
}
