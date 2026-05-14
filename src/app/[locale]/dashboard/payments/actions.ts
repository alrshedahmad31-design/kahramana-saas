'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  requireDashboardSection,
  isDashboardGuardError,
} from '@/lib/auth/dashboard-guards'
import { refundCharge, TapRefundError } from '@/lib/payments/tap-client'
import { restoreLoyaltyForReversedOrder } from '@/lib/loyalty/restore'

export async function refundPayment(
  paymentId: string,
  locale: string,
): Promise<{ success?: true; error?: string }> {
  // VULN-102: owner/general_manager only. Dashboard-guard handles the section
  // ACL; we additionally pin to top-rank roles below for the refund mutation.
  let user
  try {
    user = await requireDashboardSection('payments')
  } catch (e) {
    if (isDashboardGuardError(e)) return { error: 'insufficient_permissions' }
    throw e
  }

  if (user.role !== 'owner' && user.role !== 'general_manager') {
    return { error: 'insufficient_permissions' }
  }

  // Service client to read the gateway_transaction_id reliably (RLS on payments
  // restricts authenticated SELECT to staff but the service path is consistent
  // with the rest of the refund flow).
  const service = await createServiceClient()
  const { data: payment, error: fetchErr } = await service
    .from('payments')
    .select('id, order_id, amount_bhd, method, status, gateway_transaction_id')
    .eq('id', paymentId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[payments] fetch failed:', fetchErr)
    return { error: 'update_failed' }
  }
  if (!payment) return { error: 'payment_not_found' }
  if (payment.status !== 'completed') return { error: 'not_refundable' }

  // VULN-102: no Tap charge → no API-side refund possible. Cash and any
  // other non-gateway methods cannot use this action (operator must reconcile
  // manually).
  if (!payment.gateway_transaction_id) {
    return { error: 'no_gateway_charge' }
  }

  // ── Tap API call (BEFORE any DB mutation) ──────────────────────────────────
  // On any Tap error we surface a generic error and leave the DB untouched.
  // The customer sees no status change; the operator can retry safely.
  let tapRefundId: string
  try {
    const refund = await refundCharge(payment.gateway_transaction_id, Number(payment.amount_bhd))
    tapRefundId = refund.id
  } catch (e) {
    if (e instanceof TapRefundError) {
      console.error('[payments] Tap refund API failed:', e.status, e.body)
      return { error: 'gateway_refund_failed' }
    }
    console.error('[payments] Tap refund API error:', e)
    return { error: 'gateway_refund_failed' }
  }

  // ── Atomic DB flip + audit (RPC, see migration 140) ───────────────────────
  const supabase = await createClient()
  const { data, error: rpcErr } = await supabase.rpc('rpc_refund_payment', {
    p_payment_id:        paymentId,
    p_gateway_refund_id: tapRefundId,
    p_actor_id:          user.id,
    p_actor_role:        user.role,
    p_actor_branch_id:   user.branch_id,
  })

  if (rpcErr) {
    // CRITICAL: the Tap refund SUCCEEDED but we failed to record it. Operator
    // must reconcile by hand using the tapRefundId from logs. Surface this as
    // a distinct error so a retry doesn't fire a second Tap refund.
    console.error('[payments] rpc_refund_payment failed AFTER tap refund', { paymentId, tapRefundId, rpcErr })
    return { error: 'refund_recorded_at_gateway_db_pending' }
  }

  const result = data as { success: boolean; code?: string; order_id?: string } | null
  if (!result?.success) {
    switch (result?.code) {
      case 'PAYMENT_NOT_FOUND':  return { error: 'payment_not_found' }
      case 'NOT_REFUNDABLE':     return { error: 'not_refundable' }
      case 'CONCURRENT_CHANGE':  return { error: 'refund_already_processed_or_status_changed' }
      case 'NO_GATEWAY_CHARGE':  return { error: 'no_gateway_charge' }
      case 'NO_REFUND_ID':       return { error: 'update_failed' }
      default:                   return { error: 'update_failed' }
    }
  }

  // VULN-103: restore redeemed loyalty points on refund. Idempotent + atomic
  // inside the RPC; a failure here does NOT roll back the refund (Tap and DB
  // have already recorded it) — log and let operators reconcile via audit.
  if (result.order_id) {
    const restore = await restoreLoyaltyForReversedOrder(result.order_id, user)
    if (!restore.ok) {
      console.error('[payments] loyalty restore failed for refunded order', result.order_id, restore.error)
    }
  }

  revalidatePath(locale === 'en' ? '/en/dashboard/payments' : '/dashboard/payments')
  return { success: true }
}
