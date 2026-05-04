'use server'

import { createServiceClient }        from '@/lib/supabase/server'
import { headers }                    from 'next/headers'
import { calcTotalHours, calcOvertimeHours } from '@/lib/staff/calculations'
import type { StaffBasicRow, StaffRole } from '@/lib/supabase/custom-types'

export type ClockResult =
  | { success: true;  staff: Pick<StaffBasicRow, 'id' | 'name' | 'role' | 'branch_id'>; activeEntry: string | null }
  | { success: false; error: string }

const failedPinAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_PIN_ATTEMPTS = 5
const PIN_WINDOW_MS = 60_000

async function getAttemptKey(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function isBlocked(key: string): boolean {
  const attempt = failedPinAttempts.get(key)
  if (!attempt) return false
  if (Date.now() > attempt.resetAt) {
    failedPinAttempts.delete(key)
    return false
  }
  return attempt.count >= MAX_PIN_ATTEMPTS
}

function recordPinFailure(key: string): void {
  const now = Date.now()
  const current = failedPinAttempts.get(key)
  if (!current || now > current.resetAt) {
    failedPinAttempts.set(key, { count: 1, resetAt: now + PIN_WINDOW_MS })
    return
  }
  failedPinAttempts.set(key, { count: current.count + 1, resetAt: current.resetAt })
}

async function assertStaffPin(staffId: string, pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false

  const service = await createServiceClient()
  const { data } = await service
    .from('staff_basic')
    .select('id')
    .eq('id', staffId)
    .eq('clock_pin', pin)
    .eq('is_active', true)
    .maybeSingle()

  return Boolean(data)
}

// ── verifyPin ─────────────────────────────────────────────────────────────────

export async function verifyPin(pin: string): Promise<ClockResult> {
  if (!/^\d{4}$/.test(pin)) return { success: false, error: 'Invalid PIN format' }
  const attemptKey = await getAttemptKey()
  if (isBlocked(attemptKey)) return { success: false, error: 'Too many attempts. Try again shortly.' }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('staff_basic')
    .select('id, name, role, branch_id, is_active')
    .eq('clock_pin', pin)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    recordPinFailure(attemptKey)
    return { success: false, error: 'PIN not found' }
  }

  failedPinAttempts.delete(attemptKey)

  const staff = data as { id: string; name: string; role: StaffRole; branch_id: string | null }

  const { data: openEntry } = await service
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

export async function clockIn(
  staffId: string,
  pin: string,
): Promise<{ success: boolean; error?: string; entryId?: string }> {
  if (!await assertStaffPin(staffId, pin)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()

  const { data: open } = await service
    .from('time_entries')
    .select('id')
    .eq('staff_id', staffId)
    .is('clock_out', null)
    .maybeSingle()

  if (open) return { success: false, error: 'Already clocked in' }

  const { data, error } = await service
    .from('time_entries')
    .insert({ staff_id: staffId, clock_in: new Date().toISOString(), break_minutes: 0 })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, entryId: (data as { id: string }).id }
}

// ── clockOut ──────────────────────────────────────────────────────────────────

export async function clockOut(
  entryId: string,
  staffId: string,
  pin: string,
): Promise<{ success: boolean; error?: string; hoursWorked?: number }> {
  if (!await assertStaffPin(staffId, pin)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()

  const { data: entry } = await service
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

  const { error } = await service.from('time_entries').update({
    clock_out:      clockOutTime,
    total_hours:    totalHours,
    overtime_hours: overtimeHours,
  }).eq('id', entryId)

  if (error) return { success: false, error: error.message }
  return { success: true, hoursWorked: totalHours }
}
