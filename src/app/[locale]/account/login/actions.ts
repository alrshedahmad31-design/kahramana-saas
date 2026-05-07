'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

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
  if (signUpErr || !authData.user?.id) return { success: false, error: 'signup_error' }

  const { error: profileErr } = await supabase.rpc('rpc_create_customer_profile', {
    p_phone: normalizedPhone,
    p_name:  name.trim() || undefined,
    p_email: email,
  })
  if (profileErr) return { success: false, error: 'signup_error' }

  return { success: true }
}
