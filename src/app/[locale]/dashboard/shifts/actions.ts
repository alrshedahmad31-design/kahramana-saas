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

  if (!isGlobalDashboardAdmin(user) && user.branch_id && user.branch_id !== v.branch_id) {
    return { success: false, code: 'branch_scope', error: 'Forbidden: branch scope violation' }
  }

  const actual   = round3(v.actual_cash_bhd)
  const expected = round3(v.expected_cash_bhd)
  const revenue  = round3(v.total_revenue_bhd)

  const supabase = await createClient()
  const { error } = await supabase.from('shift_closings').insert({
    branch_id:          v.branch_id,
    shift_date:         v.shift_date,
    shift_type:         v.shift_type,
    actual_cash_bhd:    actual,
    expected_cash_bhd:  expected,
    total_orders:       v.total_orders,
    total_revenue_bhd:  revenue,
    notes:              v.notes ?? null,
    discrepancy_reason: v.discrepancy_reason ?? null,
    closed_by:          user.id,
    status:             Math.abs(actual - expected) > 0.005 ? 'flagged' : 'pending',
  })

  if (error) {
    console.error('[shifts] closeShift insert failed:', error)
    return { success: false, code: 'db_error', error: error.message }
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
  const { error } = await supabase.from('shift_closings')
    .update({
      status:      'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)

  if (error) {
    console.error('[shifts] approveShift update failed:', error)
    return { success: false, code: 'db_error', error: error.message }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}
