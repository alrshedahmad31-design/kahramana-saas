'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { canAccessPayments } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

export async function refundPayment(
  paymentId: string,
  locale: string,
): Promise<{ success?: true; error?: string }> {
  const user = await getSession()
  if (!user) return { error: 'unauthenticated' }

  // Refunds restricted to owner + general_manager only
  if (user.role !== 'owner' && user.role !== 'general_manager') {
    return { error: 'insufficient_permissions' }
  }

  if (!canAccessPayments(user)) return { error: 'insufficient_permissions' }

  const supabase = await createClient()

  // Atomic: the RPC does the CAS update on payments + audit_logs INSERT in a
  // single transaction. Audit failure rolls back the refund (KAH-2026-05-06).
  const { data, error: rpcErr } = await supabase.rpc('rpc_refund_payment', {
    p_payment_id:      paymentId,
    p_actor_id:        user.id,
    p_actor_role:      user.role,
    p_actor_branch_id: user.branch_id,
  })

  if (rpcErr) {
    console.error('[payments] rpc_refund_payment failed:', rpcErr)
    return { error: 'update_failed' }
  }

  const result = data as { success: boolean; code?: string } | null
  if (!result?.success) {
    switch (result?.code) {
      case 'PAYMENT_NOT_FOUND':  return { error: 'payment_not_found' }
      case 'NOT_REFUNDABLE':     return { error: 'not_refundable' }
      case 'CONCURRENT_CHANGE':  return { error: 'refund_already_processed_or_status_changed' }
      default:                   return { error: 'update_failed' }
    }
  }

  revalidatePath(locale === 'en' ? '/en/dashboard/payments' : '/dashboard/payments')
  return { success: true }
}
