/**
 * logout.spec.ts — Logout flow
 *
 * Covers: logout button redirects to /login, cookies cleared,
 * back-button after logout doesn't restore dashboard session.
 */

import { test, expect }                from '@playwright/test'
import { TEST_USERS, E2E_CONFIGURED }  from '../../fixtures/users'
import {
  loginAs, logout,
  expectAuthCookiesPresent, expectAuthCookiesCleared,
  PATHS,
} from '../../fixtures/auth-helpers'

test.describe('Logout flow', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('clicking logout redirects to /login', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    // Verify we are on dashboard before logout
    await expect(page).toHaveURL(/\/dashboard/)

    await logout(page)
    await expect(page).toHaveURL(/\/login/)
  })

  test('auth cookies are cleared after logout', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)
    await expectAuthCookiesPresent(page)

    await logout(page)
    await expectAuthCookiesCleared(page)
  })

  test('back button after logout does not restore dashboard — redirects to /login', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)
    await expect(page).toHaveURL(/\/dashboard/)

    await logout(page)
    await expect(page).toHaveURL(/\/login/)

    // Press browser back
    await page.goBack()

    // Next.js may briefly show the dashboard shell from bfcache,
    // but the middleware will redirect on the next navigation/refresh.
    // We wait for a network-idle state and verify final URL.
    await page.waitForLoadState('networkidle')

    // The middleware's getUser() call confirms no session → redirects to /login
    // If back navigated to /dashboard, a reload triggers the redirect.
    const currentUrl = page.url()
    if (currentUrl.includes('/dashboard')) {
      // Force a full navigation to confirm server-side auth check
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForURL(/\/login/, { timeout: 10_000 })
    }

    await expect(page).toHaveURL(/\/login/)
  })

  test('after logout, direct navigation to /dashboard redirects to /login', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)
    await logout(page)

    // Attempt to navigate directly to dashboard
    await page.goto(PATHS.dashboard)
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    // Middleware appends ?redirect=/dashboard
    expect(page.url()).toContain('/login')
    expect(page.url()).toContain('redirect')
  })
})
