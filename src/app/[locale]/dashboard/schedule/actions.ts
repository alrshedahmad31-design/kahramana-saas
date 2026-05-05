'use server'

import { revalidatePath }       from 'next/cache'
import { createServiceClient }  from '@/lib/supabase/server'
import { getSession }           from '@/lib/auth/session'
import type { AuthUser }        from '@/lib/auth/session'
import { assertBranchScope, getDashboardGuardErrorMessage } from '@/lib/auth/dashboard-guards'
import type { ShiftStatus }     from '@/lib/supabase/custom-types'

type ActionResult = { success: true } | { success: false; error: string }

function canManageSchedule(role: string | null): boolean {
  return ['owner', 'general_manager', 'branch_manager'].includes(role ?? '')
}

function isGlobalManager(role: string | null): boolean {
  return role === 'owner' || role === 'general_manager'
}

type BranchScopedCaller = Pick<AuthUser, 'role' | 'branch_id'>

function scopedBranchId(caller: BranchScopedCaller, branchId: string | null): string | null {
  return isGlobalManager(caller.role) ? branchId : caller.branch_id
}

async function assertStaffScope(
  service: ReturnType<typeof createServiceClient>,
  caller: BranchScopedCaller,
  staffId: string,
): Promise<ActionResult> {
  const { data: staff, error } = await service
    .from('staff_basic')
    .select('id, branch_id')
    .eq('id', staffId)
    .single()

  if (error || !staff) return { success: false, error: 'Staff not found' }

  try {
    assertBranchScope(caller, staff.branch_id)
  } catch (guardError) {
    return { success: false, error: getDashboardGuardErrorMessage(guardError) }
  }

  return { success: true }
}

async function assertShiftScope(
  service: ReturnType<typeof createServiceClient>,
  caller: BranchScopedCaller,
  shiftId: string,
): Promise<ActionResult> {
  const { data: shift, error } = await service
    .from('shifts')
    .select('id, branch_id')
    .eq('id', shiftId)
    .single()

  if (error || !shift) return { success: false, error: 'Shift not found' }

  try {
    assertBranchScope(caller, shift.branch_id)
  } catch (guardError) {
    return { success: false, error: getDashboardGuardErrorMessage(guardError) }
  }

  return { success: true }
}

async function assertLeaveScope(
  service: ReturnType<typeof createServiceClient>,
  caller: BranchScopedCaller,
  leaveId: string,
): Promise<ActionResult> {
  const { data: leave, error } = await service
    .from('leave_requests')
    .select('id, staff_id')
    .eq('id', leaveId)
    .single()

  if (error || !leave) return { success: false, error: 'Leave request not found' }

  return assertStaffScope(service, caller, leave.staff_id)
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
  const branchId = scopedBranchId(caller, input.branch_id)
  if (!branchId) return { success: false, error: 'Branch is required' }

  const staffScope = await assertStaffScope(service, caller, input.staff_id)
  if (!staffScope.success) return staffScope

  const { error } = await service.from('shifts').insert({
    staff_id:   input.staff_id,
    branch_id:  branchId,
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
  const shiftScope = await assertShiftScope(service, caller, shiftId)
  if (!shiftScope.success) return shiftScope

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
  const shiftScope = await assertShiftScope(service, caller, shiftId)
  if (!shiftScope.success) return shiftScope

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
  const leaveScope = await assertLeaveScope(service, caller, leaveId)
  if (!leaveScope.success) return leaveScope

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
