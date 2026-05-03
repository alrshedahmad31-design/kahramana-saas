'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertBranchScope, assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardRole, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

export async function submitCountSession(
  sessionName: string,
  branchId: string,
  counts: { ingredient_id: string; system_qty: number; actual_qty: number }[],
): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, branchId)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!sessionName || !branchId || counts.length === 0) {
    return { error: 'البيانات غير مكتملة' }
  }

  const supabase = createServiceClient()

  const rows = counts.map((c) => ({
    branch_id:      branchId,
    ingredient_id:  c.ingredient_id,
    system_qty:     c.system_qty,
    actual_qty:     c.actual_qty,
    counted_by:     session.id,
    count_session:  sessionName,
    counted_at:     new Date().toISOString(),
  }))

  const { error } = await supabase.from('inventory_counts').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/inventory/count')
  return {}
}

export async function approveCountSession(
  sessionName: string,
  branchId: string,
): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardRole(['owner', 'general_manager', 'branch_manager'])
    assertBranchScope(session, branchId)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = createServiceClient()

  // C4 FIX: single atomic RPC replaces JS for-loop.
  // Old loop: item 3 of 10 failing left items 1-2 committed with no rollback.
  // New: all items in one plpgsql transaction — any failure rolls back all.
  const { error } = await supabase.rpc('rpc_inventory_count_session_approve', {
    p_session_name: sessionName,
    p_branch_id:    branchId,
    p_approved_by:  session.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/inventory/count')
  return {}
}
