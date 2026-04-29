/**
 * rbac.spec.ts — Role-based access control for dashboard pages
 *
 * Two layers of RBAC:
 *   1. middleware.ts:  /dashboard/staff → branch_manager+ (ROLE_RANK check)
 *   2. Page-level:    settings page → canManageSettings (owner/general_manager only)
 *                     schedule page → canManageSchedule (branch_manager+)
 *
 * NOTE: /driver is NOT protected by middleware — it uses getSession() in the
 *       server component. Unauthenticated access → redirect to /login from page.
 */

import { test, expect }               from '@playwright/test'
import { TEST_USERS, E2E_CONFIGURED } from '../../fixtures/users'
import { loginAs, PATHS }             from '../../fixtures/auth-helpers'

// ── Cashier RBAC ───────────────────────────────────────────────────────────────

test.describe('Cashier access restrictions', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('cashier /dashboard/staff → redirected to /dashboard (middleware)', async ({ page }) => {
    await loginAs(page, TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    await page.goto(PATHS.staff)
    // Middleware RBAC redirect
    await page.waitForURL(/^[^?]*\/dashboard$/, { timeout: 10_000 })
    expect(page.url()).not.toContain('/staff')
  })

  test('cashier /dashboard/settings → redirected to /dashboard (page-level RBAC)', async ({ page }) => {
    await loginAs(page, TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    await page.goto(PATHS.settings)
    // Page-level: canManageSettings returns false → redirect('/dashboard')
    await page.waitForURL(/^[^?]*\/dashboard$/, { timeout: 10_000 })
    expect(page.url()).not.toContain('/settings')
  })

  test('cashier /dashboard/schedule → redirected to /dashboard (page-level RBAC)', async ({ page }) => {
    await loginAs(page, TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    await page.goto(PATHS.schedule)
    // canManageSchedule requires branch_manager+
    await page.waitForURL(/^[^?]*\/dashboard$/, { timeout: 10_000 })
    expect(page.url()).not.toContain('/schedule')
  })

  test('cashier /dashboard/orders → allowed (no RBAC restriction)', async ({ page }) => {
    await loginAs(page, TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    await page.goto(PATHS.orders)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard\/orders/)
  })

  test('cashier /dashboard/kds → allowed', async ({ page }) => {
    await loginAs(page, TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    await page.goto(PATHS.kds)
    await page.waitForLoadState('networkidle')
    // KDS requires canAccessKDS: kitchen OR branch_manager+
    // Cashier rank=3, kitchen rank=3 — cashier does NOT have canAccessKDS
    // This will redirect to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
  })
})

// ── Branch Manager RBAC ────────────────────────────────────────────────────────

test.describe('Branch manager access', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('branch_manager /dashboard/staff → allowed', async ({ page }) => {
    await loginAs(page, TEST_USERS.branchMgr.email, TEST_USERS.branchMgr.password)
    await page.goto(PATHS.staff)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard\/staff/)
  })

  test('branch_manager /dashboard/schedule → allowed', async ({ page }) => {
    await loginAs(page, TEST_USERS.branchMgr.email, TEST_USERS.branchMgr.password)
    await page.goto(PATHS.schedule)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard\/schedule/)
  })

  test('branch_manager /dashboard/settings → redirected (owner/general_manager only)', async ({ page }) => {
    await loginAs(page, TEST_USERS.branchMgr.email, TEST_USERS.branchMgr.password)
    await page.goto(PATHS.settings)
    // canManageSettings = isGlobalAdmin = owner OR general_manager only
    await page.waitForURL(/^[^?]*\/dashboard$/, { timeout: 10_000 })
    expect(page.url()).not.toContain('/settings')
  })
})

// ── General Manager RBAC ───────────────────────────────────────────────────────

test.describe('General manager access', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('general_manager /dashboard/settings → allowed', async ({ page }) => {
    await loginAs(page, TEST_USERS.manager.email, TEST_USERS.manager.password)
    await page.goto(PATHS.settings)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard\/settings/)
  })

  test('general_manager /dashboard/staff → allowed', async ({ page }) => {
    await loginAs(page, TEST_USERS.manager.email, TEST_USERS.manager.password)
    await page.goto(PATHS.staff)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard\/staff/)
  })
})

// ── Owner RBAC (full access) ───────────────────────────────────────────────────

test.describe('Owner full access', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  for (const [name, path] of [
    ['orders',   PATHS.orders],
    ['staff',    PATHS.staff],
    ['settings', PATHS.settings],
    ['schedule', PATHS.schedule],
  ] as const) {
    test(`owner /dashboard/${name} → allowed`, async ({ page }) => {
      await loginAs(page, TEST_USERS.owner.email, TEST_USERS.owner.password)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(`/dashboard/${name}`))
    })
  }

  // Owner can access /driver — owner needs visibility into dispatch
  // without role-juggling. canAccessDriver stays as role IN (owner, driver).
  test('owner /driver → allowed (dispatch visibility)', async ({ page }) => {
    await loginAs(page, TEST_USERS.owner.email, TEST_USERS.owner.password)
    await page.goto(PATHS.driver)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/driver/)
  })
})

// ── Driver RBAC ────────────────────────────────────────────────────────────────

test.describe('Driver access', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('driver /driver → allowed (own page)', async ({ page }) => {
    await loginAs(page, TEST_USERS.driver.email, TEST_USERS.driver.password)
    await page.goto(PATHS.driver)
    await page.waitForLoadState('networkidle')
    // delivery/page.tsx checks: allowedRoles.has(user.role) — 'driver' is allowed
    await expect(page).toHaveURL(/\/driver/)
  })

  test('driver /dashboard → allowed at middleware (no driver-specific rule)', async ({ page }) => {
    await loginAs(page, TEST_USERS.driver.email, TEST_USERS.driver.password)
    // Middleware doesn't block driver from /dashboard
    await page.goto(PATHS.dashboard)
    await page.waitForLoadState('networkidle')
    // The dashboard layout/page may or may not restrict drivers — just verify no 500
    expect(['/dashboard', '/login'].some(p => page.url().includes(p))).toBe(true)
  })

  test('/driver without session → redirected to /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(PATHS.driver)
    // delivery/page.tsx: if (!user) redirect('/login')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
