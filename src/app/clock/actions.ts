'use server'

import { createHash }                from 'crypto'
import { createServiceClient }       from '@/lib/supabase/server'
import { headers }                   from 'next/headers'
import { Ratelimit }                 from '@upstash/ratelimit'
import { Redis }                     from '@upstash/redis'
import { calcTotalHours, calcOvertimeHours } from '@/lib/staff/calculations'
import type { StaffBasicRow, StaffRole } from '@/lib/supabase/custom-types'

export type ClockResult =
  | { success: true;  staff: Pick<StaffBasicRow, 'id' | 'name' | 'role' | 'branch_id'>; activeEntry: string | null }
  | { success: false; error: string }

// ── PIN hashing ─────────────────────────────────────────────────────────────
function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex')
}

// ── Rate limiting (Upstash Redis — works across Vercel serverless instances) ──
let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null // graceful degradation if Redis not configured
  }
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    prefix:  'clock_pin',
  })
  return ratelimit
}

async function getAttemptKey(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

async function checkRateLimit(key: string): Promise<{ allowed: boolean }> {
  const rl = getRatelimit()
  if (!rl) return { allowed: true }
  const { success } = await rl.limit(key)
  return { allowed: success }
}

async function assertStaffPin(staffId: string, pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false

  const service = await createServiceClient()
  const { data } = await service
    .from('staff_basic')
    .select('id')
    .eq('id', staffId)
    .eq('clock_pin_hash', hashPin(pin))
    .eq('is_active', true)
    .maybeSingle()

  return Boolean(data)
}

// ── verifyPin ─────────────────────────────────────────────────────────────────

export async function verifyPin(pin: string): Promise<ClockResult> {
  if (!/^\d{4}$/.test(pin)) return { success: false, error: 'Invalid PIN format' }
  const attemptKey = await getAttemptKey()
  const { allowed } = await checkRateLimit(attemptKey)
  if (!allowed) return { success: false, error: 'Too many attempts. Try again shortly.' }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('staff_basic')
    .select('id, name, role, branch_id, is_active')
    .eq('clock_pin_hash', hashPin(pin))
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: 'PIN not found' }
  }

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
