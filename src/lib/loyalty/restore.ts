import { createServiceClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/supabase/custom-types'

// VULN-103: shared helper for the loyalty-restore path called from the order
// cancel/return flows AND from the payment-refund flow. Delegates to the
// migration 141 RPC so balance update + points_transactions + audit are
// atomic + idempotent (audit-row presence enforces idempotency).
export interface LoyaltyRestoreResult {
  ok:               true
  points_restored:  number
  code?:            string
}
export interface LoyaltyRestoreFailure {
  ok:    false
  error: string
}

export async function restoreLoyaltyForReversedOrder(
  orderId:        string,
  actor: {
    id:        string
    role:      StaffRole | null
    branch_id: string | null
  },
): Promise<LoyaltyRestoreResult | LoyaltyRestoreFailure> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase.rpc('rpc_restore_redeemed_loyalty_points', {
    p_order_id:        orderId,
    p_actor_id:        actor.id,
    p_actor_role:      actor.role ?? '',
    p_actor_branch_id: actor.branch_id,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const result = data as {
    success:          boolean
    code?:            string
    points_restored?: number
  } | null

  if (!result?.success) {
    return { ok: false, error: result?.code ?? 'unknown' }
  }

  return {
    ok:              true,
    points_restored: result.points_restored ?? 0,
    code:            result.code,
  }
}
