'use server'

import bcryptjs                        from 'bcryptjs'
import { createHash, randomUUID }      from 'crypto'
import { createServiceClient }         from '@/lib/supabase/server'
import { cookies, headers }            from 'next/headers'
import { Ratelimit }                   from '@upstash/ratelimit'
import { Redis }                       from '@upstash/redis'
import { calcTotalHours, calcOvertimeHours } from '@/lib/staff/calculations'
import { toSafeError }                  from '@/lib/utils/safe-error'
import type { StaffBasicRow, StaffRole } from '@/lib/supabase/custom-types'

export type ClockResult =
  | { success: true;  staff: Pick<StaffBasicRow, 'id' | 'name' | 'role' | 'branch_id'>; activeEntry: string | null }
  | { success: false; error: string }

// ── PIN hashing ─────────────────────────────────────────────────────────────
//
// PINs are now bcrypt-hashed. Legacy unsalted SHA-256 hashes are still accepted
// during migration: `comparePinAndMaybeUpgrade` transparently rehashes them on
// successful login, so the column phases over to bcrypt without forcing staff
// to re-enroll. Once `clock_pin_hash LIKE '$2%'` reaches ~100%, the SHA-256
// fallback branch can be deleted.

const BCRYPT_COST = 10

// Known-valid bcrypt hash of an unguessable string. Used ONLY as a no-op
// timing equalizer in verifyPin when the active-staff roster is empty, so the
// "no staff" path doesn't return in microseconds. Result is discarded.
const EMPTY_ROSTER_DUMMY_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

async function hashPin(pin: string): Promise<string> {
  return bcryptjs.hash(pin, BCRYPT_COST)
}

function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2')
}

function legacySha256(pin: string): string {
  return createHash('sha256').update(pin).digest('hex')
}

async function comparePinAndMaybeUpgrade(
  pin: string,
  storedHash: string | null | undefined,
  staffId: string,
): Promise<boolean> {
  if (!storedHash) return false

  if (isBcryptHash(storedHash)) {
    return bcryptjs.compare(pin, storedHash)
  }

  // Legacy SHA-256 row → verify with constant-equality, then upgrade in place.
  if (legacySha256(pin) !== storedHash) return false

  const upgraded = await hashPin(pin)
  const service  = await createServiceClient()
  await service.from('staff_basic').update({ clock_pin_hash: upgraded }).eq('id', staffId)
  return true
}

// ── Rate limiting (Upstash Redis — works across Vercel serverless instances) ──
//
// Three buckets:
//   - IP+device bucket (5 attempts / 60s) on the verify path — defends against
//     drive-by PIN guessing. Spoofable `x-forwarded-for` was the original
//     source; we now prefer `x-real-ip` / `cf-connecting-ip` (set by the
//     platform, not echoed from the request) and bind a long-lived
//     httpOnly device cookie so a "fresh IP" attacker can't reset the bucket
//     by also rotating the cookie unless they replay it.
//   - Per-staff bucket (10 attempts / 1h) on `assertStaffPin` — even if an
//     attacker rotates IPs, they can't burn more than 10 attempts on any
//     specific staff_id per hour.
//   - VULN-015 per-staff failure counter (5 failures / 15 min, resets on
//     success) on `verifyPin`. The two existing buckets meter every attempt,
//     including legitimate ones; this one only counts *failed* attempts and
//     is cleared after a successful PIN match, so an active employee whose
//     teammate fat-fingered the keypad five times isn't locked out for an
//     hour.
let ratelimit:      Ratelimit | null = null
let staffRatelimit: Ratelimit | null = null

// VULN-015 failure-counter constants.
const PIN_FAILURE_LIMIT  = 5
const PIN_FAILURE_TTL_S  = 15 * 60
const PIN_FAILURE_PREFIX = 'pin'

function getRedisOrNull(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return Redis.fromEnv()
}

// Read-only check — does NOT increment. Used as the pre-attempt gate so we
// don't penalize a caller for the very attempt we're locking them out of.
async function isStaffPinLocked(staffId: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false
  const redis = getRedisOrNull()
  if (!redis) return false
  const key = `${PIN_FAILURE_PREFIX}:${staffId}`
  const count = await redis.get<number>(key)
  return typeof count === 'number' && count >= PIN_FAILURE_LIMIT
}

async function recordStaffPinFailure(staffId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  const redis = getRedisOrNull()
  if (!redis) return
  const key = `${PIN_FAILURE_PREFIX}:${staffId}`
  // INCR then EXPIRE — atomic enough for a counter that loses one bucket per
  // sliding 15-min window. We don't care about EXPIRE racing INCR because the
  // counter will be reset on success and the worst case is a counter that
  // stays in Redis for an extra few hundred ms with TTL.
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, PIN_FAILURE_TTL_S)
  }
}

async function resetStaffPinFailures(staffId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  const redis = getRedisOrNull()
  if (!redis) return
  await redis.del(`${PIN_FAILURE_PREFIX}:${staffId}`)
}

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

function getStaffRatelimit(): Ratelimit | null {
  if (staffRatelimit) return staffRatelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  staffRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '3600 s'),
    prefix:  'clock_pin_staff',
  })
  return staffRatelimit
}

