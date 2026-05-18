'use server'

import * as Sentry from '@sentry/nextjs'
import bcryptjs from 'bcryptjs'

import { revalidatePath } from 'next/cache'
import { Ratelimit }      from '@upstash/ratelimit'
import { Redis }          from '@upstash/redis'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import {
  assertCanManageTargetStaff,
  getDashboardGuardErrorMessage,
  requireDashboardSection,
  requireDashboardSession,
} from '@/lib/auth/dashboard-guards'
import { canManageStaff, canDeactivateStaff } from '@/lib/auth/rbac'
import { toSafeError } from '@/lib/utils/safe-error'
import type { StaffRole, StaffBasicRow, EmploymentType } from '@/lib/supabase/custom-types'
import type { Json } from '@/lib/supabase/types'
import { isTrivialPin, PIN_TRIVIAL_ERROR } from '@/lib/staff/pin-validation'

// RPC envelope shared with migration 177 functions.
type StaffRpcEnvelope = { ok: true } | { ok: false; code: string }
function isStaffRpcEnvelope(v: unknown): v is StaffRpcEnvelope {
  return typeof v === 'object' && v !== null && 'ok' in v
}
function staffRpcError(code: string, fallback: string): string {
  switch (code) {
    case 'not_found':               return 'Staff member not found'
    case 'concurrent_change_retry': return 'concurrent_change_retry'
    default:                        return fallback
  }
}

// Unified denial string for resendStaffInvitation — same shape as
// VULN-AUTH-01 in staff/[id]/actions.ts. Prevents staff-ID enumeration via
// the previously-distinct "Staff member not found" / "Insufficient
// permissions" messages.
const INVITE_DENIED = 'Insufficient permissions'

// ── Resend-invitation rate limits (VULN-AUTH-02) ──────────────────────────────
// Two layers, both gated on production (dev shares 127.0.0.1 and the budget
// would collapse — see feedback_rate_limit_node_env_gate memory):
//   1. Per-TARGET cool-down (5 min) — prevents email-bomb pretext against a
//      single staff member regardless of how many callers are involved.
//   2. Per-CALLER quota (10 / hour) — caps total resends a single session can
//      trigger; closes the broad-cast amplification path even if the caller
//      iterates targets.
// Lazy singletons keep the Redis client warm under Fluid Compute.
let inviteTargetRatelimit: Ratelimit | null = null
let inviteCallerRatelimit: Ratelimit | null = null

function getInviteTargetRatelimit(): Ratelimit | null {
  if (inviteTargetRatelimit) return inviteTargetRatelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  inviteTargetRatelimit = new Ratelimit({
    redis:   Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(1, '300 s'),
    prefix:  'resend_invite',
  })
  return inviteTargetRatelimit
}

function getInviteCallerRatelimit(): Ratelimit | null {
  if (inviteCallerRatelimit) return inviteCallerRatelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  inviteCallerRatelimit = new Ratelimit({
    redis:   Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '3600 s'),
    prefix:  'resend_invite_caller',
  })
  return inviteCallerRatelimit
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function revalidateStaff(locale: string) {
  revalidatePath(`/${locale}/dashboard/staff`)
  revalidatePath('/dashboard/staff')
}

// ── createStaff ───────────────────────────────────────────────────────────────

export type CreateStaffInput = {
  name:      string
  email:     string
  password:  string
  role:      StaffRole
  branch_id: string | null
  locale:    string
}

export type ActionResult = { success: true } | { success: false; error: string }

