/**
 * Waiter dine-in flow — post migration 091.
 *
 * Codifies steps 1–8 of docs/qa/waiter-table-qa.md. The previous run failed
 * at step 6 with PRICE_MISMATCH because rpc_create_order strict-equality
 * checked size-variant lines. Migration 091 added the size/variant bypass
 * mirroring the modifier bypass in 083.
 *
 * Flow: login as owner → /waiter/table/1?branch=riffa → search "quzi" →
 * VariantPicker → pick size M → confirm → cart shows 2.500 →
 * "أرسل للمطبخ" → success → DB row asserts → cleanup.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loginAs } from '../../fixtures/auth-helpers'
import {
  TEST_USERS,
  E2E_CONFIGURED,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} from '../../fixtures/users'

test.describe('Waiter dine-in @ Riffa Table 1', () => {
  test.skip(!E2E_CONFIGURED, 'Requires .env.test — see tests/README.md')
  test.use({ viewport: { width: 1366, height: 900 } })
  // The flow has a single observable side-effect (a real DB row).
  // Retries would either re-create the row or trip on stale state — disable.
  test.describe.configure({ retries: 0 })

  test('places size-variant order without PRICE_MISMATCH', async ({ page }) => {
    test.setTimeout(90_000)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Floor to whole second to avoid sub-second clock skew vs Postgres NOW()
    const startedAt = new Date(Math.floor(Date.now() / 1000) * 1000 - 5_000).toISOString()

    // Step 1 — login + navigate
    await loginAs(page, TEST_USERS.owner.email, TEST_USERS.owner.password)
    await page.goto('/waiter/table/1?branch=riffa')
    await page.waitForLoadState('networkidle')

    // Page sanity: AR layout + waiter UI rendered
    // Note: "طاولة 1" h1 is `lg:hidden` and the sidebar h2 is `hidden lg:flex`,
    // so visibility depends on viewport. Assert URL + search input is enough.
    const dir = await page.$eval('html', (el) => el.getAttribute('dir'))
    expect(dir).toBe('rtl')
    expect(page.url()).toContain('/waiter/table/1')
    const search = page.locator('input[type="search"]')
    await expect(search).toBeVisible({ timeout: 10_000 })

    // Step 4 — search "quzi" and open VariantPicker
    await search.fill('quzi')
    await page.waitForTimeout(500) // debounce + filter render

    // Click the first item card whose aria-label contains "قوزي" (AR locale)
    const quziCard = page.locator('button[aria-label*="قوزي"]').first()
    await expect(quziCard).toBeVisible({ timeout: 10_000 })
    await quziCard.click()

    // VariantPicker dialog
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Pick size M (button text contains "M" + a price). Scope by hasText
    // to avoid matching the "M" inside any other button on the page.
    const sizeM = dialog.locator('button').filter({ hasText: /^M\s*\d/ }).first()
    await sizeM.click()

    // Total in dialog should reflect M price (2.500)
    await expect(dialog.getByText(/2\.500/).first()).toBeVisible()

    // Confirm
    await dialog.getByRole('button', { name: 'تأكيد' }).click()
    await expect(dialog).toBeHidden({ timeout: 5_000 })

    // Step 5 — cart shows the item with 2.500 total
    await expect(page.getByText(/2\.500/).first()).toBeVisible()

    // Step 6 — submit
    const submit = page.getByRole('button', { name: 'أرسل للمطبخ' })
    await expect(submit).toBeEnabled()
    await submit.click()

    // Critical assertion: NO PRICE_MISMATCH error banner
    // (the bug migration 091 fixes)
    await expect(
      page.locator('text=/PRICE_MISMATCH/i'),
    ).toHaveCount(0, { timeout: 5_000 })

    // Success banner OR navigation back to /waiter (router.push fires 600ms after success)
    await Promise.race([
      page.waitForURL(/\/waiter(\?|$|\/)/, { timeout: 10_000 }).then(() => 'navigated'),
      expect(page.getByText(/تم إرسال الطلب/)).toBeVisible({ timeout: 10_000 }).then(() => 'banner'),
    ])

    // Give the rpc + audit_log + payments inserts a moment to commit
    await page.waitForTimeout(1_500)

    // ── DB verification (steps 6–8) ──────────────────────────────────────────
    // Find the order we just created (newest waiter order at riffa table 1
    // since the test started).
    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('id, branch_id, order_type, source, table_number, total_bhd, status, created_at')
      .eq('branch_id', 'riffa')
      .eq('source', 'waiter')
      .eq('table_number', 1)
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(1)

    expect(ordersErr, 'orders query failed').toBeNull()
    expect(orders, 'no waiter order created').toHaveLength(1)
    const order = orders![0]

    // Step 6: order_type / source / table / total / auto-accept
    expect(order.order_type).toBe('dine_in')
    expect(order.source).toBe('waiter')
    expect(order.table_number).toBe(1)
    expect(Number(order.total_bhd)).toBeCloseTo(2.5, 3)
    // migration 085 auto-accepts waiter orders
    expect(['accepted', 'preparing']).toContain(order.status)

    // order_items row with selected_size = 'M' and unit price = 2.500
    const { data: items, error: itemsErr } = await admin
      .from('order_items')
      .select('menu_item_slug, selected_size, selected_variant, quantity, unit_price_bhd')
      .eq('order_id', order.id)

    expect(itemsErr, 'order_items query failed').toBeNull()
    expect(items, 'no order_items row').toHaveLength(1)
    expect(items![0].selected_size).toBe('M')
    expect(Number(items![0].unit_price_bhd)).toBeCloseTo(2.5, 3)
    expect(items![0].quantity).toBe(1)

    // Step 8 — KDS station rows exist with correct branch (mig 089)
    const { data: kds, error: kdsErr } = await admin
      .from('order_item_station_status')
      .select('order_id, branch_id, station, status')
      .eq('order_id', order.id)

    expect(kdsErr, 'KDS query failed').toBeNull()
    expect(kds!.length).toBeGreaterThan(0)
    expect(kds![0].branch_id).toBe('riffa')

    // ── Cleanup: delete the test order to keep production tidy ──────────────
    // Order matters: child rows first.
    await admin.from('order_item_station_status').delete().eq('order_id', order.id)
    await admin.from('payments').delete().eq('order_id', order.id)
    await admin.from('order_items').delete().eq('order_id', order.id)
    await admin.from('audit_logs').delete().eq('record_id', order.id)
    await admin.from('orders').delete().eq('id', order.id)
  })
})
