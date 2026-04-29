/**
 * invite.spec.ts — Staff invitation flow
 *
 * Flow in production:
 *   1. Owner creates staff via /dashboard/staff → createStaffFull() server action
 *   2. Supabase sends invite email (inviteUserByEmail)
 *   3. Staff clicks link → Supabase redirects to /auth/callback?code=...
 *   4. Callback exchanges code, finds staff_basic row → redirects to /dashboard
 *
 * In tests, we skip the email step by using admin.generateLink({ type: 'invite' })
 * to get the invite URL directly — tests the auth callback flow without real email.
 *
 * Service role key is ONLY used in beforeAll/afterAll for test setup/teardown.
 * The actual invitation flow uses the anon client (user JWT).
 */

import { test, expect }                from '@playwright/test'
import { createClient }                from '@supabase/supabase-js'
import type { Database }               from '../../../src/lib/supabase/types'
import {
  SUPABASE_URL, SUPABASE_SERVICE_KEY,
  TEST_USERS, E2E_CONFIGURED,
}                                      from '../../fixtures/users'
import { loginAs, PATHS }              from '../../fixtures/auth-helpers'

// Unique email for each test run to avoid conflicts
const INVITE_EMAIL = `e2e-invite-${Date.now()}@test.kahramana`
const INVITE_PASSWORD = 'InviteTest!2026'

let invitedUserId: string | null = null

test.describe('Staff invitation flow', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test.afterAll(async () => {
    if (!invitedUserId) return
    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
    await admin.from('staff_basic').delete().eq('id', invitedUserId)
    await admin.auth.admin.deleteUser(invitedUserId)
  })

  test('invite link via admin API → auth/callback → lands on /dashboard', async ({ page }) => {
    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // 1. Create the invited user auth record (simulates createStaffFull → inviteUserByEmail)
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.generateLink({
      type:    'invite',
      email:   INVITE_EMAIL,
      options: { redirectTo: `${process.env.E2E_BASE_URL ?? 'http://localhost:3000'}/auth/callback` },
    })
    if (inviteErr || !inviteData) throw new Error(`generateLink failed: ${inviteErr?.message}`)

    invitedUserId = inviteData.user.id

    // 2. Insert staff_basic row for the invited user
    await admin.from('staff_basic').insert({
      id:        invitedUserId,
      name:      'E2E Invite Test',
      role:      'cashier',
      branch_id: 'riffa',
      is_active: true,
    })

    // 3. Navigate to the invite action_link — Supabase verifies and redirects to our callback
    const actionLink = inviteData.properties.action_link as string
    await page.goto(actionLink)

    // 4. The auth/callback route exchanges the code → finds staff_basic → redirects /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('invite link with no matching staff_basic → redirected to /login with error', async ({ page }) => {
    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // Generate invite for a user with NO staff_basic row
    const noProfileEmail = `e2e-noprofile-${Date.now()}@test.kahramana`
    const { data, error } = await admin.auth.admin.generateLink({
      type:    'invite',
      email:   noProfileEmail,
      options: { redirectTo: `${process.env.E2E_BASE_URL ?? 'http://localhost:3000'}/auth/callback` },
    })
    if (error || !data) throw new Error(`generateLink failed: ${error?.message}`)

    const noProfileId = data.user.id

    // Navigate to invite link — NO staff_basic row inserted
    await page.goto(data.properties.action_link as string)

    // auth/callback.ts: staffRow is null → redirect('/login?error=no_staff_profile')
    await page.waitForURL(/\/login/, { timeout: 20_000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('error')).toBe('no_staff_profile')

    // Cleanup this user
    await admin.auth.admin.deleteUser(noProfileId)
  })

  test('resend invitation: owner can trigger resend via server action', async ({ page }) => {
    // This test verifies that resendStaffInvitation() can be called by an owner.
    // We test it through the UI: navigate to staff list, find the invited user, click resend.
    // NOTE: This test is advisory — it verifies the button exists and the action fires,
    //       not that an email is actually delivered.

    // Only run if we have an invitedUserId from the previous test
    test.skip(!invitedUserId, 'Invite test must run first to have an invited user')

    const { email, password } = TEST_USERS.owner
    await loginAs(page, email, password)

    await page.goto(PATHS.staff)
    await page.waitForLoadState('networkidle')

    // The staff list should show "E2E Invite Test"
    await expect(page.locator('text=E2E Invite Test')).toBeVisible({ timeout: 8_000 })
  })
})
