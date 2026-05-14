'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { startOfDay, endOfDay } from 'date-fns'
import {
  requireDashboardSection,
  isGlobalDashboardAdmin,
  isDashboardGuardError,
} from '@/lib/auth/dashboard-guards'

export type ShiftActionResult =
  | { success: true }
  | { success: false; code: ShiftErrorCode; error: string }

export type ShiftErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'branch_scope'
  | 'db_error'
  | 'unknown'

export async function getShiftSummary(branchId: string, date: string) {
  try {
    const user = await requireDashboardSection('shifts')
    if (!isGlobalDashboardAdmin(user) && user.branch_id && user.branch_id !== branchId) {
      return { error: 'forbidden' as const, expectedCash: 0, orderCount: 0 }
    }

    const supabase = await createClient()
    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_bhd, status')
      .eq('branch_id', branchId)
      .gte('created_at', startOfDay(new Date(date)).toISOString())
      .lte('created_at', endOfDay(new Date(date)).toISOString())
      .in('status', ['delivered', 'completed'])

    if (error) {
      console.error('[shifts] getShiftSummary query failed:', error)
      return { error: 'db_error' as const, expectedCash: 0, orderCount: 0 }
    }

    const expectedCash = (orders ?? []).reduce((sum, o) => sum + Number(o.total_bhd), 0)
    return { expectedCash, orderCount: (orders ?? []).length }
  } catch (e) {
    if (isDashboardGuardError(e)) return { error: 'forbidden' as const, expectedCash: 0, orderCount: 0 }
    console.error('[shifts] getShiftSummary failed:', e)
    return { error: 'unknown' as const, expectedCash: 0, orderCount: 0 }
  }
}

const closeShiftSchema = z.object({
  branch_id:          z.string().min(1).max(50),
  shift_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'shift_date must be YYYY-MM-DD'),
  shift_type:         z.enum(['morning', 'evening', 'night']),
  actual_cash_bhd:    z.number().finite().min(0).max(1_000_000),
  expected_cash_bhd:  z.number().finite().min(0).max(1_000_000),
  total_orders:       z.number().int().min(0).max(100_000),
  total_revenue_bhd:  z.number().finite().min(0).max(1_000_000),
  notes:              z.string().max(2_000).optional(),
  discrepancy_reason: z.string().max(2_000).optional(),
})

export type CloseShiftInput = z.infer<typeof closeShiftSchema>

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export async function closeShift(data: CloseShiftInput): Promise<ShiftActionResult> {
  let user
  try {
    user = await requireDashboardSection('shifts')
  } catch (e) {
    return { success: false, code: 'forbidden', error: isDashboardGuardError(e) ? e.message : 'Forbidden' }
  }

  const parsed = closeShiftSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      code: 'invalid_input',
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input',
    }
  }
  const v = parsed.data

  // Fail-closed for null user.branch_id on non-global staff (VULN-RBAC-01 shape).
  if (!isGlobalDashboardAdmin(user) && (!user.branch_id || user.branch_id !== v.branch_id)) {
    return { success: false, code: 'branch_scope', error: 'Forbidden: branch scope violation' }
  }

  const actual   = round3(v.actual_cash_bhd)
  const expected = round3(v.expected_cash_bhd)
  const revenue  = round3(v.total_revenue_bhd)

  const supabase = await createClient()
  // Atomic: shift_closings INSERT + audit_logs INSERT in one transaction.
  // Previously the JS side did only the insert and skipped audit entirely
  // (KAH-2026-05-06 — financial-event audit gap).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('rpc_close_shift', {
    p_branch_id:          v.branch_id,
    p_shift_date:         v.shift_date,
    p_shift_type:         v.shift_type,
    p_actual_cash_bhd:    actual,
    p_expected_cash_bhd:  expected,
    p_total_orders:       v.total_orders,
    p_total_revenue_bhd:  revenue,
    p_notes:              v.notes ?? null,
    p_discrepancy_reason: v.discrepancy_reason ?? null,
    p_actor_id:           user.id,
    p_actor_role:         user.role,
  })

  if (rpcErr) {
    console.error('[shifts] rpc_close_shift failed:', rpcErr)
    return { success: false, code: 'db_error', error: 'An unexpected error occurred.' }
  }

  const result = rpcData as { success: boolean; code?: string } | null
  if (!result?.success) {
    return { success: false, code: 'db_error', error: result?.code ?? 'unknown' }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}

export async function approveShift(shiftId: string): Promise<ShiftActionResult> {
  let user
  try {
    user = await requireDashboardSection('shifts')
  } catch (e) {
    return { success: false, code: 'forbidden', error: isDashboardGuardError(e) ? e.message : 'Forbidden' }
  }

  if (!isGlobalDashboardAdmin(user)) {
    return { success: false, code: 'forbidden', error: 'Only owner/general_manager can approve shifts' }
  }

  const idParsed = z.string().uuid().safeParse(shiftId)
  if (!idParsed.success) {
    return { success: false, code: 'invalid_input', error: 'Invalid shift id' }
  }

  const supabase = await createClient()

  // VULN-RBAC-04: status-CAS — refuse to re-approve an already-approved shift.
  // Pin the update to status='pending' and verify a row was updated, so a
  // double-click or concurrent approval can't overwrite approved_by/approved_at.
  const { data: current, error: fetchErr } = await supabase
    .from('shift_closings')
    .select('status')
    .eq('id', idParsed.data)
    .maybeSingle()

  if (fetchErr) {
    console.error('[shifts] approveShift fetch failed:', fetchErr)
    return { success: false, code: 'db_error', error: fetchErr.message }
  }
  if (!current) {
    return { success: false, code: 'invalid_input', error: 'Shift not found' }
  }
  if (current.status !== 'pending') {
    return {
      success: false,
      code: 'invalid_input',
      error: `Shift is already ${current.status} — cannot approve`,
    }
  }

  const { data: updatedRows, error } = await supabase.from('shift_closings')
    .update({
      status:      'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    console.error('[shifts] approveShift update failed:', error)
    return { success: false, code: 'db_error', error: error.message }
  }
  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      code: 'invalid_input',
      error: 'Shift status changed — refresh and retry',
    }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}
