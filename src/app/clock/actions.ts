'use server'

import { createServiceClient }        from '@/lib/supabase/server'
import { calcTotalHours, calcOvertimeHours } from '@/lib/staff/calculations'
import type { StaffBasicRow, StaffRole } from '@/lib/supabase/custom-types'

export type ClockResult =
  | { success: true;  staff: Pick<StaffBasicRow, 'id' | 'name' | 'role' | 'branch_id'>; activeEntry: string | null }
  | { success: false; error: string }

// ── verifyPin ─────────────────────────────────────────────────────────────────

export async function verifyPin(pin: string): Promise<ClockResult> {
  if (!/^\d{4}$/.test(pin)) return { success: false, error: 'Invalid PIN format' }

  const service = await createServiceClient()
  // clock_pin is a new column — use `as any` until DB type is regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from('staff_basic')
    .select('id, name, role, branch_id, is_active, clock_pin')
    .eq('clock_pin', pin)
    .eq('is_active', true)
    .single()

  if (error || !data) return { success: false, error: 'PIN not found' }

  const staff = data as { id: string; name: string; role: StaffRole; branch_id: string | null }

  // Check for an open time entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openEntry } = await (service as any)
    .from('time_entries')
    .select('id')
    .eq('staff_id', staff.id)
    .is('clock_out', null)
    .maybeSingle()

  return {
    success:     true,
    staff:       { id: staff.id, name: staff.name, role: staff.role, branch_id: staff.branch_id },
    activeEntry: (openEntry as { id: string } | null)?.id ?? null,
  }
}

// ── clockIn ───────────────────────────────────────────────────────────────────

export async function clockIn(staffId: string): Promise<{ success: boolean; error?: string; entryId?: string }> {
  const service = await createServiceClient()

  // Guard against double clock-in
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: open } = await (service as any)
    .from('time_entries')
    .select('id')
    .eq('staff_id', staffId)
    .is('clock_out', null)
    .maybeSingle()

  if (open) return { success: false, error: 'Already clocked in' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from('time_entries')
    .insert({ staff_id: staffId, clock_in: new Date().toISOString(), break_minutes: 0 })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, entryId: (data as { id: string }).id }
}

// ── clockOut ──────────────────────────────────────────────────────────────────

export async function clockOut(entryId: string, staffId: string): Promise<{ success: boolean; error?: string; hoursWorked?: number }> {
  const service = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry } = await (service as any)
    .from('time_entries')
    .select('id, clock_in, break_minutes')
    .eq('id', entryId)
    .eq('staff_id', staffId)
    .single()

  if (!entry) return { success: false, error: 'Entry not found' }

  const { clock_in, break_minutes } = entry as { clock_in: string; break_minutes: number }
  const clockOutTime  = new Date().toISOString()
  const totalHours    = calcTotalHours(clock_in, clockOutTime, break_minutes)
  const overtimeHours = calcOvertimeHours(totalHours)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any).from('time_entries').update({
    clock_out:      clockOutTime,
    total_hours:    totalHours,
    overtime_hours: overtimeHours,
  }).eq('id', entryId)

  if (error) return { success: false, error: error.message }
  return { success: true, hoursWorked: totalHours }
}
