# LAST-SESSION.md — Kahramana Baghdad
> Session 93: BL-004 RLS hardening + Owner Dashboard fixes +
> test-data cleanup
> Date: 2026-05-13
> Author: Claude Code (all work this session; Gemini active in
>         parallel on shifts polish — see OPEN ISSUES)

## SUMMARY
Focused session on closing security audit findings and tightening
operational data quality. Two migrations applied to prod (120, 121),
five commits pushed (`bd4a06e` → `0401eb8`), Owner Dashboard placeholder
metrics improved, 20 test orders + 19 cash-COD payment rows deleted
from prod. Session 92's open hydration question was called resolved by
Ahmed without recurrence.

## COMMITS THIS SESSION
- `bd4a06e` chore(state): reconcile phase-state pointer + session 92
  bookkeeping
- `e9b2a81` fix(security): BL-004 — close high-severity open
  INSERT/SELECT policies (migration 120)
- `a0b351a` fix(owner): improve placeholder metrics — late orders,
  slowest items, acceptance hint
- `1fc4137` chore(dev): add hydration mismatch probe script
- `0401eb8` fix(security): add shape guard to customers anon INSERT
  policy (migration 121)

## MIGRATIONS APPLIED TO PROD

### 120 — `rls_bl004_fix`
Closed 8 high-severity BL-004 findings. Targets:
- `orders` + `order_items` INSERT: anon + authenticated dropped, replaced
  with `service_role` only. Legitimate path is `rpc_create_order`
  (SECURITY DEFINER → bypasses RLS); direct PostgREST inserts could
  forge totals / status / branch, so they're now blocked.
- `inventory_lots` INSERT: authenticated → owner/general_manager/
  branch_manager/inventory_manager via `auth_user_role()::text IN (…)`.
- `supplier_price_history` SELECT + INSERT: same staff set. Closed the
  wholesale-cost leak and the COGS-poisoning vector.
- `prep_items` + `prep_item_ingredients` SELECT: same staff set plus
  `kitchen`. Closed recipe-BOM leak; kitchen role keeps prep access.

Skipped (low severity, audited separately later in session):
`ingredient_allergens`, `restaurant_profile`, `unit_conversions`,
`contact_messages`, `customers`, `system_settings`.

### 121 — `customers_insert_guard`
Replaced `customers_insert_anon WITH CHECK (true)` with shape guard:
- `char_length(name) BETWEEN 1 AND 120`
- `phone ~ '^\+?[0-9\s\-()]{7,30}$'`

NULL `name` or NULL `phone` now reject (intentional side-effect of
char_length / regex on NULL). Legitimate guest checkout is unaffected
because `rpc_create_order` is SECURITY DEFINER.

## FEATURES SHIPPED

### Owner Dashboard placeholder fixes — commit `a0b351a`
Files: `src/components/dashboard/owner/OwnerDashboardClient.tsx`,
`messages/{ar,en}.json`.

- **Late Orders KPI:** confirmed `orders.accepted_at` does not exist
  (information_schema check). Kept the `longestMins > 30` heuristic
  but changed primary value from misleading "1+" to "≥1 · 38m"
  (count + minutes). Red tone unchanged.
- **Slowest items today:** previous `slice(-Math.min(3, length-3))`
  produced ≤2 entries when 5 items were tracked. Now
  `topItems.slice(2, 5)` — ranks 3-5. Label key updated in both
  locales to "Slowest today (tracked items)" / "الأقل حركة اليوم
  (من المتابَعة)".
- **Acceptance Time:** still no `accepted_at` column → primary stays
  `--`, label renamed to "Acceptance Time" / "وقت القبول", hint
  "Not tracked yet" / "غير متوفر".

### Hydration probe — commit `1fc4137`
`scripts/check-hydration.mjs`: Playwright probe that loads /dashboard,
optionally logs in with seeded creds, captures console + pageerror
events. Used this session to confirm no hydration warnings on public
routes (login auth failed for prod, so the inside-dashboard render was
not verified — Ahmed manually confirmed gone).

## DATABASE CLEANUP

### Stale active orders (session 92 carry-over)
- Audited 4 manual orders > 24h old in active statuses.
- Cancelled 3 manual `preparing` orders (test session from 2026-05-08)
  + the 332.300 BHD `accepted` dine-in from 2026-05-11. Notes tagged
  `[stale_test_cleanup 2026-05-13]`.

