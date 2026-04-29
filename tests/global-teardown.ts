/**
 * Playwright global teardown — runs once after all tests.
 * Deletes E2E test users from Supabase auth + staff_basic.
 *
 * Uses SERVICE ROLE KEY only here.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, TEST_USERS, E2E_CONFIGURED } from './fixtures/users'

export default async function globalTeardown() {
  if (!E2E_CONFIGURED) return

  const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: allUsers } = await admin.auth.admin.listUsers()

  for (const user of Object.values(TEST_USERS)) {
    const authUser = allUsers?.users.find(u => u.email === user.email)
    if (!authUser) continue

    // Delete staff row first (FK constraint)
    await admin.from('staff_basic').delete().eq('id', authUser.id)

    // Delete auth user
    const { error } = await admin.auth.admin.deleteUser(authUser.id)
    if (error) {
      console.warn(`[E2E teardown] deleteUser(${user.email}) failed: ${error.message}`)
    } else {
      console.log(`[E2E teardown] ✓ deleted ${user.email}`)
    }
  }

  // Also clean up any leftover E2E invite test accounts
  const inviteTestEmails = (allUsers?.users ?? []).filter(
    u => u.email?.startsWith('e2e-invite-') && u.email?.endsWith('@test.kahramana'),
  )
  for (const u of inviteTestEmails) {
    await admin.from('staff_basic').delete().eq('id', u.id)
    await admin.auth.admin.deleteUser(u.id)
  }
}
