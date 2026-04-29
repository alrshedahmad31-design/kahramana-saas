/**
 * login.spec.ts — Email/password login flow
 *
 * Covers: valid credentials, invalid credentials (error text in Arabic),
 * cookie presence after login, session persistence on hard refresh,
 * session shared across tabs.
 */

import { test, expect }                from '@playwright/test'
import { TEST_USERS, E2E_CONFIGURED }  from '../../fixtures/users'
import {
  loginAs, fillLoginForm, submitLoginForm,
  expectAuthCookiesPresent, expectAuthCookiesCleared,
  PATHS,
} from '../../fixtures/auth-helpers'

test.describe('Login flow', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  // ── Valid credentials ──────────────────────────────────────────────────────

  test('valid credentials redirect to /dashboard', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Supabase auth cookies are set after successful login', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)
    await expectAuthCookiesPresent(page)
  })

  test('hard refresh on /dashboard does not end session', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    // Hard reload (bypasses Next.js client-side cache)
    await page.reload({ waitUntil: 'networkidle' })

    // Should still be on dashboard — middleware refresh token keeps session alive
    await expect(page).toHaveURL(/\/dashboard/)
    // Dashboard heading present
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('session is shared across same-origin tabs', async ({ page, context }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    // Open a second tab in the same browser context (shared cookies)
    const tab2 = await context.newPage()
    await tab2.goto(PATHS.dashboard)
    await tab2.waitForLoadState('networkidle')

    // Second tab should land on dashboard directly (not redirected to /login)
    await expect(tab2).toHaveURL(/\/dashboard/)
    await tab2.close()
  })

  // ── Invalid credentials ────────────────────────────────────────────────────

  test('wrong password shows Arabic error message', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.waitForLoadState('networkidle')

    await fillLoginForm(page, TEST_USERS.cashierRiffa.email, 'wrong-password-xyz')
    await submitLoginForm(page)

    // LoginForm.tsx sets error via t('loginError') → role="alert" element
    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible({ timeout: 8_000 })
    await expect(alert).toContainText('بريد إلكتروني أو كلمة مرور غير صحيحة')

    // URL must NOT change — stay on /login
    await expect(page).toHaveURL(/\/login/)
  })

  test('non-existent email shows error message', async ({ page }) => {
    await page.goto(PATHS.login)
    await page.waitForLoadState('networkidle')

    await fillLoginForm(page, 'nobody@does.not.exist.example', TEST_USERS.cashierRiffa.password)
    await submitLoginForm(page)

    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible({ timeout: 8_000 })
    await expect(alert).toContainText('بريد إلكتروني أو كلمة مرور غير صحيحة')
    await expect(page).toHaveURL(/\/login/)
  })

  test('empty form submit does not trigger API call', async ({ page }) => {
    await page.goto(PATHS.login)

    // The submit button is disabled when email/password are empty (LoginForm.tsx line 119)
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()
  })

  // ── /login page while authenticated ───────────────────────────────────────

  test('visiting /login while already authenticated redirects to /dashboard', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa

    // First login normally
    await loginAs(page, email, password)

    // Navigate back to /login — middleware should redirect to /dashboard
    await page.goto(PATHS.login)
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
