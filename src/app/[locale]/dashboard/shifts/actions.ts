'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { startOfDay, endOfDay } from 'date-fns'
import { getTranslations } from 'next-intl/server'
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
      Sentry.captureException(error, { tags: { stage: 'shifts.summary.query' } })
      return { error: 'db_error' as const, expectedCash: 0, orderCount: 0 }
    }

    const expectedCash = (orders ?? []).reduce((sum, o) => sum + Number(o.total_bhd), 0)
    return { expectedCash, orderCount: (orders ?? []).length }
  } catch (e) {
    if (isDashboardGuardError(e)) return { error: 'forbidden' as const, expectedCash: 0, orderCount: 0 }
    Sentry.captureException(e, { tags: { stage: 'shifts.summary' } })
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
  const t = await getTranslations('dashboard.shifts.errors')

  let user
  try {
    user = await requireDashboardSection('shifts')
  } catch (e) {
    return { success: false, code: 'forbidden', error: isDashboardGuardError(e) ? e.message : t('forbidden') }
  }

  const parsed = closeShiftSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      code: 'invalid_input',
      error: first ? `${first.path.join('.')}: ${first.message}` : t('invalidInput'),
    }
  }
  const v = parsed.data

  // Fail-closed for null user.branch_id on non-global staff (VULN-RBAC-01 shape).
  if (!isGlobalDashboardAdmin(user) && (!user.branch_id || user.branch_id !== v.branch_id)) {
    return { success: false, code: 'branch_scope', error: t('branchScope') }
  }
  // Guard-asserted but TS-narrowed: requireDashboardSection rejects null roles.
  if (!user.role) {
    return { success: false, code: 'forbidden', error: t('noRole') }
  }

  const actual   = round3(v.actual_cash_bhd)
  const expected = round3(v.expected_cash_bhd)
  const revenue  = round3(v.total_revenue_bhd)

  const supabase = await createClient()
  // Atomic: shift_closings INSERT + audit_logs INSERT in one transaction.
  // Previously the JS side did only the insert and skipped audit entirely
  // (KAH-2026-05-06 — financial-event audit gap).
  const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_close_shift', {
    p_branch_id:          v.branch_id,
    p_shift_date:         v.shift_date,
    p_shift_type:         v.shift_type,
    p_actual_cash_bhd:    actual,
    p_expected_cash_bhd:  expected,
    p_total_orders:       v.total_orders,
    p_total_revenue_bhd:  revenue,
    p_notes:              v.notes ?? '',
    p_discrepancy_reason: v.discrepancy_reason ?? '',
    p_actor_id:           user.id,
    p_actor_role:         user.role,
  })

  if (rpcErr) {
    Sentry.captureException(rpcErr, { tags: { area: 'shifts', action: 'closeShift' } })
    return { success: false, code: 'db_error', error: t('dbError') }
  }

  const result = rpcData as { success: boolean; code?: string } | null
  if (!result?.success) {
    Sentry.captureException(new Error(`rpc_close_shift non-success: ${result?.code ?? 'unknown'}`), {
      tags: { area: 'shifts', action: 'closeShift' },
    })
    return { success: false, code: 'db_error', error: t('dbError') }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}

type ApproveShiftRpc =
  | { ok: true;  status: 'approved' }
  | { ok: false; code: string }

function isApproveRpc(v: unknown): v is ApproveShiftRpc {
  return typeof v === 'object' && v !== null && 'ok' in v
}

export async function approveShift(shiftId: string): Promise<ShiftActionResult> {
  const t = await getTranslations('dashboard.shifts.errors')

  let user
  try {
    user = await requireDashboardSection('shifts')
  } catch (e) {
    return { success: false, code: 'forbidden', error: isDashboardGuardError(e) ? e.message : t('forbidden') }
  }

  if (!isGlobalDashboardAdmin(user)) {
    return { success: false, code: 'forbidden', error: t('approveOwnerOnly') }
  }

  const idParsed = z.string().uuid().safeParse(shiftId)
  if (!idParsed.success) {
    return { success: false, code: 'invalid_input', error: t('invalidShiftId') }
  }

  // Atomic: rpc_approve_shift (migration 169) re-checks role under
  // SECURITY DEFINER, runs the status CAS (pending → approved), stamps
  // approved_by from auth.uid() and approved_at server-side, and writes
  // audit_logs in the same transaction.
  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_approve_shift', {
    p_shift_id: idParsed.data,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'shifts', action: 'approveShift' } })
    return { success: false, code: 'db_error', error: t('dbError') }
  }

  const rpc = isApproveRpc(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_approve_shift unexpected payload'), {
      tags: { area: 'shifts', action: 'approveShift' },
      extra: { payload: rpcRaw },
    })
    return { success: false, code: 'db_error', error: t('dbError') }
  }
  if (!rpc.ok) {
    switch (rpc.code) {
      case 'forbidden_role':       return { success: false, code: 'forbidden',     error: t('approveOwnerOnly') }
      case 'not_found':            return { success: false, code: 'invalid_input', error: t('shiftNotFound') }
      case 'forbidden_transition': return { success: false, code: 'invalid_input', error: t('alreadyHandled', { status: 'approved/rejected' }) }
      case 'conflict':             return { success: false, code: 'invalid_input', error: t('conflict') }
      default:
        Sentry.captureException(new Error(`rpc_approve_shift unknown code: ${rpc.code}`), {
          tags: { area: 'shifts', action: 'approveShift' },
        })
        return { success: false, code: 'db_error', error: t('dbError') }
    }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}
