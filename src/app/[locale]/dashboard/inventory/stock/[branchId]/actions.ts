'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

import { isHiddenBranch } from '@/constants/contact'

export async function recordOpeningBalance(
  branchId: string,
  ingredientId: string,
  quantity: number
): Promise<{ error?: string }> {
  if (isHiddenBranch(branchId)) {
    return { error: 'Invalid branch' }
  }
  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, branchId)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (quantity < 0) return { error: 'الكمية يجب أن تكون أكبر من أو تساوي صفر' }

  const supabase = createServiceClient()

  // Migration 123: atomic opening balance. Movement insert + stock upsert run
  // in one transaction inside the RPC. Replaces the prior two-step pattern
  // that could leave a phantom movement row if the stock upsert failed.
  // The RPC also computes the delta server-side, closing the read-then-write
  // race that the old client-side delta calc had.
  // `as never` is the codebase convention for RPCs not yet in the auto-gen
  // types (see src/lib/analytics/queries.ts:684). Remove once `supabase gen
  // types --linked` is rerun.
  const { error } = await supabase.rpc('rpc_record_opening_balance' as never, {
    p_branch_id:     branchId,
    p_ingredient_id: ingredientId,
    p_quantity:      quantity,
    p_performed_by:  session.id,
  } as never)

  if (error) {
    // RPC raises QUANTITY_NEGATIVE on negative input; we already guarded above.
    // Any other error here is a real DB failure — surface its message.
    return { error: error.message }
  }

  revalidatePath(`/dashboard/inventory/stock/${branchId}`)
  revalidatePath(`/en/dashboard/inventory/stock/${branchId}`)
  return {}
}
