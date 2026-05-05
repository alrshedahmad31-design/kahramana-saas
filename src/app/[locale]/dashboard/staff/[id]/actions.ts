'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession }          from '@/lib/auth/session'
import { canManageStaff }      from '@/lib/auth/rbac'
import { assertBranchScope, getDashboardGuardErrorMessage } from '@/lib/auth/dashboard-guards'
import type { EmploymentType, StaffBasicRow, TablesUpdate } from '@/lib/supabase/custom-types'

type ActionResult = { success: true } | { success: false; error: string }

function revalidateProfile(id: string) {
  revalidatePath(`/dashboard/staff/${id}`)
  revalidatePath(`/ar/dashboard/staff/${id}`)
  revalidatePath(`/en/dashboard/staff/${id}`)
}

// ── updateStaffProfile ────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  id:                      string
  phone?:                  string
  hire_date?:              string | null
  employment_type?:        EmploymentType | null
  hourly_rate?:            number | null
  emergency_contact_name?: string
  emergency_contact_phone?: string
  address?:                string
  clock_pin?:              string
  staff_notes?:            string
}

export async function updateStaffProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()
  const { data: target } = await service.from('staff_basic')
    .select('id, role, branch_id, is_active').eq('id', input.id).single()

  if (!target) return { success: false, error: 'Staff member not found' }
  if (!canManageStaff(caller, target as Pick<StaffBasicRow, 'id' | 'role' | 'branch_id' | 'is_active'>)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  if (input.clock_pin && !/^\d{4}$/.test(input.clock_pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' }
  }

  const updates: TablesUpdate<'staff_basic'> = {}
  if (input.phone                   !== undefined) updates.phone                   = input.phone || null
  if (input.hire_date               !== undefined) updates.hire_date               = input.hire_date
  if (input.employment_type         !== undefined) updates.employment_type         = input.employment_type
  if (input.hourly_rate             !== undefined) updates.hourly_rate             = input.hourly_rate
  if (input.emergency_contact_name  !== undefined) updates.emergency_contact_name  = input.emergency_contact_name || null
  if (input.emergency_contact_phone !== undefined) updates.emergency_contact_phone = input.emergency_contact_phone || null
  if (input.address                 !== undefined) updates.address                 = input.address || null
  if (input.clock_pin               !== undefined) updates.clock_pin               = input.clock_pin || null
  if (input.staff_notes             !== undefined) updates.staff_notes             = input.staff_notes || null

  const { error } = await service.from('staff_basic').update(updates).eq('id', input.id)

  if (error) return { success: false, error: error.message }
  revalidateProfile(input.id)
  return { success: true }
}

// ── createLeaveRequest ────────────────────────────────────────────────────────

export interface LeaveRequestInput {
  staff_id:   string
  leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid' | 'other'
  start_date: string
  end_date:   string
  reason?:    string
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1
}

export async function createLeaveRequest(input: LeaveRequestInput): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (caller.id !== input.staff_id) return { success: false, error: 'Unauthorized' }

  const days = daysBetween(input.start_date, input.end_date)
  if (days < 1) return { success: false, error: 'End date must be after start date' }

  const service = await createServiceClient()
  const { error } = await service.from('leave_requests').insert({
    staff_id:   input.staff_id,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date:   input.end_date,
    days_count: days,
    reason:     input.reason ?? null,
    status:     'pending',
  })

  if (error) return { success: false, error: error.message }
  revalidateProfile(input.staff_id)
  return { success: true }
}

// ── approveTimeEntry ──────────────────────────────────────────────────────────

export async function approveTimeEntry(entryId: string): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller || !['owner','general_manager','branch_manager'].includes(caller.role ?? '')) {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()

  const { data: entry } = await service
    .from('time_entries')
    .select('staff_id')
    .eq('id', entryId)
    .single()

  if (!entry) return { success: false, error: 'Time entry not found' }

  const { data: staff } = await service
    .from('staff_basic')
    .select('branch_id')
    .eq('id', entry.staff_id)
    .single()

  if (!staff) return { success: false, error: 'Staff not found' }

  try {
    assertBranchScope(caller, staff.branch_id)
  } catch (scopeError) {
    return { success: false, error: getDashboardGuardErrorMessage(scopeError) }
  }

  const { error } = await service.from('time_entries').update({
    approved_by: caller.id,
    approved_at: new Date().toISOString(),
  }).eq('id', entryId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/staff')
  return { success: true }
}
