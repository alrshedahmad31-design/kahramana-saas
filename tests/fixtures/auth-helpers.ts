/**
 * Shared page-object helpers for auth E2E tests.
 * All selectors are derived from the actual LoginForm.tsx / DashboardSidebar.tsx source.
 */

import { type Page, expect } from '@playwright/test'
import { BASE_URL }           from './users'

// ── Login helpers ─────────────────────────────────────────────────────────────

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('#email',    email)
  await page.fill('#password', password)
}

export async function submitLoginForm(page: Page) {
  // Submit button is a CinematicButton with type="submit"
  await page.click('button[type="submit"]')
}

/**
 * Full login flow: navigate → fill → submit → wait for dashboard.
 * Uses waitForURL instead of arbitrary timeouts.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await fillLoginForm(page, email, password)
  await submitLoginForm(page)

  // Next.js router.push('/dashboard') + router.refresh() — wait for URL change
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}

/**
 * Click the sidebar logout button and wait for redirect to /login.
 */
export async function logout(page: Page) {
  // The logout button contains the AR text "تسجيل الخروج"
  // Fallback: English "Sign Out"
  const logoutBtn = page.getByRole('button', { name: /تسجيل الخروج|Sign Out/i })
  await logoutBtn.click()
  await page.waitForURL(/\/login/, { timeout: 10_000 })
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all Supabase auth cookies (sb-*-auth-token or chunked sb-*-auth-token.N).
 * With @supabase/ssr 0.10.2 the session is stored as a single combined cookie
 * (or chunked for large JWTs).
 */
export async function getAuthCookies(page: Page) {
  const all = await page.context().cookies()
  return all.filter(c => c.name.startsWith('sb-') && c.name.includes('auth-token'))
}

export async function expectAuthCookiesPresent(page: Page) {
  const cookies = await getAuthCookies(page)
  expect(cookies.length, 'Supabase auth cookies should be set after login').toBeGreaterThan(0)
}

export async function expectAuthCookiesCleared(page: Page) {
  const cookies = await getAuthCookies(page)
  expect(cookies.length, 'Supabase auth cookies should be cleared after logout').toBe(0)
}

// ── URL helpers ───────────────────────────────────────────────────────────────

export const PATHS = {
  login:           '/login',
  dashboard:       '/dashboard',
  orders:          '/dashboard/orders',
  staff:           '/dashboard/staff',
  schedule:        '/dashboard/schedule',
  settings:        '/dashboard/settings',
  kds:             '/dashboard/kds',
  driver:          '/driver',
} as const

export function fullUrl(path: string) {
  return `${BASE_URL}${path}`
}
