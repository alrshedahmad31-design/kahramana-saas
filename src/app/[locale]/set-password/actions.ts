'use server'

import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  RECOVERY_COOKIE_NAME,
  verifyRecoveryCookie,
} from '@/lib/auth/recoveryCookie'

type SetPasswordResult =
  | { success: true }
  | { success: false; error:
        | 'no_session'
        | 'too_short'
        | 'too_long'
        | 'rate_limited'
        | 'reauth_required'
        | 'reauth_failed'
        | 'recovery_user_mismatch'
        | 'server_error'
    }

// 5/15m sliding window per live-session user. Defense against credential-spray
// on the currentPassword path — even when an attacker has a session cookie
// they can't burn through password attempts. Production-only; dev/preview share
// state and would wedge QA. Fails closed when Upstash isn't configured.
async function checkSetPasswordRateLimit(userId: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    Sentry.captureMessage('set_password.rate_limit_unconfigured', { level: 'warning' })
    return false
  }
  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix:  'set_password',
    })
    const { success } = await ratelimit.limit(`set_password:${userId}`)
    return success
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: 'set_password.rate_limit' } })
    return false
  }
}

export async function setPasswordAction(
  newPassword: string,
  currentPassword?: string,
): Promise<SetPasswordResult> {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { success: false, error: 'too_short' }
  }
  // Supabase passes the password to bcrypt which truncates to 72 bytes — cap
  // explicitly so the UI gets a clear error instead of silently rotating a
  // truncated value. Matches loginSchema in account/login/actions.ts.
  if (newPassword.length > 72) {
    return { success: false, error: 'too_long' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, error: 'no_session' }

  const allowed = await checkSetPasswordRateLimit(user.id)
  if (!allowed) return { success: false, error: 'rate_limited' }

  // Recovery cookie is set by /auth/callback when type=recovery — it is the
  // single trusted signal that this session came from a reset link. Without
  // it, an attacker who hijacks an active session could just rotate the
  // password (VULN-AUTH-06). Non-recovery sessions must re-prove the
  // current password before we let updateUser through.
  //
  // L1: cookie value is HMAC-bound to the user_id it was minted for. We
  // verify the HMAC AND that the bound user matches the live session user
  // — closes the cross-account session-swap vector (recovery proof from
  // user A applied to user B's session in the same browser).
  const cookieStore = await cookies()
  const verified = verifyRecoveryCookie(cookieStore.get(RECOVERY_COOKIE_NAME)?.value)
  const isRecovery = verified.ok && verified.userId === user.id

  // Bound to a different user — reject loudly. Don't fall through to the
  // currentPassword path: that would silently rotate the wrong account's
  // password if the caller knows the current password by coincidence.
  if (verified.ok && verified.userId !== user.id) {
    return { success: false, error: 'recovery_user_mismatch' }
  }

  if (!isRecovery) {
    if (!currentPassword) return { success: false, error: 'reauth_required' }
    // Non-cookied probe client: verify current password without touching the
    // user's live session cookies. A failed signInWithPassword on the cookied
    // client would mutate auth cookie state mid-flight; this one-shot client
    // has persistSession:false so the probe is side-effect-free (M2).
    const probeClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { error: reauthErr } = await probeClient.auth.signInWithPassword({
      email:    user.email,
      password: currentPassword,
    })
    if (reauthErr) return { success: false, error: 'reauth_failed' }
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
  if (updateErr) return { success: false, error: 'server_error' }

  // One-shot — clear the recovery marker the moment we accept it so a stale
  // tab can't reuse it after the user navigates away.
  if (isRecovery) {
    cookieStore.set(RECOVERY_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   0,
    })
  }

  return { success: true }
}

export async function getRecoveryFlowState(): Promise<{ isRecovery: boolean }> {
  const cookieStore = await cookies()
  const verified = verifyRecoveryCookie(cookieStore.get(RECOVERY_COOKIE_NAME)?.value)
  if (!verified.ok) return { isRecovery: false }

  // Cross-check live session — only report `isRecovery: true` when the
  // cookie's bound user matches the live session user. Prevents the
  // set-password UI from offering the simplified flow to the wrong account.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { isRecovery: !!user && verified.userId === user.id }
}
