/**
 * Pre-launch smoke suite — fast surface-level check of the 4 critical
 * customer journeys. Use as a go/no-go gate before each release.
 *
 * Scope is intentionally limited to "does the surface render with all
 * required fields and a clickable submit?" — actual form submissions
 * would require Turnstile bypass and would dirty production data.
 * Full happy-path E2E lives in tests/e2e/.
 *
 * Run with: npm run test:smoke
 */

import { test, expect, type Page } from '@playwright/test'

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

// ─── 1. Auth flow ────────────────────────────────────────────────────────────

test.describe('smoke: auth flow', () => {
  test('AR /login renders email + password + submit', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('EN /en/account/login renders customer login form', async ({ page }) => {
    const res = await page.goto('/en/account/login')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('AR /forgot-password reachable with email field', async ({ page }) => {
    const res = await page.goto('/forgot-password')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
  })

  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('login')
  })
})

// ─── 2. Order creation ───────────────────────────────────────────────────────

test.describe('smoke: order creation', () => {
  const ITEM = '/menu/item/grills-kahramana-mix'

  test('AR /menu lists at least 6 category/item links', async ({ page }) => {
    await page.goto('/menu')
    const links = await page.locator('a[href*="/menu/"]').count()
    expect(links).toBeGreaterThan(5)
  })

  test(`AR ${ITEM} shows BHD price + Add-to-Cart`, async ({ page }) => {
    await page.goto(ITEM)
    const body = await page.textContent('body')
    expect(body).toMatch(/\d+\.\d{3}/)        // BHD 3-decimal
    expect(body).toMatch(/د\.ب|BD/)
    await expect(
      page.getByRole('button', { name: /أضف|add to cart/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test(`AR ${ITEM}: clicking Add-to-Cart throws no JS errors`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(ITEM)
    await page.getByRole('button', { name: /أضف|add to cart/i }).first().click()
    await page.waitForTimeout(800)
    expect(errors).toHaveLength(0)
  })
})

// ─── 3. Reservation ──────────────────────────────────────────────────────────

test.describe('smoke: reservation', () => {
  test('AR /reserve renders required fields + submit', async ({ page }) => {
    await page.goto('/reserve')
    await expect(page.locator('input[name="guest_name"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[name="phone"]')).toBeVisible()
    await expect(page.locator('input[name="reserved_date"]')).toBeVisible()
    // Time slots + party size are <button> elements, not inputs — confirm a submit exists
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('AR /reserve initial render has no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/reserve')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(800)
    expect(errors).toHaveLength(0)
  })
})

// ─── 4. Checkout ─────────────────────────────────────────────────────────────

test.describe('smoke: checkout', () => {
  test('AR /checkout reachable + form or empty-cart visible', async ({ page }) => {
    const res = await page.goto('/checkout')
    expect(res?.status()).toBeLessThan(400)
    await page.waitForLoadState('domcontentloaded')
    const inputs   = await page.locator('input').count()
    const emptyMsg = await page.getByText(/سلة فارغة|empty cart|no items/i).count()
    expect(inputs + emptyMsg).toBeGreaterThan(0)
  })

  test('EN /en/checkout reachable', async ({ page }) => {
    const res = await page.goto('/en/checkout')
    expect(res?.status()).toBeLessThan(400)
  })

  test('AR /checkout initial render has no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/checkout')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(800)
    expect(errors).toHaveLength(0)
  })
})
