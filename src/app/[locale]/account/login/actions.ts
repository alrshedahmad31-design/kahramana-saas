'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type AuthError = 'rate_limited' | 'invalid_credentials' | 'signup_error' | 'invalid_phone' | 'captcha'
type AuthResult = { success: true } | { success: false; error: AuthError }

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

// Soft-launch: returns true when the secret key is unset so dev/preview
// environments work without a Cloudflare account. Matches forgot-password pattern.
async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? headersList.get('x-real-ip')
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

export async function loginAction(email: string, password: string, turnstileToken: string): Promise<AuthResult> {
  const captchaOk = await verifyTurnstile(turnstileToken)
  if (!captchaOk) return { success: false, error: 'captcha' }

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
  turnstileToken: string,
): Promise<AuthResult> {
  const captchaOk = await verifyTurnstile(turnstileToken)
  if (!captchaOk) return { success: false, error: 'captcha' }

  const allowed = await checkRateLimit('register')
  if (!allowed) return { success: false, error: 'rate_limited' }

  const normalizedPhone = normalizePhone(phone)
  if (!/^\+973[0-9]{8}$/.test(normalizedPhone)) {
    return { success: false, error: 'invalid_phone' }
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
    // Supabase v2 + "Confirm email" ON: signing up with an already-confirmed
    // email returns { user: null, session: null, error: null } — a silent no-op
    // to prevent email enumeration. Detect it by the absence of both an error
    // AND a user id, and surface a clear "switch to login" message.
    const msg = signUpErr?.message?.toLowerCase() ?? ''
    const isEmailTaken =
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      signUpErr?.status === 422 ||
      (!signUpErr && !authData.user?.id)
    if (isEmailTaken) {
      // Anti-enumeration: mirror the successful-registration response so
      // callers cannot distinguish a new signup from a duplicate email.
      // Supabase's silent no-op (no email sent on dup) makes this safe —
      // the legitimate user simply receives no confirmation mail.
      return { success: true }
    }
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

  // 23505 = unique_violation on the phone column. Migration 145's trigger used
  // ON CONFLICT DO NOTHING, so it silently skipped when the phone was already
  // taken — leaving the auth.users row committed but no customer_profiles row
  // (orphan). Delete the orphaned auth user so the registrant is not locked out,
  // then return generic success to prevent phone-number enumeration.
  if (lastErr?.code === '23505') {
    Sentry.captureException(new Error('phone conflict — orphan cleanup'), {
      tags: { stage: 'signup_phone_orphan_recovered' },
      extra: { userId: authData.user.id },
    })
    const { error: deleteErr } = await admin.auth.admin.deleteUser(authData.user.id)
    if (deleteErr) {
      Sentry.captureException(deleteErr, {
        tags: { stage: 'signup_phone_orphan_failed' },
        extra: { userId: authData.user.id },
      })
    }
    return { success: true }
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
