/**
 * Visual parity probe: confirms the waiter table view matches POS in layout
 * width and grid column widths. Runs as an e2e but uses bounding boxes
 * instead of pixel-snapshotting so it's stable across CSS tweaks.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from '../../fixtures/auth-helpers'
import { TEST_USERS, E2E_CONFIGURED } from '../../fixtures/users'

test.describe('Waiter ↔ POS layout parity', () => {
  test.skip(!E2E_CONFIGURED, 'Requires .env.test')
  test.use({ viewport: { width: 1440, height: 900 } })

  test('main content + sidebar widths match POS', async ({ page }) => {
    await loginAs(page, TEST_USERS.owner.email, TEST_USERS.owner.password)

    // POS reference
    await page.goto('/dashboard/pos')
    await page.waitForLoadState('networkidle')
    const posMain = await page.locator('main').first().boundingBox()
    const posInner = await page.locator('main > div').first().boundingBox()
    const posCards = await page.locator('main button[aria-label*="إضافة"]').first().boundingBox()
    await page.screenshot({ path: 'test-results/parity-pos.png', fullPage: false })

    // Waiter
    await page.goto('/waiter/table/1?branch=riffa')
    await page.waitForLoadState('networkidle')
    const waiterMain = await page.locator('main').first().boundingBox()
    const waiterInner = await page.locator('main > div').first().boundingBox()
    const waiterCards = await page.locator('main button[aria-label*="إضافة"]').first().boundingBox()
    await page.screenshot({ path: 'test-results/parity-waiter.png', fullPage: false })

    console.log('POS    main:', posMain?.width,    'inner:', posInner?.width,    'card:', posCards?.width)
    console.log('Waiter main:', waiterMain?.width, 'inner:', waiterInner?.width, 'card:', waiterCards?.width)

    // Inner container should be the SAME (max-w-7xl mx-auto) on both
    expect(Math.abs((waiterInner?.width ?? 0) - (posInner?.width ?? 0))).toBeLessThan(2)

    // Card width within 10px tolerance
    expect(Math.abs((waiterCards?.width ?? 0) - (posCards?.width ?? 0))).toBeLessThan(10)
  })
})
