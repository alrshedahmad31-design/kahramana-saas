'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageStaff, canAssignRole, canDeactivateStaff, ROLE_RANK } from '@/lib/auth/rbac'
import type { StaffRole, StaffBasicRow, EmploymentType } from '@/lib/supabase/types'

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
  changes: Record<string, unknown>,
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
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canAssignRole(caller, input.role)) return { success: false, error: 'Insufficient permissions' }

  const service = await createServiceClient()
  // auth.admin is available at runtime when using the service role key.
  // The @supabase/ssr wrapper doesn't expose the admin type — targeted cast only here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (service.auth as any).admin as {
    createUser: (opts: { email: string; password: string; email_confirm: boolean }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
    deleteUser: (id: string) => Promise<void>
  }

  // Create the Supabase auth user with the service role (bypasses email verification)
  const { data: authData, error: authError } = await authAdmin.createUser({
    email:         input.email,
    password:      input.password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create auth user' }
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
    // Clean up the orphaned auth user
    await authAdmin.deleteUser(staffId)
    return { success: false, error: insertError.message }
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
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }

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
  if (!canAssignRole(caller, input.role)) return { success: false, error: 'Cannot assign that role' }

  const service = await createServiceClient()
  const { error } = await service
    .from('staff_basic')
    .update({ name: input.name.trim(), role: input.role, branch_id: input.branch_id })
    .eq('id', input.id)

  if (error) return { success: false, error: error.message }

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
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canAssignRole(caller, input.role)) return { success: false, error: 'Insufficient permissions' }

  if (input.clock_pin && !/^\d{4}$/.test(input.clock_pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' }
  }

  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (service.auth as any).admin as AuthAdmin

  // Create auth user with a random temp password — the invite email lets staff set their own
  const { data: authData, error: authError } = await authAdmin.createUser({
    email:          input.email,
    password:       `${crypto.randomUUID()}-${Date.now()}`,
    email_confirm:  true,
    user_metadata:  { name: input.name, role: input.role },
  })
  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create auth user' }
  }

  const staffId: string = authData.user.id

  const { error: insertError } = await service.from('staff_basic').insert({
    id: staffId, name: input.name.trim(), role: input.role,
    branch_id: input.branch_id, is_active: true,
  })
  if (insertError) {
    await authAdmin.deleteUser(staffId)
    return { success: false, error: insertError.message }
  }

  const profile: Record<string, unknown> = {}
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
  if (input.clock_pin)               profile.clock_pin               = input.clock_pin
  if (input.staff_notes)             profile.staff_notes             = input.staff_notes

  if (Object.keys(profile).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).from('staff_basic').update(profile).eq('id', staffId)
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
      console.warn('[createStaffFull] invite email failed:', inviteError.message)
    } else {
      inviteSent = true
    }
  } catch (e) {
    console.warn('[createStaffFull] invite email exception:', e)
  }

  await revalidateStaff(input.locale)
  return { success: true, staffName: input.name, staffEmail: input.email, inviteSent }
}

// ── resendStaffInvitation ─────────────────────────────────────────────────────

export async function resendStaffInvitation(staffId: string): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if ((ROLE_RANK[caller.role!] ?? 0) < ROLE_RANK['branch_manager']) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authAdmin = (service.auth as any).admin as AuthAdmin

  const { data: userData, error: userError } = await authAdmin.getUserById(staffId)
  if (userError || !userData?.user?.email) {
    return { success: false, error: 'Could not find email for this staff member' }
  }

  const { error: inviteError } = await authAdmin.inviteUserByEmail(userData.user.email)
  if (inviteError) return { success: false, error: inviteError.message }

  return { success: true }
}

// ── toggleStaffActive ─────────────────────────────────────────────────────────

export async function toggleStaffActive(
  id:       string,
  activate: boolean,
  locale:   string,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }

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
  const { error } = await service
    .from('staff_basic')
    .update({ is_active: activate })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await service.from('audit_logs').insert(
    auditPayload(caller.id, caller.role!, caller.branch_id, 'staff_basic', 'UPDATE', id, {
      is_active: activate,
    }),
  )

  await revalidateStaff(locale)
  return { success: true }
}
