/**
 * middleware.spec.ts — Next.js middleware auth + locale routing
 *
 * Tests derived from src/middleware.ts:
 *   - DASHBOARD_PATTERN:      /^(\/en)?\/dashboard(\/.*)?$/
 *   - LOGIN_PATTERN:          /^(\/en)?\/login$/
 *   - STAFF_ROUTE_PATTERN:    /^(\/en)?\/dashboard\/staff(\/.*)?$/
 *   - Redirect param name:    ?redirect=   (line 55 of middleware.ts)
 *   - Default locale: AR (no prefix), EN prefix: /en/
 */

import { test, expect }               from '@playwright/test'
import { TEST_USERS, E2E_CONFIGURED } from '../../fixtures/users'
import { loginAs, PATHS }             from '../../fixtures/auth-helpers'

test.describe('Middleware — unauthenticated redirects', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('/dashboard without session → redirects to /login with ?redirect= param', async ({ page }) => {
    // Clear all cookies first
    await page.context().clearCookies()

    await page.goto(PATHS.dashboard)
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    const url = new URL(page.url())
    expect(url.pathname).toMatch(/\/login$/)
    // middleware.ts line 55: url.searchParams.set('redirect', redirectTo)
    expect(url.searchParams.get('redirect')).toBe('/dashboard')
  })

  test('/dashboard/orders without session → redirects to /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(PATHS.orders)
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/dashboard/orders')
  })

  test('/dashboard/staff without session → redirects to /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(PATHS.staff)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Middleware — authenticated redirects', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('/login with valid session → redirects to /dashboard', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    // Navigate to /login while authenticated
    await page.goto(PATHS.login)
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('/en/login with valid session → redirects to /en/dashboard', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    await page.goto('/en/login')
    await page.waitForURL(/\/en\/dashboard/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/en\/dashboard/)
  })
})

test.describe('Middleware — locale detection', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('default locale AR: /dashboard has no /en/ prefix', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    // loginAs uses /login (AR) → redirected to /dashboard (no prefix)
    expect(page.url()).not.toContain('/en/')
    await expect(page).toHaveURL(/^[^?]*\/dashboard/)
  })

  test('/en/login → after auth lands on /en/dashboard', async ({ page }) => {
    await page.context().clearCookies()
    const { email, password } = TEST_USERS.cashierRiffa

    await page.goto('/en/login')
    await page.waitForLoadState('networkidle')

    await page.fill('#email',    email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // LoginForm.tsx line 39: locale === 'en' ? '/en/dashboard' : '/dashboard'
    await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/en\/dashboard/)
  })
})

test.describe('Middleware — RBAC (staff route)', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('cashier visiting /dashboard/staff → redirected to /dashboard by middleware', async ({ page }) => {
    const { email, password } = TEST_USERS.cashierRiffa
    await loginAs(page, email, password)

    // Middleware: STAFF_ROUTE_PATTERN + cashier rank < branch_manager → redirect dashboardUrl()
    await page.goto(PATHS.staff)
    await page.waitForURL(/^[^/]*\/\/[^/]+(\/en)?\/dashboard$/, { timeout: 10_000 })

    // Should land on /dashboard (not /dashboard/staff)
    expect(page.url()).not.toContain('/staff')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('branch_manager visiting /dashboard/staff → allowed through middleware', async ({ page }) => {
    const { email, password } = TEST_USERS.branchMgr
    await loginAs(page, email, password)

    await page.goto(PATHS.staff)
    await page.waitForLoadState('networkidle')

    // branch_manager rank >= BRANCH_MANAGER_RANK → middleware passes through
    await expect(page).toHaveURL(/\/dashboard\/staff/)
  })

  test('owner visiting /dashboard/staff → allowed through middleware', async ({ page }) => {
    const { email, password } = TEST_USERS.owner
    await loginAs(page, email, password)

    await page.goto(PATHS.staff)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard\/staff/)
  })
})

test.describe('Middleware — ?redirect= preservation', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('?redirect= param is set when unauthenticated user hits /dashboard/orders', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto(PATHS.orders)
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    const url = new URL(page.url())
    // middleware.ts line 55: url.searchParams.set('redirect', pathname)
    expect(url.searchParams.get('redirect')).toBe('/dashboard/orders')
  })
})
