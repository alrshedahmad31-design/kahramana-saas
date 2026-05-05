'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { assertBranchScope, getDashboardGuardErrorMessage, requireDashboardRole } from '@/lib/auth/dashboard-guards'

const TOLERANCE_BD  = 0.5   // discrepancies ≤ 0.500 BD → auto-verified

export type ReconcileResult =
  | { success: true; status: 'verified' | 'discrepancy' }
  | { error: string }

type HandoverScopeRow = {
  id: string
  total_cash: number
  reconciliation_status: string
  staff_basic: { branch_id: string | null } | { branch_id: string | null }[] | null
}

function joinedStaffBranch(row: HandoverScopeRow): string | null {
  const staff = Array.isArray(row.staff_basic) ? row.staff_basic[0] : row.staff_basic
  return staff?.branch_id ?? null
}

export async function reconcileCashHandover(input: {
  handoverId:     string
  actualReceived: number
  notes?:         string
}): Promise<ReconcileResult> {
  let user
  try {
    user = await requireDashboardRole(['owner', 'general_manager', 'branch_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const { handoverId, actualReceived, notes } = input

  if (!Number.isFinite(actualReceived) || actualReceived < 0) {
    return { error: 'Invalid amount' }
  }

  const service = await createServiceClient()

  const { data: handover, error: fetchErr } = await service
    .from('driver_cash_handovers')
    .select('id, total_cash, reconciliation_status, staff_basic!driver_id(branch_id)')
    .eq('id', handoverId)
    .single()

  if (fetchErr || !handover) return { error: 'Handover not found' }
  try {
    assertBranchScope(user, joinedStaffBranch(handover as HandoverScopeRow))
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (handover.reconciliation_status !== 'pending') {
    return { error: 'Handover already reconciled' }
  }

  const delta     = actualReceived - Number(handover.total_cash)
  const absDelta  = Math.abs(delta)
  const isWithin  = absDelta <= TOLERANCE_BD
  const newStatus = isWithin ? 'verified' : 'discrepancy'

  if (!isWithin && !notes?.trim()) {
    return { error: 'Notes are required when discrepancy exceeds 0.500 BD' }
  }

  const now = new Date().toISOString()

  const { error: updateErr } = await service
    .from('driver_cash_handovers')
    .update({
      actual_received:      Number(actualReceived.toFixed(3)),
      reconciliation_status: newStatus,
      manager_notes:        notes?.trim() ?? null,
      received_by:          user.id,
      verified:             isWithin,
      verified_at:          now,
    })
    .eq('id', handoverId)
    .eq('reconciliation_status', 'pending')

  if (updateErr) return { error: updateErr.message }

  await service.from('audit_logs').insert({
    table_name: 'driver_cash_handovers',
    record_id:  handoverId,
    action:     'UPDATE',
    user_id:    user.id,
    actor_role: user.role,
    changes: {
      reconciliation_status: newStatus,
      actual_received:       actualReceived,
      delta,
    },
  })

  return { success: true, status: newStatus }
}

export async function disputeCashHandover(
  handoverId: string,
  notes:      string,
): Promise<{ success: true } | { error: string }> {
  let user
  try {
    user = await requireDashboardRole(['owner', 'general_manager', 'branch_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!notes.trim()) return { error: 'Notes are required to dispute a handover' }

  const service = await createServiceClient()

  const { data: handover, error: fetchErr } = await service
    .from('driver_cash_handovers')
    .select('id, reconciliation_status, staff_basic!driver_id(branch_id)')
    .eq('id', handoverId)
    .single()

  if (fetchErr || !handover) return { error: 'Handover not found' }
  try {
    assertBranchScope(user, joinedStaffBranch(handover as HandoverScopeRow))
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const { error } = await service
    .from('driver_cash_handovers')
    .update({
      reconciliation_status: 'disputed',
      manager_notes:         notes.trim(),
      received_by:           user.id,
    })
    .eq('id', handoverId)
    .in('reconciliation_status', ['pending', 'discrepancy'])

  if (error) return { error: error.message }

  await service.from('audit_logs').insert({
    table_name: 'driver_cash_handovers',
    record_id:  handoverId,
    action:     'UPDATE',
    user_id:    user.id,
    actor_role: user.role,
    changes:    { reconciliation_status: 'disputed', manager_notes: notes.trim() },
  })

  return { success: true }
}
