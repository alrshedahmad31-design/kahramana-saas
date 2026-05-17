'use server'

import { headers } from 'next/headers'
import { createHash } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type AuthError =
  | 'rate_limited'
  | 'invalid_credentials'
  | 'signup_error'
  | 'invalid_phone'
  | 'email_exists'
  | 'password_too_short'
  | 'password_too_weak'
  | 'name_too_long'
  | 'captcha'

type AuthResult = { success: true } | { success: false; error: AuthError }

// Turnstile verification for login + register. Production fails closed
// when TURNSTILE_SECRET_KEY isn't configured — credential-stuffing surface
// must never silently bypass. Dev/preview fall through so local testing
// stays unblocked. Matches contact/reserve post-T1 pattern.
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
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

// Per-action limits: login is tighter (credential-stuffing surface);
// register gets more headroom because real users may mistype phone/email
// and a single mistake shouldn't cost 20% of their attempts.
const RATE_LIMITS: Record<'login' | 'register', number> = {
  login:    5,
  register: 10,
}

// rate limiting disabled in dev/preview — per feedback_rate_limit_node_env_gate.md
// Dev/preview share 127.0.0.1, so the shared budget collapses and blocks the
// next contributor on the same network. Production fails closed when Upstash
// isn't configured — credential-stuffing protection must never silently drop
// during an env-var rotation. Matches staff /login + contact/reserve pattern.
async function checkRateLimit(key: 'login' | 'register'): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    return true
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    Sentry.captureMessage(`account_${key}.rate_limit_unconfigured`, { level: 'warning' })
    return false
  }
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(RATE_LIMITS[key], '15 m'),
    })
    const headersList = await headers()
    // Prefer edge-set x-real-ip (not client-controllable) over x-forwarded-for
    // (request-echoed and spoofable) so credential-stuffing IPs can't bypass
    // the per-IP budget by setting their own XFF header.
    const ip = headersList.get('x-real-ip')
            ?? headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? '127.0.0.1'
    const { success } = await ratelimit.limit(`auth:${key}:${ip}`)
    return success
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: `account_${key}.rate_limit` } })
    return false
  }
}

// T2-9: second rate-limit dimension keyed on the email address. The IP gate
// alone lets a botnet credential-stuff a single victim from many addresses
// at one-attempt-each — well below the per-IP budget — but adds up to
// thousands against the same account. Hashed so we don't store the email
// in Redis. Production-only for the same dev/preview reason as the IP gate.
async function checkEmailRateLimit(email: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    Sentry.captureMessage('account_login.email_rate_limit_unconfigured', { level: 'warning' })
    return false
  }
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix:  'auth_login_email',
    })
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
    const { success } = await ratelimit.limit(`auth:login:email:${hash}`)
    return success
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: 'account_login.email_rate_limit' } })
    return false
  }
}

const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
})

// Mirrors the manual checks in registerAction so input validation lives in one
// place. Password strength (letters + digits) stays in the action body — it's
// a refinement that maps to a specific error code the caller already handles.
const registerSchema = z.object({
  email:    z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  name:     z.string().trim().min(1).max(120),
  phone:    z.string().trim().min(7).max(30),
})

export async function loginAction(
  emailRaw: string,
  passwordRaw: string,
  turnstileToken?: string,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({ email: emailRaw, password: passwordRaw })
  if (!parsed.success) return { success: false, error: 'invalid_credentials' }

  // T2-9: gate the credential check on Turnstile + IP + email rate-limits.
  // Order matters: cheap checks first so an attacker can't burn the email
  // budget by sending invalid Turnstile tokens.
  const captchaOk = await verifyTurnstile(turnstileToken ?? '')
  if (!captchaOk) return { success: false, error: 'captcha' }

  const ipAllowed = await checkRateLimit('login')
  if (!ipAllowed) return { success: false, error: 'rate_limited' }

  const emailAllowed = await checkEmailRateLimit(parsed.data.email)
  if (!emailAllowed) return { success: false, error: 'rate_limited' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  })
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
  turnstileToken?: string,
): Promise<AuthResult> {
  const captchaOk = await verifyTurnstile(turnstileToken ?? '')
  if (!captchaOk) return { success: false, error: 'captcha' }

  const allowed = await checkRateLimit('register')
  if (!allowed) return { success: false, error: 'rate_limited' }

  // Shape gate via Zod — covers email format, password 8..72, name 1..120,
  // phone 7..30. Specific failure codes (password_too_short / name_too_long)
  // are derived from the parse error so the UI keeps its existing messaging.
  const parsed = registerSchema.safeParse({ email, password, name, phone })
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    if (flat.password?.length) {
      return { success: false, error: 'password_too_short' }
    }
    if (flat.name?.length) {
      return { success: false, error: 'name_too_long' }
    }
    if (flat.phone?.length) {
      return { success: false, error: 'invalid_phone' }
    }
    return { success: false, error: 'signup_error' }
  }

  // Strength gate — checks letter + digit. Lives outside Zod because it maps
  // to its own error code (password_too_weak vs the generic password_too_short
  // returned by the schema length check).
  if (!/[A-Za-z]/.test(parsed.data.password) || !/[0-9]/.test(parsed.data.password)) {
    return { success: false, error: 'password_too_weak' }
  }

  const normalizedPhone = normalizePhone(parsed.data.phone)
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
    email:    parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        flow:  'customer_register',
        phone: normalizedPhone,
        name:  parsed.data.name,
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
      return { success: false, error: 'email_exists' }
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
    name:  parsed.data.name || null,
    email: parsed.data.email,
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
