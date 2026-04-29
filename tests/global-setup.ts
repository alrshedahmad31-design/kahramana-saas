/**
 * Playwright global setup — runs once before all tests.
 * Creates E2E test users in Supabase (idempotent).
 *
 * Uses the SERVICE ROLE KEY only here — not in any test spec.
 * Safe to re-run: upserts on conflict.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, TEST_PASSWORD, TEST_USERS, E2E_CONFIGURED } from './fixtures/users'

type StaffInsert = Database['public']['Tables']['staff_basic']['Insert']

export default async function globalSetup() {
  if (!E2E_CONFIGURED) {
    console.warn('[E2E setup] env vars missing — skipping test user creation')
    return
  }

  const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const user of Object.values(TEST_USERS)) {
    // 1. Look up existing auth user by email
    const { data: existing } = await admin.auth.admin.listUsers()
    const existingUser = existing?.users.find(u => u.email === user.email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      // Ensure password is set to test password (may have changed)
      await admin.auth.admin.updateUserById(userId, {
        password:      TEST_PASSWORD,
        email_confirm: true,
      })
    } else {
      // Create new auth user with confirmed email
      const { data, error } = await admin.auth.admin.createUser({
        email:         user.email,
        password:      TEST_PASSWORD,
        email_confirm: true,
      })
      if (error) {
        throw new Error(`[E2E setup] createUser(${user.email}) failed: ${error.message}`)
      }
      userId = data.user.id
    }

    // 2. Upsert staff_basic row (idempotent via id conflict)
    const staffRow: StaffInsert = {
      id:        userId,
      name:      user.name,
      role:      user.role as Database['public']['Enums']['staff_role'],
      branch_id: user.branchId,
      is_active: true,
    }

    const { error: staffError } = await admin
      .from('staff_basic')
      .upsert(staffRow, { onConflict: 'id' })

    if (staffError) {
      throw new Error(`[E2E setup] staff upsert(${user.email}) failed: ${staffError.message}`)
    }

    console.log(`[E2E setup] ✓ ${user.email} (${user.role})`)
  }

  console.log('[E2E setup] All test users ready.')
}
