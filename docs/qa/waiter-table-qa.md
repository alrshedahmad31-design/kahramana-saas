# Waiter Table QA - Riffa Table 1

Date: 2026-05-09  
Target: `http://localhost:3000/waiter/table/1branch=riffa`  
Browser: Headless Chrome via Playwright, localhost app on port 3000  
User: `e2e-owner@test.kahramana`

## Setup Notes

- Local Playwright browser binary was missing, so QA used installed Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- E2E staff users were created with the repo's idempotent test-user pattern because the initial Supabase login returned HTTP 400.
- Cookie consent was dismissed before the final submit probe.
- Screenshots:
  - `docs/qa/waiter-table-load.png`
  - `docs/qa/waiter-table-cart.png`
  - `docs/qa/waiter-table-submit.png`

## Retest - 2026-05-09

Command:

```powershell
cmd /c npx playwright test tests/e2e/waiter/dine-in.spec.ts
```

Target from `.env.test`: `https://kahramana.vercel.app`

Result: PASS - `1 passed (21.3s)`.

Verified after migration 091:

- Waiter Riffa table 1 page loads in Arabic RTL.
- `قوزي` size picker accepts size `M`.
- Cart/dialog pricing shows `2.500`.
- Submit no longer shows `PRICE_MISMATCH`.
- New order row is created with `branch_id=riffa`, `order_type=dine_in`, `source=waiter`, `table_number=1`.
- Order item row persists `selected_size=M` and `unit_price_bhd=2.500`.
- KDS station rows are created with `branch_id=riffa`.
- The test order and child rows were deleted during teardown cleanup.

## Original Results

| Step | Status | Evidence |
| --- | --- | --- |
| 1. Page load: correct branch, table number, Arabic RTL layout | PASS | Page loaded at exact target URL. Headings showed `طاولة 1` twice. `html dir=rtl`, first app `dir=rtl`. Riffa branch text was not visible in the UI, but Supabase `restaurant_tables` confirmed active `branch_id=riffa`, `table_number=1`. Screenshot: `docs/qa/waiter-table-load.png`. |
| 2. Menu loads: categories, items with prices, out-of-stock handling | PASS | 168 item cards rendered. Category samples included `كل الأقسام`, `مختارات كهرمانة`, `الفطور البغدادي`, `المقبلات الباردة`, `السلطات`. Price samples included `4.000`, `2.600`, `1.500`, `3.200`. No out-of-stock labels were visible in this run. |
| 3. Add item to cart: quantity and price | PASS | Direct-add item succeeded. Cart showed quantity `1` and line amount `3.200`. Screenshot: `docs/qa/waiter-table-cart.png`. |
| 4. Items with variants/sizes: picker and additive pricing | PASS | Searching `quzi` opened `VariantPicker` for `قوزي دجاج بحريني`. Size prices shown: `S 1.900`, `M 2.500`, `L 4.500`; changing to `M` updated total to `2.500 د.ب`, then added to cart. |
| 5. Cart summary: totals and BHD formatting | PASS | Cart showed two items and total `5.700 د.ب`; line and total amounts used 3 decimal places. Screenshot: `docs/qa/waiter-table-cart.png`. |
| 6. Place order: Supabase order fields | FAIL | Clicking `أرسل للمطبخ` did not create an order. Error banner text: `PRICE_MISMATCH: submitted unit_price_bhd does not match menu_items_sync`. No matching new row found with `branch_id=riffa`, `order_type=dine_in`, `source=waiter`, `table_number=1`. Screenshot: `docs/qa/waiter-table-submit.png`. |
| 7. Dashboard confirmation: Riffa branch orders, table number | SKIP | Blocked because step 6 failed and no order ID was created to confirm. |
| 8. KDS confirmation: station routing | SKIP | Blocked because step 6 failed and no order items/station rows were created. |

## Console Notes

- Non-blocking CSP warnings appeared for Google Analytics requests to `https://www.google.com/g/collect`; this did not block Supabase auth or menu browsing.
- The blocking issue for the waiter flow is the server-side `PRICE_MISMATCH` returned during order submission.
