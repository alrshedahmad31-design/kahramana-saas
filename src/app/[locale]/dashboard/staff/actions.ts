'use server'

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
import type { StaffRole, StaffBasicRow, EmploymentType, TablesUpdate, Json } from '@/lib/supabase/custom-types'
import { isTrivialPin, PIN_TRIVIAL_ERROR } from '@/lib/staff/pin-validation'

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

function auditPayload(
  userId: string,
  role: StaffRole,
  branchId: string | null,
  table: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string,
  changes: Json,
) {
  return {
    table_name: table,
    action,
    user_id:    userId,
    record_id:  recordId,
    changes,
    branch_id:  branchId,
    actor_role: role,
  }
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

  const { error: insertError } = await service.from('staff_basic').insert({
    id:        staffId,
    name:      input.name.trim(),
    role:      input.role,
    branch_id: input.branch_id,
    is_active: true,
  })

  if (insertError) {
    await authAdmin.deleteUser(staffId)
    return { success: false, error: toSafeError(insertError) }
  }

  await service.from('audit_logs').insert(
    auditPayload(caller.id, caller.role!, caller.branch_id, 'staff_basic', 'INSERT', staffId, {
      name: input.name, role: input.role, branch_id: input.branch_id,
    }),
  )

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
  // CAS: pin to the row state we just permission-checked. A concurrent role
  // or branch reassignment will flip these columns and the update returns no
  // rows — we bail with a retryable error rather than silently overwriting.
  let q = service
    .from('staff_basic')
    .update({ name: input.name.trim(), role: input.role, branch_id: input.branch_id })
    .eq('id', input.id)
    .eq('role', target.role)
    .eq('is_active', target.is_active)
  q = target.branch_id == null ? q.is('branch_id', null) : q.eq('branch_id', target.branch_id)
  const { data: updated, error } = await q.select('id')

  if (error) return { success: false, error: toSafeError(error) }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'concurrent_change_retry' }
  }

  await service.from('audit_logs').insert(
    auditPayload(caller.id, caller.role!, caller.branch_id, 'staff_basic', 'UPDATE', input.id, {
      name: input.name, role: input.role, branch_id: input.branch_id,
    }),
  )

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

  const { error: insertError } = await service.from('staff_basic').insert({
    id: staffId, name: input.name.trim(), role: input.role,
    branch_id: input.branch_id, is_active: true,
  })
  if (insertError) {
    await authAdmin.deleteUser(staffId)
    return { success: false, error: toSafeError(insertError) }
  }

  const profile: TablesUpdate<'staff_basic'> = {}
  if (input.phone)                   profile.phone                   = input.phone
  if (input.date_of_birth)           profile.date_of_birth           = input.date_of_birth
  if (input.id_number)               profile.id_number               = input.id_number
  if (input.address)                 profile.address                 = input.address
  if (input.profile_photo_url)       profile.profile_photo_url       = input.profile_photo_url
  if (input.hire_date)               profile.hire_date               = input.hire_date
  if (input.employment_type)         profile.employment_type         = input.employment_type
  if (input.hourly_rate != null)     profile.hourly_rate             = input.hourly_rate
  if (input.emergency_contact_name)  profile.emergency_contact_name  = input.emergency_contact_name
  if (input.emergency_contact_phone) profile.emergency_contact_phone = input.emergency_contact_phone
  if (input.clock_pin)               profile.clock_pin_hash          = await bcryptjs.hash(input.clock_pin, 10)
  if (input.staff_notes)             profile.staff_notes             = input.staff_notes

  if (Object.keys(profile).length > 0) {
    await service.from('staff_basic').update(profile).eq('id', staffId)
  }

  await service.from('audit_logs').insert(
    auditPayload(caller.id, caller.role!, caller.branch_id, 'staff_basic', 'INSERT', staffId, {
      name: input.name, role: input.role, branch_id: input.branch_id,
    }),
  )

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
  // CAS: refuse to flip if another request already changed is_active in the
  // moment between our read (permission check) and write.
  const { data: updated, error } = await service
    .from('staff_basic')
    .update({ is_active: activate })
    .eq('id', id)
    .eq('is_active', !activate)
    .select('id')

  if (error) return { success: false, error: toSafeError(error) }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'concurrent_change_retry' }
  }

  await service.from('audit_logs').insert(
    auditPayload(caller.id, caller.role!, caller.branch_id, 'staff_basic', 'UPDATE', id, {
      is_active: activate,
    }),
  )

  await revalidateStaff(locale)
  return { success: true }
}
