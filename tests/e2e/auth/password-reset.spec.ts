/**
 * password-reset.spec.ts — Password reset + auth/callback error handling
 *
 * IMPLEMENTATION STATUS:
 *   ⚠️  No /forgot-password or /set-password page exists in the app (as of 2026-04-30).
 *   Password reset is not exposed as a UI flow. These tests cover:
 *
 *   A. The /auth/callback route error states (what happens when the link is
 *      expired, missing, or the user has no staff profile).
 *
 *   B. Direct password update via Supabase admin API + re-authentication test.
 *
 *   If a /forgot-password page is added in the future, add tests here for:
 *     - Submit email → success message
 *     - Reset link → navigate to /auth/callback → /dashboard
 *     - Old password no longer works
 */

import { test, expect }                from '@playwright/test'
import { createClient }                from '@supabase/supabase-js'
import type { Database }               from '../../../src/lib/supabase/types'
import {
  SUPABASE_URL, SUPABASE_SERVICE_KEY,
  TEST_USERS, TEST_PASSWORD, E2E_CONFIGURED,
}                                      from '../../fixtures/users'
import { fillLoginForm, submitLoginForm, PATHS } from '../../fixtures/auth-helpers'

test.describe('/auth/callback error handling', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('missing code → redirects to /login?error=missing_code', async ({ page }) => {
    // auth/callback/route.ts line 19: if (!code) redirect('/login?error=missing_code')
    await page.goto('/auth/callback')
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    const url = new URL(page.url())
    expect(url.searchParams.get('error')).toBe('missing_code')
  })

  test('invalid/expired code → redirects to /login with error', async ({ page }) => {
    await page.goto('/auth/callback?code=invalid-code-xyz-123')
    await page.waitForURL(/\/login/, { timeout: 15_000 })

    const url = new URL(page.url())
    // exchangeCodeForSession fails → error param is set
    expect(url.searchParams.has('error')).toBe(true)
  })

  test('/auth/callback with Supabase error param → redirected to /login with error', async ({ page }) => {
    // Supabase passes error + error_description in the query string on failure
    await page.goto('/auth/callback?error=access_denied&error_description=Invalid+link')
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    const url = new URL(page.url())
    // auth/callback.ts line 14: redirect('/login?error=...')
    expect(url.searchParams.has('error')).toBe(true)
  })
})

test.describe('Password update via admin API', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  const NEW_PASSWORD = 'NewPass!2026_temp'

  test.afterAll(async () => {
    // Restore original password regardless of test outcome
    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
    const { data } = await admin.auth.admin.listUsers()
    const user = data?.users.find(u => u.email === TEST_USERS.cashierRiffa.email)
    if (user) {
      await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD })
    }
  })

  test('login with new password succeeds after admin password update', async ({ page }) => {
    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // Find user
    const { data } = await admin.auth.admin.listUsers()
    const authUser = data?.users.find(u => u.email === TEST_USERS.cashierRiffa.email)
    expect(authUser, 'Test cashier must exist in auth').toBeTruthy()

    // Change password
    const { error } = await admin.auth.admin.updateUserById(authUser!.id, {
      password: NEW_PASSWORD,
    })
    expect(error).toBeNull()

    // Login with new password
    await page.goto(PATHS.login)
    await page.waitForLoadState('networkidle')
    await fillLoginForm(page, TEST_USERS.cashierRiffa.email, NEW_PASSWORD)
    await submitLoginForm(page)
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('login with old password fails after password change', async ({ page }) => {
    // After above test, the password is NEW_PASSWORD — old TEST_PASSWORD should fail
    await page.goto(PATHS.login)
    await page.waitForLoadState('networkidle')
    await fillLoginForm(page, TEST_USERS.cashierRiffa.email, TEST_PASSWORD)
    await submitLoginForm(page)

    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible({ timeout: 8_000 })
    await expect(alert).toContainText('بريد إلكتروني أو كلمة مرور غير صحيحة')
  })

  // afterAll restores TEST_PASSWORD so subsequent suites still work
})

test.describe('No /forgot-password page (documented gap)', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('/forgot-password returns 404 or redirects (page not implemented)', async ({ page }) => {
    const response = await page.goto('/forgot-password')
    // Accept either a 404 or a redirect — the page simply does not exist yet
    const status = response?.status() ?? 0
    const isRedirect = page.url().includes('/login') || page.url() === `${process.env.E2E_BASE_URL ?? 'http://localhost:3000'}/`
    expect(status === 404 || isRedirect,
      '/forgot-password should 404 or redirect — if this fails, the page was implemented and tests should be expanded'
    ).toBe(true)
  })
})