export async function createStaff(input: CreateStaffInput): Promise<ActionResult> {
  let caller
  try {
    caller = await requireDashboardSession()
    assertCanManageTargetStaff(caller, input.role, input.branch_id)
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  const service = await createServiceClient()
  // auth.admin is available at runtime when using the service role key.
  // The @supabase/ssr wrapper doesn't expose the admin type — targeted cast only here.
  type _AuthAdminSimple = {
    createUser: (opts: { email: string; password: string; email_confirm: boolean }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
    deleteUser: (id: string) => Promise<void>
  }
  const authAdmin = (service.auth as unknown as { admin: _AuthAdminSimple }).admin

  // Create the Supabase auth user with the service role (bypasses email verification)
  const { data: authData, error: authError } = await authAdmin.createUser({
    email:         input.email,
    password:      input.password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { success: false, error: authError ? toSafeError(authError) : 'Failed to create auth user' }
  }

  const staffId: string = authData.user.id

  // auth.admin.createUser is JS-side because GoTrue is not callable from
  // a SECURITY DEFINER body. The post-auth DB half (staff_basic INSERT +
  // audit row) runs inside rpc_after_auth_create_staff in one transaction,
  // so audit failure can no longer leave a silent staff_basic row.
  const { data: rpcRaw, error: rpcError } = await service.rpc('rpc_after_auth_create_staff', {
    p_id:        staffId,
    p_name:      input.name.trim(),
    p_role:      input.role,
    p_branch_id: input.branch_id ?? '',
  })

  if (rpcError) {
    await authAdmin.deleteUser(staffId)
    Sentry.captureException(rpcError, { tags: { area: 'staff', action: 'createStaff.rpc' } })
    return { success: false, error: toSafeError(rpcError) }
  }
  const rpc = isStaffRpcEnvelope(rpcRaw) ? rpcRaw : null
  if (!rpc || !rpc.ok) {
    await authAdmin.deleteUser(staffId)
    return { success: false, error: staffRpcError(rpc?.code ?? 'unknown', 'Failed to create staff') }
  }

  await revalidateStaff(input.locale)
  return { success: true }
}

// ── updateStaff ───────────────────────────────────────────────────────────────

export type UpdateStaffInput = {
  id:        string
  name:      string
  role:      StaffRole
  branch_id: string | null
  is_active: boolean
  locale:    string
}

export async function updateStaff(input: UpdateStaffInput): Promise<ActionResult> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  // Fetch current record to run permission checks
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('staff_basic')
    .select('id, role, branch_id, is_active')
    .eq('id', input.id)
    .single()

  if (!current) return { success: false, error: 'Staff member not found' }
  const target = current as Pick<StaffBasicRow, 'id' | 'role' | 'branch_id' | 'is_active'>

  if (!canManageStaff(caller, target)) return { success: false, error: 'Insufficient permissions' }
  try {
    assertCanManageTargetStaff(caller, input.role, input.branch_id)
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  const service = await createServiceClient()
  // rpc_update_staff (migration 177) pins the row via SELECT FOR UPDATE,
  // CAS-checks (role, is_active, branch_id) inside the same transaction
  // as the audit_logs INSERT. Concurrent reassignment surfaces as
  // concurrent_change_retry; the JS-side CAS dance is gone.
  const { data: rpcRaw, error } = await service.rpc('rpc_update_staff', {
    p_id:        input.id,
    p_name:      input.name.trim(),
    p_role:      input.role,
    p_branch_id: input.branch_id ?? '',
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'staff', action: 'updateStaff.rpc' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isStaffRpcEnvelope(rpcRaw) ? rpcRaw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: staffRpcError(rpc?.code ?? 'unknown', 'Update failed') }
  }

  await revalidateStaff(input.locale)
  return { success: true }
}

// ── createStaffFull ───────────────────────────────────────────────────────────

export type CreateStaffFullInput = {
  name:      string
  email:     string
  role:      StaffRole
  branch_id: string | null
  locale:    string
  phone?:                   string
  date_of_birth?:           string | null
  id_number?:               string
  address?:                 string
  hire_date?:               string | null
  employment_type?:         EmploymentType | null
  hourly_rate?:             number | null
  emergency_contact_name?:  string
  emergency_contact_phone?: string
  clock_pin?:               string
  staff_notes?:             string
  profile_photo_url?:       string
}

export type CreateStaffFullResult =
  | { success: true;  staffName: string; staffEmail: string; inviteSent: boolean }
  | { success: false; error: string }

// Type alias for the auth admin subset we use
type AuthAdmin = {
  createUser:         (opts: { email: string; password: string; email_confirm: boolean; user_metadata?: Record<string, unknown> }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
  deleteUser:         (id: string)  => Promise<{ error: { message: string } | null }>
  inviteUserByEmail:  (email: string, opts?: { data?: Record<string, unknown> }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
  getUserById:        (id: string)  => Promise<{ data: { user: { id: string; email?: string } | null }; error: { message: string } | null }>
}

export async function createStaffFull(input: CreateStaffFullInput): Promise<CreateStaffFullResult> {
  let caller
  try {
    caller = await requireDashboardSession()
    assertCanManageTargetStaff(caller, input.role, input.branch_id)
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (input.clock_pin && !/^\d{4}$/.test(input.clock_pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' }
  }

  // VULN-015: reject trivial PIN sequences (1234, 0000, repeats, etc.) at
  // registration time. The 4-digit clock PIN has weak entropy by design; the
  // least we can do is keep staff from picking the most-guessable codes.
  if (input.clock_pin && isTrivialPin(input.clock_pin)) {
    return { success: false, error: PIN_TRIVIAL_ERROR }
  }

  const service = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (service.auth as unknown as { admin: AuthAdmin }).admin

  // Create auth user with a random temp password — the invite email lets staff set their own
  const { data: authData, error: authError } = await authAdmin.createUser({
    email:          input.email,
    password:       `${crypto.randomUUID()}-${Date.now()}`,
    email_confirm:  true,
    user_metadata:  { name: input.name, role: input.role },
  })
  if (authError || !authData.user) {
    return { success: false, error: authError ? toSafeError(authError) : 'Failed to create auth user' }
  }

  const staffId: string = authData.user.id

  // auth.admin.createUser is JS-side (GoTrue not callable from a DEFINER
  // body). The post-auth DB half -- staff_basic INSERT including every
  // profile field + audit row -- runs inside rpc_after_auth_create_staff_full
  // in one transaction. The prior split (basic INSERT then conditional
  // profile UPDATE then 2 audit rows) is collapsed into a single audited
  // write; clock_pin still hashes JS-side because bcryptjs is not in PG.
  const profilePayload: Record<string, string | number | null> = {
    name:      input.name.trim(),
    role:      input.role,
    branch_id: input.branch_id,
  }
  if (input.phone)                   profilePayload.phone                   = input.phone
  if (input.date_of_birth)           profilePayload.date_of_birth           = input.date_of_birth
  if (input.id_number)               profilePayload.id_number               = input.id_number
  if (input.address)                 profilePayload.address                 = input.address
  if (input.profile_photo_url)       profilePayload.profile_photo_url       = input.profile_photo_url
  if (input.hire_date)               profilePayload.hire_date               = input.hire_date
  if (input.employment_type)         profilePayload.employment_type         = input.employment_type
  if (input.hourly_rate != null)     profilePayload.hourly_rate             = input.hourly_rate
  if (input.emergency_contact_name)  profilePayload.emergency_contact_name  = input.emergency_contact_name
  if (input.emergency_contact_phone) profilePayload.emergency_contact_phone = input.emergency_contact_phone
  if (input.clock_pin)               profilePayload.clock_pin_hash          = await bcryptjs.hash(input.clock_pin, 10)
  if (input.staff_notes)             profilePayload.staff_notes             = input.staff_notes

  const { data: rpcRaw, error: rpcError } = await service.rpc('rpc_after_auth_create_staff_full', {
    p_id:      staffId,
    p_payload: profilePayload as unknown as Json,
  })
  if (rpcError) {
    await authAdmin.deleteUser(staffId)
    Sentry.captureException(rpcError, { tags: { area: 'staff', action: 'createStaffFull.rpc' } })
    return { success: false, error: toSafeError(rpcError) }
  }
  const rpc = isStaffRpcEnvelope(rpcRaw) ? rpcRaw : null
  if (!rpc || !rpc.ok) {
    await authAdmin.deleteUser(staffId)
    return { success: false, error: staffRpcError(rpc?.code ?? 'unknown', 'Failed to create staff') }
  }

  // Send invitation email so staff can set their own password (non-fatal if SMTP not configured)
  let inviteSent = false
  try {
    const { error: inviteError } = await authAdmin.inviteUserByEmail(input.email, {
      data: { name: input.name, role: input.role },
    })
    if (inviteError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[createStaffFull] invite email failed:', inviteError.message)
      }
    } else {
      inviteSent = true
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[createStaffFull] invite email exception:', e)
    }
  }

  await revalidateStaff(input.locale)
  return { success: true, staffName: input.name, staffEmail: input.email, inviteSent }
}

// ── resendStaffInvitation ─────────────────────────────────────────────────────

export async function resendStaffInvitation(staffId: string): Promise<ActionResult> {
  // Gate by section — previously this only required ANY active staff
  // session, which let drivers / marketing / support / kitchen / waiter
  // / cashier trigger invite emails and enumerate staff IDs via error-string
  // differential (VULN-AUTH-02).
  let caller
  try {
    caller = await requireDashboardSection('staff')
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  // Per-CALLER quota — 10 invitations / hour. Closes the broadcast path
  // even if the attacker rotates through staff IDs.
  if (process.env.NODE_ENV === 'production') {
    const callerRl = getInviteCallerRatelimit()
    if (callerRl) {
      const { success } = await callerRl.limit(caller.id)
      if (!success) {
        return { success: false, error: 'Too many invitations sent. Try again later.' }
      }
    }
  }

  const service = await createServiceClient()
  const { data: staff, error: staffError } = await service
    .from('staff_basic')
    .select('id, role, branch_id')
    .eq('id', staffId)
    .single()

  if (staffError || !staff) return { success: false, error: INVITE_DENIED }

  const target = staff as Pick<StaffBasicRow, 'id' | 'role' | 'branch_id'>

  // VULN-A05: per-target rate-limit runs BEFORE the permission branch so the
  // wall-clock response for "valid target / cool-down active" matches the
  // response for "valid target / cool-down inactive" — closing the prior
  // latency channel that distinguished real staff IDs from unknown ones for
  // an unauthorized caller.
  // Per-TARGET cool-down — at most one invite every 5 minutes per staff ID,
  // regardless of which (authorized) manager triggered it. Stops the
  // phishing-pretext email-bomb against a specific target.
  if (process.env.NODE_ENV === 'production') {
    const targetRl = getInviteTargetRatelimit()
    if (targetRl) {
      const { success } = await targetRl.limit(staffId)
      if (!success) {
        return { success: false, error: 'An invitation was just sent. Please wait before resending.' }
      }
    }
  }

  if (!canManageStaff(caller, target)) {
    return { success: false, error: INVITE_DENIED }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (service.auth as unknown as { admin: AuthAdmin }).admin

  const { data: userData, error: userError } = await authAdmin.getUserById(staffId)
  if (userError || !userData?.user?.email) {
    return { success: false, error: INVITE_DENIED }
  }

  const { error: inviteError } = await authAdmin.inviteUserByEmail(userData.user.email)
  if (inviteError) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[resendStaffInvitation] invite failed:', inviteError.message)
    }
    return { success: false, error: 'Failed to send invitation' }
  }

  return { success: true }
}

// ── toggleStaffActive ─────────────────────────────────────────────────────────

export async function toggleStaffActive(
  id:       string,
  activate: boolean,
  locale:   string,
): Promise<ActionResult> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = await createClient()
  const { data: current } = await supabase
    .from('staff_basic')
    .select('id, role, branch_id, is_active')
    .eq('id', id)
    .single()

  if (!current) return { success: false, error: 'Staff member not found' }
  const target = current as Pick<StaffBasicRow, 'id' | 'role' | 'branch_id' | 'is_active'>

  if (!activate && !canDeactivateStaff(caller, target)) {
    return { success: false, error: 'Insufficient permissions' }
  }
  if (activate && !canManageStaff(caller, target)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const service = await createServiceClient()
  // rpc_set_staff_active (migration 177) CAS-flips on is_active and writes
  // the audit row in the same transaction.
  const { data: rpcRaw, error } = await service.rpc('rpc_set_staff_active', {
    p_id:             id,
    p_activate:       activate,
    p_expected_state: !activate,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'staff', action: 'toggleStaffActive.rpc' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isStaffRpcEnvelope(rpcRaw) ? rpcRaw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: staffRpcError(rpc?.code ?? 'unknown', 'Toggle failed') }
  }

  await revalidateStaff(locale)
  return { success: true }
}
