'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

type SetPasswordResult =
  | { success: true }
  | { success: false; error: 'no_session' | 'too_short' | 'reauth_required' | 'reauth_failed' | 'server_error' }

const RECOVERY_COOKIE = 'kah_recovery_flow'

export async function setPasswordAction(
  newPassword: string,
  currentPassword?: string,
): Promise<SetPasswordResult> {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { success: false, error: 'too_short' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, error: 'no_session' }

  // Recovery cookie is set by /auth/callback when type=recovery — it is the
  // single trusted signal that this session came from a reset link. Without
  // it, an attacker who hijacks an active session could just rotate the
  // password (VULN-AUTH-06). Non-recovery sessions must re-prove the
  // current password before we let updateUser through.
  const cookieStore = await cookies()
  const isRecovery = cookieStore.get(RECOVERY_COOKIE)?.value === '1'

  if (!isRecovery) {
    if (!currentPassword) return { success: false, error: 'reauth_required' }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
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
    cookieStore.set(RECOVERY_COOKIE, '', {
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
  return { isRecovery: cookieStore.get(RECOVERY_COOKIE)?.value === '1' }
}