async function getAttemptKey(): Promise<string> {
  const h = await headers()
  // Vercel/Cloudflare set these from the TCP source IP; not echoed from the
  // request. `x-forwarded-for` remains as a last-ditch fallback for non-Vercel
  // hosts but we drop it to the leftmost token only.
  const ip = h.get('x-real-ip')?.trim()
    || h.get('cf-connecting-ip')?.trim()
    || h.get('x-forwarded-for')?.split(',')[0]?.trim()
    || ''

  // Long-lived httpOnly device cookie. New visitors get a fresh UUID; the
  // cookie persists across attempts so even when `ip` falls back to '' the
  // bucket isn't shared across all anonymous attackers.
  const cookieStore = await cookies()
  let deviceId = cookieStore.get('clock_device')?.value
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    deviceId = randomUUID()
    cookieStore.set('clock_device', deviceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   60 * 60 * 24 * 365,
    })
  }

  return `${ip || 'noip'}::${deviceId}`
}

async function checkRateLimit(key: string): Promise<{ allowed: boolean }> {
  // Dev shares 127.0.0.1; the 5/min budget collapses if multiple tabs hit the
  // clock page at once. Production gate keeps the limiter active in prod only.
  if (process.env.NODE_ENV !== 'production') return { allowed: true }
  const rl = getRatelimit()
  if (!rl) return { allowed: true }
  const { success } = await rl.limit(key)
  return { allowed: success }
}

async function checkStaffRateLimit(staffId: string): Promise<{ allowed: boolean }> {
  if (process.env.NODE_ENV !== 'production') return { allowed: true }
  const rl = getStaffRatelimit()
  if (!rl) return { allowed: true }
  const { success } = await rl.limit(`staff:${staffId}`)
  return { allowed: success }
}

async function assertStaffPin(staffId: string, pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false
  // UUID guard: prevents the per-staff bucket key from being filled with junk.
  if (!/^[0-9a-f-]{36}$/i.test(staffId)) return false

  // VULN-015: hard lockout once a staff_id has accumulated 5 wrong PINs in
  // the last 15 minutes. Checked BEFORE the metered hourly bucket so a
  // locked-out caller still consumes a failure (keeps the window from
  // sliding back into "allowed" while the brute-forcer keeps poking).
  if (await isStaffPinLocked(staffId)) {
    await recordStaffPinFailure(staffId)
    return false
  }

  // Per-staff bucket: even an attacker rotating IPs cannot exceed 10 attempts
  // per hour against any single staff_id.
  const { allowed } = await checkStaffRateLimit(staffId)
  if (!allowed) return false

  const service = await createServiceClient()
  const { data } = await service
    .from('staff_basic')
    .select('id, clock_pin_hash, is_active')
    .eq('id', staffId)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) {
    await recordStaffPinFailure(staffId)
    return false
  }
  const row = data as { id: string; clock_pin_hash: string | null; is_active: boolean }
  const ok = await comparePinAndMaybeUpgrade(pin, row.clock_pin_hash, row.id)
  if (ok) {
    await resetStaffPinFailures(staffId)
  } else {
    await recordStaffPinFailure(staffId)
  }
  return ok
}

// ── verifyPin ─────────────────────────────────────────────────────────────────

export async function verifyPin(pin: string): Promise<ClockResult> {
  if (!/^\d{4}$/.test(pin)) return { success: false, error: 'Invalid PIN format' }
  const attemptKey = await getAttemptKey()
  const { allowed } = await checkRateLimit(attemptKey)
  if (!allowed) return { success: false, error: 'Too many attempts. Try again shortly.' }

  const service = await createServiceClient()
  // No SQL-level equality on bcrypt hashes (per-row salts). Pull active staff
  // and compare app-side. Roster ≤ ~50 rows in practice; rate-limit + 4-digit
  // PIN entropy make this acceptable.
  const { data, error } = await service
    .from('staff_basic')
    .select('id, name, role, branch_id, clock_pin_hash')
    .eq('is_active', true)

  if (error || !data) {
    return { success: false, error: 'PIN not found' }
  }

  type Row = { id: string; name: string; role: StaffRole; branch_id: string | null; clock_pin_hash: string | null }
  const rows = data as Row[]

  // VULN-A06: constant-time across the roster. Always evaluate every row so
  // the wall-clock of a successful PIN doesn't leak position-in-roster (or
  // roster size). First match wins; later matches don't overwrite.
  let matched: Row | null = null
  for (const row of rows) {
    const isMatch = await comparePinAndMaybeUpgrade(pin, row.clock_pin_hash, row.id)
    if (isMatch && matched === null) {
      matched = row
    }
  }

  // Empty-roster floor: burn one bcrypt compare so "no active staff" doesn't
  // return in microseconds and become trivially distinguishable from the
  // non-empty path.
  if (rows.length === 0) {
    await bcryptjs.compare(pin, EMPTY_ROSTER_DUMMY_HASH)
  }

  if (!matched) return { success: false, error: 'PIN not found' }

  // VULN-015: post-match staff-scoped failure counter. We can only check it
  // once we know which staff_id this PIN belongs to (the verify endpoint
  // takes only the PIN, not a staff_id). If this specific staff is currently
  // locked out, refuse the match — even if they typed the right code — and
  // increment to keep the window alive. The legitimate user is asked to wait
  // 15 minutes; that's the explicit anti-brute-force trade-off.
  if (await isStaffPinLocked(matched.id)) {
    await recordStaffPinFailure(matched.id)
    return { success: false, error: 'Too many attempts. Try again shortly.' }
  }
  // Clear any in-flight failure window — the legitimate user just succeeded.
  await resetStaffPinFailures(matched.id)

  const { data: openEntry } = await service
    .from('time_entries')
    .select('id')
    .eq('staff_id', matched.id)
    .is('clock_out', null)
    .maybeSingle()

  return {
    success:     true,
    staff:       { id: matched.id, name: matched.name, role: matched.role, branch_id: matched.branch_id },
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

  if (error) return { success: false, error: toSafeError(error) }
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

  if (error) return { success: false, error: toSafeError(error) }
  return { success: true, hoursWorked: totalHours }
}
