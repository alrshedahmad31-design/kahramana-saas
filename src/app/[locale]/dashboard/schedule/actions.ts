'use server'

import { revalidatePath }       from 'next/cache'
import { createServiceClient }  from '@/lib/supabase/server'
import { getSession }           from '@/lib/auth/session'
import type { ShiftStatus }     from '@/lib/supabase/custom-types'

type ActionResult = { success: true } | { success: false; error: string }

function canManageSchedule(role: string | null): boolean {
  return ['owner', 'general_manager', 'branch_manager'].includes(role ?? '')
}

function revalidateSchedule() {
  revalidatePath('/dashboard/schedule')
  revalidatePath('/ar/dashboard/schedule')
  revalidatePath('/en/dashboard/schedule')
}

// ── createShift ───────────────────────────────────────────────────────────────

export interface CreateShiftInput {
  staff_id:   string
  branch_id:  string | null
  shift_date: string
  start_time: string
  end_time:   string
  position?:  string
  notes?:     string
}

export async function createShift(input: CreateShiftInput): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller || !canManageSchedule(caller.role)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()
  const { error } = await service.from('shifts').insert({
    staff_id:   input.staff_id,
    branch_id:  input.branch_id,
    shift_date: input.shift_date,
    start_time: input.start_time,
    end_time:   input.end_time,
    position:   input.position ?? null,
    notes:      input.notes    ?? null,
    created_by: caller.id,
    status:     'scheduled',
  })

  if (error) return { success: false, error: error.message }
  revalidateSchedule()
  return { success: true }
}

// ── updateShiftStatus ─────────────────────────────────────────────────────────

export async function updateShiftStatus(shiftId: string, status: ShiftStatus): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller || !canManageSchedule(caller.role)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()
  const { error } = await service.from('shifts').update({ status, updated_at: new Date().toISOString() }).eq('id', shiftId)

  if (error) return { success: false, error: error.message }
  revalidateSchedule()
  return { success: true }
}

// ── deleteShift ───────────────────────────────────────────────────────────────

export async function deleteShift(shiftId: string): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller || !canManageSchedule(caller.role)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()
  const { error } = await service.from('shifts').delete().eq('id', shiftId)

  if (error) return { success: false, error: error.message }
  revalidateSchedule()
  return { success: true }
}

// ── reviewLeaveRequest ────────────────────────────────────────────────────────

export async function reviewLeaveRequest(
  leaveId:  string,
  decision: 'approved' | 'rejected',
  notes?:   string,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller || !canManageSchedule(caller.role)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()
  const { error } = await service.from('leave_requests').update({
    status:         decision,
    reviewed_by:    caller.id,
    reviewed_at:    new Date().toISOString(),
    reviewer_notes: notes ?? null,
  }).eq('id', leaveId)

  if (error) return { success: false, error: error.message }
  revalidateSchedule()
  return { success: true }
}
