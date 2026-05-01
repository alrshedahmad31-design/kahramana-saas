'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession }   from '@/lib/auth/session'

const MANAGER_ROLES = new Set(['owner', 'general_manager', 'branch_manager'])

export async function verifyCashHandover(
  handoverId: string,
): Promise<{ success: true } | { error: string }> {
  const user = await getSession()
  if (!user || !MANAGER_ROLES.has(user.role ?? '')) {
    return { error: 'Unauthorized' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const { error } = await supabase
    .from('driver_cash_handovers')
    .update({ verified: true, received_by: user.id })
    .eq('id', handoverId)
    .eq('verified', false)

  if (error) return { error: error.message }
  return { success: true }
}
