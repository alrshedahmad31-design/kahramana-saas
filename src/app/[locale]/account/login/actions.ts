'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type AuthError = 'rate_limited' | 'invalid_credentials' | 'signup_error'
type AuthResult = { success: true } | { success: false; error: AuthError }

// Per-action limits: login is tighter (credential-stuffing surface);
// register gets more headroom because real users may mistype phone/email
// and a single mistake shouldn't cost 20% of their attempts.
const RATE_LIMITS: Record<'login' | 'register', number> = {
  login:    5,
  register: 10,
}

async function checkRateLimit(key: 'login' | 'register'): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return true
  }
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ])
  const ratelimit = new Ratelimit({
    redis:   Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(RATE_LIMITS[key], '15 m'),
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

  // raw_user_meta_data is read by the `on_customer_registered` AFTER INSERT
  // trigger on auth.users (migration 130). When the trigger fires inside the
  // same transaction as the auth.users insert, customer_profiles is created
  // synchronously — eliminating the FK race that produced the Sentry
  // `customer_profiles_id_fkey` events. `flow` scopes the trigger so it does
  // NOT fire for staff users created via authAdmin.createUser.
  const { data: authData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        flow:  'customer_register',
        phone: normalizedPhone,
        name:  name.trim(),
      },
    },
  })
  if (signUpErr || !authData.user?.id) {
    Sentry.captureException(signUpErr ?? new Error('signUp returned no user id'), {
      tags: { stage: 'auth.signUp' },
    })
    return { success: false, error: 'signup_error' }
  }

  // Belt-and-suspenders fallback: the trigger handles the happy path, but we
  // still run a service-role UPSERT to cover three cases:
  //   1. Trigger skipped because metadata.phone was somehow missing (defense
  //      in depth — shouldn't happen given we just set it above).
  //   2. Migration 130 was rolled back without redeploying this code.
  //   3. Future schema columns we want to populate that the trigger doesn't
  //      know about (none today, but the path stays open).
  // Why UPSERT not INSERT: the trigger already created the row, so INSERT
  // would 23505 (unique_violation). ON CONFLICT (id) DO NOTHING keeps it
  // idempotent. The 23503 retry below catches the original race only when
  // the trigger somehow didn't run.
  const admin = createServiceClient()
  const profile = {
    id:    authData.user.id,
    phone: normalizedPhone,
    name:  name.trim() || null,
    email,
  }

  const MAX_ATTEMPTS = 3
  let lastErr: { code?: string; message: string } | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error: upsertErr } = await admin
      .from('customer_profiles')
      .upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
    if (!upsertErr) { lastErr = null; break }
    lastErr = upsertErr
    // 23503 = foreign_key_violation. auth.users replication can lag for a
    // few ms across pgbouncer connections; back off and retry. Any other
    // error is non-retryable and we surface immediately.
    if (upsertErr.code !== '23503') break
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 100 * attempt))
    }
  }

  if (lastErr) {
    Sentry.captureException(new Error(lastErr.message), {
      tags: { stage: 'customer_profile.upsert', code: lastErr.code ?? 'unknown' },
      extra: { userId: authData.user.id },
    })
    return { success: false, error: 'signup_error' }
  }

  return { success: true }
}
