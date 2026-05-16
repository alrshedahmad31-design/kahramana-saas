'use server'

import bcryptjs from 'bcryptjs'
import { z } from 'zod'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession }          from '@/lib/auth/session'
import { canManageStaff }      from '@/lib/auth/rbac'
import {
  assertBranchScope,
  getDashboardGuardErrorMessage,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import type { EmploymentType, StaffBasicRow, TablesUpdate } from '@/lib/supabase/custom-types'

// Single error string for both "target not found" and "permission denied".
// Returning differentiable messages turned this action into an oracle for
// enumerating staff IDs from any logged-in session (VULN-AUTH-01).
const STAFF_ACCESS_DENIED = 'Insufficient permissions'

type ActionResult = { success: true } | { success: false; error: string }

// 3-decimal precision matches Bahraini Dinar (fils). Cap is conservative —
// well above any realistic restaurant hourly rate, blocks bogus values.
const hourlyRateSchema = z.number()
  .min(0, 'hourly_rate must be non-negative')
  .max(100, 'hourly_rate exceeds maximum allowed (100 BHD/hr)')
  .refine((n) => Number.isInteger(Math.round(n * 1000)) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6,
    { message: 'hourly_rate must have at most 3 decimal places' })

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

// Leave window bounds: 30 days back (retroactive sick/emergency) through
// one year forward; max duration is 90 days (annual leave ceiling).
const LEAVE_PAST_DAYS    = 30
const LEAVE_FUTURE_DAYS  = 365
const LEAVE_MAX_DURATION = 90

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
  // Gate first — this prevents any service-role read from happening for
  // callers without 'staff' section access (drivers, marketing, support,
  // kitchen, waiter, cashier). VULN-AUTH-01: previously the staff row was
  // fetched before the permission check, leaking row existence via
  // differential error strings.
  let caller
  try {
    caller = await requireDashboardSection('staff')
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  const service = await createServiceClient()
  const { data: target } = await service.from('staff_basic')
    .select('id, role, branch_id, is_active').eq('id', input.id).single()

  // Unified error message: "not found" and "insufficient permissions" must
  // be indistinguishable so the caller cannot oracle which staff IDs exist.
  if (!target) return { success: false, error: STAFF_ACCESS_DENIED }
  if (!canManageStaff(caller, target as Pick<StaffBasicRow, 'id' | 'role' | 'branch_id' | 'is_active'>)) {
    return { success: false, error: STAFF_ACCESS_DENIED }
  }

  if (input.clock_pin && !/^\d{4}$/.test(input.clock_pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' }
  }

  if (input.hourly_rate !== undefined && input.hourly_rate !== null) {
    const parsed = hourlyRateSchema.safeParse(input.hourly_rate)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid hourly_rate' }
    }
  }

  const updates: TablesUpdate<'staff_basic'> = {}
  if (input.phone                   !== undefined) updates.phone                   = input.phone || null
  if (input.hire_date               !== undefined) updates.hire_date               = input.hire_date
  if (input.employment_type         !== undefined) updates.employment_type         = input.employment_type
  if (input.hourly_rate             !== undefined) updates.hourly_rate             = input.hourly_rate
  if (input.emergency_contact_name  !== undefined) updates.emergency_contact_name  = input.emergency_contact_name || null
  if (input.emergency_contact_phone !== undefined) updates.emergency_contact_phone = input.emergency_contact_phone || null
  if (input.address                 !== undefined) updates.address                 = input.address || null
  if (input.clock_pin               !== undefined) updates.clock_pin_hash           = input.clock_pin ? await bcryptjs.hash(input.clock_pin, 10) : null
  if (input.staff_notes             !== undefined) updates.staff_notes             = input.staff_notes || null

  // CAS: pin to the row state we just permission-checked. A concurrent role
  // or branch reassignment would otherwise allow our profile update to slip
  // past the freshly-elevated target's protections.
  const tgt = target as Pick<StaffBasicRow, 'id' | 'role' | 'branch_id' | 'is_active'>
  let q = service.from('staff_basic').update(updates)
    .eq('id', input.id)
    .eq('role', tgt.role)
    .eq('is_active', tgt.is_active)
  q = tgt.branch_id == null ? q.is('branch_id', null) : q.eq('branch_id', tgt.branch_id)
  const { data: updated, error } = await q.select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'concurrent_change_retry' }
  }
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

  const startParsed = dateOnlySchema.safeParse(input.start_date)
  const endParsed   = dateOnlySchema.safeParse(input.end_date)
  if (!startParsed.success || !endParsed.success) {
    return { success: false, error: 'Leave dates must be valid YYYY-MM-DD' }
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const minStart = new Date(today.getTime() - LEAVE_PAST_DAYS * 86_400_000)
  const maxStart = new Date(today.getTime() + LEAVE_FUTURE_DAYS * 86_400_000)
  const start    = new Date(input.start_date + 'T00:00:00Z')
  const end      = new Date(input.end_date   + 'T00:00:00Z')

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: 'Invalid leave date' }
  }
  if (start < minStart) return { success: false, error: `start_date must be within the last ${LEAVE_PAST_DAYS} days` }
  if (start > maxStart) return { success: false, error: `start_date cannot be more than ${LEAVE_FUTURE_DAYS} days in the future` }

  const days = daysBetween(input.start_date, input.end_date)
  if (days < 1) return { success: false, error: 'End date must be after start date' }
  if (days > LEAVE_MAX_DURATION) {
    return { success: false, error: `Leave duration cannot exceed ${LEAVE_MAX_DURATION} days` }
  }

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

  // CAS: only approve if currently unapproved. Prevents double-approval and
  // protects against concurrent reject/approve races.
  const { data: updated, error } = await service.from('time_entries').update({
    approved_by: caller.id,
    approved_at: new Date().toISOString(),
  }).eq('id', entryId).is('approved_by', null).select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'concurrent_change_retry' }
  }
  revalidatePath('/dashboard/staff')
  return { success: true }
}
