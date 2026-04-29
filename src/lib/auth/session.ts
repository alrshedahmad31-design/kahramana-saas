import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/supabase/custom-types'
export { ALLOWED_TRANSITIONS, CAN_CANCEL } from './permissions'

export interface AuthUser {
  id: string
  email: string
  role: StaffRole | null
  branch_id: string | null
  name: string | null
}

// Returns null when there is no valid session
export async function getSession(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) return null

    const { data: staffData } = await supabase
      .from('staff_basic')
      .select('role, branch_id, name')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    const staff = staffData as { role: StaffRole; branch_id: string | null; name: string | null } | null

    return {
      id: user.id,
      email: user.email!,
      role: staff?.role ?? null,
      branch_id: staff?.branch_id ?? null,
      name: staff?.name ?? null,
    }
  } catch {
    return null
  }
}

// Throws a redirect when unauthenticated — use in Server Components / layouts
export async function requireAuth(redirectTo = '/login'): Promise<AuthUser> {
  const user = await getSession()
  if (!user) redirect(redirectTo)
  return user
}

export async function getUserRole(): Promise<StaffRole | null> {
  const user = await getSession()
  return user?.role ?? null
}
