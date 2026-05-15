'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { captureAnalyticsError } from '@/lib/analytics/result-helpers'

export interface MarkAlertReadResult {
  ok: boolean
  error?: string
}

export async function markAlertRead(
  alertId: string,
  locale: string,
): Promise<MarkAlertReadResult> {
  const user = await getSession()
  if (!user) return { ok: false, error: 'unauthorized' }

  const allowed = user.role === 'owner'
    || user.role === 'general_manager'
    || user.role === 'branch_manager'
  if (!allowed) return { ok: false, error: 'forbidden' }

  if (typeof alertId !== 'string' || alertId.length === 0) {
    return { ok: false, error: 'invalid_id' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('operations_alerts')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('id', alertId)
    .eq('is_read', false)

  if (error) {
    captureAnalyticsError({
      function:  'markAlertRead',
      code:      error.code ?? 'unknown',
      message:   error.message,
      timestamp: new Date().toISOString(),
    })
    return { ok: false, error: 'update_failed' }
  }

  revalidatePath(`/${locale}/dashboard`)
  return { ok: true }
}