### Test/dummy order purge
- Audit predicate: `customer_name IN ('احمد','ahmed','test','TEST',
  'دافن','سبيسبيس','Table 1','Table 13','Table 18') OR notes LIKE
  '%stale_test_cleanup%' OR total_bhd = 332.300`.
- Matched 20 orders / 697.600 BHD total, span 2026-05-04 → 2026-05-11.
- First DELETE blocked by `payments_order_id_fkey` (RESTRICT). Found
  via `pg_constraint` audit. **Saved as memory
  `feedback_orders_delete_fks`.**
- Verified 19 payments tied to these orders were all
  `method=cash / status=pending_cod` with zero gateway IDs and zero
  refunds → no real-money trail.
- Two-step CTE delete (`del_payments` → `del_orders`) removed 19
  payments + 20 orders cleanly. CASCADE handled order_items +
  coupon_redemptions + coupon_usages + driver_cash_handover_orders +
  driver_order_issues + kds_queue + order_item_station_status.
  SET NULL applied to driver_locations + points_transactions.

## AUDITS PERFORMED (NO CHANGES)

### BL-004 RLS audit
54 policies matched `qual='true' OR with_check='true'`. Bucketed:
- 31 `service_role`-only — not a finding.
- 8 public-read SELECT — 7 intentional, 1 to verify (`system_settings`).
- 6 authenticated SELECT — 2 high-severity flagged.
- 8 open INSERT — 6 high-severity flagged.
14 actionable; 8 high-severity closed in 120; 1 low-severity closed
in 121; 4 remain (see OPEN ISSUES).

### `system_settings` content audit
Only 2 rows: `menu_display` (5 booleans) and `payment_methods`
(`cash=true, benefit=false, tap=false`). No secrets, no internal
toggles. Public-read policy can stay open. Optionally rename to
`system_settings_public_read` for naming consistency.

## OPEN ISSUES (carry to next session)

### Gemini sibling agent — actively editing Shifts page
Two uncommitted files at session end, **growing diff** (was +37/-19
at first audit, +132/-93 at second):
- `src/app/[locale]/dashboard/shifts/page.tsx`
- `src/components/dashboard/shifts/CloseShiftDialog.tsx`

Pattern matches memory `project_cowork_sibling_agent`: brand-token /
RTL polish (`muted-foreground` → `brand-muted`, `bg-secondary` →
`brand-gold`, `font-cairo` titles, 44px touch targets). No migration
number collision risk so far. Do not commit on Gemini's behalf —
let it finish.

### Remaining BL-004 low-severity (4)
- `contact_messages` anon INSERT (rate-limited but unbounded by policy)
- `ingredient_allergens` authenticated SELECT (reference data)
- `restaurant_profile` authenticated SELECT (internal config)
- `unit_conversions` authenticated SELECT (reference data)
All low-severity; require trade-off calls. No urgency.

### Phase-state pointer
`current_phase: null`, `next_phase: "7b"`. Both 7b and 8 remain
externally blocked (Deliverect contract / 6 months data). Sprint 6B
(WhatsApp API) blocked on Meta verification; Sprint 6C (Benefit Pay)
blocked on merchant approval.

## DECISIONS LOGGED
- **BL-004 fix strategy:** `service_role`-only for high-value INSERTs
  (orders, order_items); `auth_user_role()::text IN (…)` for
  staff-scoped policies. `::text` cast matches existing pattern from
  migration 035 (avoids SQLSTATE 55P04 on staff_role enum).
- **Owner Dashboard placeholders:** keep "--" for Acceptance Time
  instead of inventing a column — honest empty state beats fake
  precision. Confirmed by Ahmed via option (b) in session.
- **Test-data delete vs cancel:** Ahmed chose hard DELETE (not
  cancel+mark) for the broader test-order purge. Payment rows
  reviewed first and confirmed safe to drop (no gateway IDs).
- **Hydration mismatch closure:** Ahmed selected option (c) — call
  resolved without further verification, since manual testing hadn't
  reproduced it.

## MEMORY UPDATES
- New: `feedback_orders_delete_fks` — `DELETE FROM orders` is blocked
  by `payments` (RESTRICT), `driver_earnings` and `inventory_movements`
  (no action). Inventory child tables before any bulk delete.
- Indexed in `MEMORY.md`.

## STATUS
- **TSC:** clean after every commit.
- **Git:** local `master` == `origin/master`. 5 commits pushed today.
- **Migrations:** local 120 + 121 match prod state.
- **Build:** not run this session — no consumer-facing changes that
  warrant a fresh production build (Owner Dashboard is staff-only;
  RLS migrations don't change page output).
