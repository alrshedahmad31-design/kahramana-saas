# LAST-SESSION.md — Kahramana Baghdad

> **Session**: 85 (Claude Code track)
> **Date**: 2026-05-10
> **Focus**: Tech-debt close — Supabase types regenerated post-093, all four `as never` casts removed from kds/menu actions, waiter dine-in E2E re-verified against current main (post-094/095 RLS lockdown). Conversation master-notes session-history corrections.

## Session 85 deliverables

### Types regen + cast removal
- **`src/lib/supabase/types.ts`** — regenerated via `npx supabase gen types typescript --linked --schema public`. The `Database["public"]["Enums"]["kds_station"]` union now includes the migration-093 additions (`fryer`, `cold`, `unassigned`) alongside legacy values (`grill | fry | salads | desserts | drinks | packing | shawarma | bakery | appetizer_drinks | main`). Working-tree diff vs the post-089 baseline was minimal because the canonical TS `KDSStation` union in `lib/supabase/custom-types.ts:19` already enumerated the same set.
- **`dashboard/kds/actions.ts:219`** — removed `station as never` cast on `.eq('station', station)` (was the only cast in this file; LAST-SESSION.md from session 84 said "two" but only one was on disk). Removed the 5-line comment block explaining the workaround.
- **`dashboard/menu/actions.ts`** — removed all three casts:
  - line 190 `upsert(allItems as never, …)` → `upsert(allItems, …)` + 3-line comment block
  - line 256 `insert({…} as never)` → `insert({…})` (createMenuItem)
  - line 318 `update({…} as never)` → `update({…})` (updateMenuItem)
- **Verification**: `npx tsc --noEmit` → 0 errors.
- Commits: `6a09f59` (kds + menu upsert + types regen) and `ec9f5e6` (remaining 2 menu casts — committed by Ahmed and pushed).

### E2E re-verification post-094/095
- Ran `npx playwright test tests/e2e/waiter/dine-in.spec.ts --headed` against `http://localhost:3000` on current `master` (post-migration-095 + RLS tighten).
- Result: `1 passed (37.0s)` — actual test 15.3s, plus globalSetup/globalTeardown for 6 e2e users.
- Confirms migrations 094 (KDS RLS role lockdown + canonical-5 trigger CASE + bump_station_order RPC) and 095 (cashier/kitchen removed from orders UPDATE RLS) did not regress the waiter dine-in flow with size+variant pricing (the original PRICE_MISMATCH-bypass scenario from migration 091).

### Conversation notes maintenance
- **`kahramana-conversation-master-notes.md`** — five small corrections committed in `6a09f59`:
  1. Header session label: 82 → 84.
  2. Migration 090 row in the migrations table: ✅ → ⏳ on disk (correctly reflects `phase-state.json:17`, which still lists 090 as pending until the seeder runs).
  3. Session-history table: added rows for sessions 83 and 84.
  4. Session 80 row description corrected to KDS hardening sprint (commit 215d9f1).
  5. Session 79 description set to the commit reference (215d9f1, +671/−110 across 10 files); session 82 description set to "types.ts regen, additive pricing fix (VariantPicker), migration 088 applied, QA checklist (150 items)".
- Note: section-history descriptions for sessions 79/80 and 80/82 are now near-duplicates of each other in the file. Flagged in conversation; not corrected this session — would need a fuller rewrite of the session-by-session table.

### Verification (full session)
- `npx tsc --noEmit` → 0 errors (post-cast-removal, against regenerated types).
- E2E: 1/1 PASS, 15.3s actual / 37.0s with setup/teardown.
- Build: not re-run this session — last green build was session 84 (`540 pages, 0 errors`).

### Decisions / non-obvious notes
- **Cast count reconciliation**: LAST-SESSION.md from session 84 said "two `as never` casts" pending types regen, but listed locations summed to four (`kds/actions.ts:218` + `menu/actions.ts:187/256/318`). All four were workarounds for the same migration-093 enum lag and removable in one pass once types were regenerated.
- **Supabase CLI session login**: `npx supabase gen types typescript --linked` succeeded without an explicit interactive login this session — the local CLI session token was already valid. CLI version 2.98.2.
- **Two-commit cast removal**: `6a09f59` initially missed two of the four cast removals (line 256 + line 318 in `menu/actions.ts`); `ec9f5e6` is the clean follow-up. Working tree is clean and pushed.
- **types.ts diff was empty against committed baseline**: the previous regen (`b8ee91e`, post-089) already captured the post-093 enum additions, suggesting the post-093 types were either regenerated and committed earlier than the casts were removed, or the column types were stable across migrations 089→095. Either way, the current types.ts matches production exactly.

## Carry-overs into next session

**Still blocked on Ahmed**: 13 real email addresses for `scripts/seed-staff.ts:54-79`. Once received, the unchanged sequence is:
1. Paste emails into the script.
2. Apply migration 090 (`090_extend_staff_role_waiter.sql`) via SQL Editor.
3. Register in `schema_migrations` if applied via SQL Editor.
4. `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts` (regen — should add `'waiter'` to `staff_role` enum).
5. `npx tsc --noEmit` — expect 0 errors.
6. `npm run seed:staff:dry` — sanity check.
7. `npm run seed:staff` — invites + inserts.
8. Each invitee opens the magic-link email and lands logged in.
9. Update `.agent/phase-state.json`: move 090 to `applied_db_migrations`; add `production_staff_seeded` flag in `external_dependencies`.

Other open items (no movement this session):
- Refund modal for `code === 'refund_required'` (introduced session 84) — UI still surfaces via existing toast; dedicated modal not yet built.
- Legacy `kds_queue` table — still a candidate for post-launch cleanup. `order_item_station_status` is canonical.
- Pre-launch QA master checklist `docs/qa/pre-launch-checklist.md` — not re-run end-to-end this session.

## Session 84 deliverables

### Migrations (4 new, all applied to git)
- **`092_shift_closing_rls_branch_scope.sql`** — `shift_closings` insert WITH CHECK now enforces `staff_basic.branch_id = shift_closings.branch_id` for branch_manager/cashier (owner/GM unrestricted).
- **`093_kds_station_taxonomy_enum_values.sql`** — adds `'fryer'`, `'cold'`, `'unassigned'` to `kds_station` enum (separate file because PG can't use new enum values in same tx).
- **`094_kds_hardening_and_taxonomy.sql`** — RLS+RPC role lockdown (kitchen/branch_manager/GM/owner only); trigger CASE re-mapped to canonical 5 stations + `ELSE 'unassigned'`; `update_order_item_station_status` gained `p_expected_status` (CONFLICT) + transition graph; new `bump_station_order(p_order_id, p_station)` RPC verifies all-ready before completing; menu_items_sync legacy stations backfilled.
- **`095_orders_update_rls_tighten.sql`** — removed `cashier`/`kitchen` from `orders_update_non_driver_staff` USING+WITH CHECK; their mutations now go through KDS RPCs or service-role server actions only.

### Server actions hardened
- **`dashboard/audit/page.tsx`** — `requireDashboardSection('audit')` guard added (was leaking PII to any same-branch session).
- **`dashboard/shifts/actions.ts`** — full rewrite: Zod schema, `round3()` cash normalization, branch-scope assertion, typed `ShiftActionResult` with discriminant `code` (`forbidden|invalid_input|branch_scope|db_error|conflict|unknown`), `getShiftSummary` returns `{error, expectedCash, orderCount}` shape; `CloseShiftDialog.tsx` updated to read the new error discriminant.
- **`waiter/actions.ts`** — added `'waiter'` to `WAITER_ROLES`; payment + audit_logs inserts now check error and return `warning?: string` for partial-failure surface.
- **`dashboard/pos/actions.ts`** — same payment/audit insert error handling + `warning?: string` field; modifier loader fails closed on query error.
- **`dashboard/promotions/actions.ts`** — `togglePromotion` and `deletePromotion` now look up promotion's `branch_id` and assert non-global-admin caller owns it (also blocks edits to `branch_id IS NULL` global promotions for branch-scoped roles).
- **`dashboard/orders/actions.ts`** — comprehensive rewrite: `requireDashboardSection('orders')` everywhere, UUID validation, explicit field list (no `select('*')`), branch-scope on `getOrderDetails`, `canUpdateOrderStatus(...)` reused inside `updateOrderWithReason` for transition validation, optimistic concurrency via `.eq('status', current)` + `.select('id')` row-count check on both status mutations, refund-aware: `hasCapturedPayment()` blocks `cancelled`/`returned` when `payments.status='completed'` (returns `code: 'refund_required'`); typed `OrderActionErrorCode` union; audit_logs insert error surfaced via `console.error`.
- **`dashboard/orders/[id]/page.tsx`** — `requireDashboardSection('orders')` (was just `getSession + canViewOrder`), branch-scope assertion on fetched order, `notFound()` only on `PGRST116`, `throw` on any other DB error.
- **`components/orders/OrdersClient.tsx`** — new `escapeSearch()` helper escapes ilike wildcards (`%`, `_`, `\`) and strips PostgREST structural chars (`,`, `(`, `)`, `:`, `"`) before interpolation into `.or()`.
- **`driver/actions.ts`** — driver mutations now `role === 'driver'` only (was `driver|branch_manager|GM|owner`); `postDriverLocation` verifies order `assigned_driver_id`/`status='out_for_delivery'`/branch before upsert; `reportDeliveryFailure` requires `status='out_for_delivery'` for ALL callers + concurrency-pinned UPDATE; new `normalizeCashAmount()` helper validates `actualCollected` and `submitCashHandover.actualAmount`; `driverBumpOrder`/`markDriverArrived` now require `order_type='delivery'` defensively.
- **`dashboard/delivery/actions.ts`** — `unassignDriver`, `cancelDeliveryOrder`, `reassignDriver` all gained `ACTIVE_DELIVERY_STATUSES` predicate + `.eq('status', order.status)` + `.select('id')` row-count guard.

### Order_type filter parity (delivery dashboard + driver app)
- **`driver/page.tsx`** — added `.eq('order_type','delivery')` to both `readyQ` and `transitQ` queries.
- **`dashboard/delivery/page.tsx`** — replaced `.neq('order_type','pickup')` with positive `.eq('order_type','delivery')` filter.
- **`components/delivery/DeliveryPageClient.tsx`** — added `.eq('order_type','delivery')` to the realtime refresh query.

### KDS taxonomy alignment (TS layer)
- **`lib/supabase/custom-types.ts:14`** — `KDSStation` union expanded with canonical 5 (`grill | fryer | cold | drinks | desserts | unassigned`); legacy values retained for in-flight rows.
- **`constants/kds.ts`** — `STATION_CONFIG` rewritten with the canonical 5 + `unassigned`; `getStationConfig()` fallback changed from `'main'` to `'unassigned'`. Selector picks up new tiles automatically.
- **`dashboard/kds/actions.ts`** — `updateItemStatus` gained `expectedStatus?: KDSItemStatus` + client-side `ITEM_STATUS_TRANSITIONS` graph for fast-fail; `bumpStationOrder` rewired to call new `bump_station_order` RPC; station-counts query error surfaced via `console.error`.
- **`components/kds/KDSStationOrderCard.tsx:124`** — caller threads `currentStatus` as `expectedStatus`.
- Two `as never` casts at the supabase `.eq()`/`.upsert()`/`.insert()`/`.update()` boundary (`kds/actions.ts:218`, `menu/actions.ts:187/256/318`) — required until generated `Database` types are regenerated against the new enum values.

### UI: payment-warning surface
- **`components/pos/POSClient.tsx`** — `success` state extended with `warning?: string`; new amber banner in success screen when `result.warning` set, bilingual heading "⚠ يلزم تدخّل المدير" / "⚠ Manager resolution required" + server-supplied body; offline-queue catch block now classifies error (only queues on `navigator.onLine === false` or TypeError/network-like errors; auth/perm/server bugs surface as real errors).
- **`app/[locale]/waiter/table/[tableNumber]/WaiterOrderClient.tsx`** — separate `warning` state + amber banner under success.

### i18n cleanup
- Sidebar nav (`DashboardSidebar.tsx:267-285`) — wired `waiter`, `tables`, `promotions` (keys already existed in messages files).
- Replaced raw English/mixed Prep Items + Par Levels labels across 7 files with `الأصناف الجاهزة` / `صنف جاهز` / `مستويات المخزون`.
- Inventory-alerts visible AR text — added `inventory.alerts.{title, severity.*, type.*}` namespace to both messages files; `inventory/page.tsx` now uses `getTranslations` to render alert severity + type instead of raw DB strings.
- `inventory.reports.wasteEscalation` namespace — added missing `title|noPending|awaitingBm|escalatedGm` keys.
- `inventory.recipes.prepItems`/`addPrepItem` — replaced English literals in AR file.
- Delivery dashboard components (`OrderListPanel`, `OrderDetailDrawer`, `DeliveryHeader`, `DriverFleetPanel`) migrated from hardcoded Arabic to `useTranslations('delivery')` with new `delivery` namespace (~70 keys) in both messages files.

### Pre-existing TS error cleanup (Gemini parallel-edits)
At one point Gemini's wide refactor left 56 TS errors. Fixed all in this session:
- Bulk-removed `locale={...}` props passed to ReportHeader/ExportButton/AbcPieChart (those components now use `useLocale()` internally) — then added back where the receiving component still required `locale: string` (AbcUpdateButton, COGSClient, COGSBarChart, ValuationPieChart, VarianceClient, both CustomTooltip components).
- Catering pages: changed `isAr={isAr}` → `locale={locale}` for CateringStatusStepper/CateringOrderForm/CateringIngredientsDrawer.
- `colors.brand.X` → `colors.X` (the design-tokens object is flat) in MenuEngineeringMatrix/PriceHistoryChart/VendorRadarChart.
- `borderSColor` typo → `borderColor`.
- `dead-stock/page.tsx` — added missing `Link` import, removed duplicate `StatCard`/`EmptyReport` imports, added `unit?: string|null` to `DeadStockRow`.
- `expiry/page.tsx` — added `Link` import, imported `ExpiryReportRow` type.
- `valuation/ValuationCharts.tsx` + `waste/WasteCharts.tsx` — `(percent ?? 0) * 100`.
- `WasteEscalationWidget` — removed `isAr` prop pass-through (component uses `useLocale`).
- `SupplierRow` — added missing `address|lead_time_days|payment_terms|min_order_bhd|reliability_pct|notes` (notes optional in 3 places).
- `TransferForm.Ingredient.name_en` → optional with `?.toLowerCase()` chain.
- `ExpiryReportRow.unit?` added as optional.
- ESLint `any` → typed in `expiry/page.tsx:128` and `vendor/VendorRadarChart.tsx:24`.
- `loyalty-actions.ts` — removed `export { DEFAULT_LOYALTY_CONFIG }` (`'use server'` files can only export async functions).
- POS server-component `<select>` — removed no-op `onChange={(_e) => {}}` (Next.js disallows event handlers on RSC native elements; this was the underlying cause of a hydration cascade).

### Verification
- `npx tsc --noEmit` → 0 errors after each P-level + each fix batch.
- `npm run build` → PASS (full route table generated, no ESLint-blocking errors).

### Decisions / non-obvious notes
- **Dev-server stale cache**: when JSON message files are edited mid-session, Next/Turbopack hot-reloads the client bundle but server-side module cache may hold stale parsed JSON, causing transient hydration mismatches (specific symptom: server renders raw key, client renders translation). Restart `npm run dev` to clear. Don't add `setRequestLocale` in nested layouts as a "fix" — that's cargo-cult.
- **Auto-generated `Database` types lag enum migrations**: until `npx supabase gen types typescript` is rerun after migration 093, the new `kds_station` values (fryer/cold/unassigned) require `as never` casts at supabase boundaries. Casts are documented in source.
- **POS/waiter `result.warning`** is the new partial-failure shape: order committed successfully but a non-blocking record (payment row, audit log) failed. UI now shows it as an amber banner; downstream reconciliation should pick these up.
- **Refund-required flow**: `updateOrderStatus`/`updateOrderWithReason` now return `code: 'refund_required'` if `payments.status='completed'`. UI doesn't yet branch on this — currently shown via the existing toast. Future task: open a dedicated refund modal when `code === 'refund_required'`.
- **Migration 095 deployment caution**: any cashier/kitchen client doing direct `supabase.from('orders').update(...)` will start returning empty rowsets after deploy. Verified the KDS RPCs (094) cover the kitchen path and POS server actions cover the cashier path; no remaining direct-update sites in cashier/kitchen client code.
- **Drivers will lose access to dine-in/pickup orders** after fix #3 deploys (positive `order_type='delivery'` filter replaces `.neq('order_type','pickup')`). Acceptable per audit; flag if any branch was relying on drivers seeing those.

## Session 83 deliverables

## Session 83 deliverables

### Tests
- **`tests/e2e/waiter/dine-in.spec.ts`** — codifies steps 1–8 of `docs/qa/waiter-table-qa.md`. Logs in as `e2e-owner`, hits `/waiter/table/1?branch=riffa` (AR locale, desktop viewport), searches `quzi`, picks size M via `VariantPicker`, submits, asserts no PRICE_MISMATCH banner, then verifies `orders` + `order_items` (`selected_size='M'`, `unit_price_bhd=2.500`) + `order_item_station_status` rows via service-role client. Cleans up the test order + all child rows on success.
- **`playwright.config.ts`** — added `dotenv.config({ path: '.env.test' })`, `globalSetup` + `globalTeardown` hooks (previously orphaned but never wired up), env-driven `baseURL`, and a `webServer` block that auto-starts `npm run dev` when `E2E_BASE_URL` is local.
- **`.env.test`** — flipped `E2E_BASE_URL` from `https://kahramana.vercel.app` → `http://localhost:3000` per current debugging default; comment shows how to switch back.

### QA report
- **`docs/qa/waiter-table-qa.md`** — CoWork sibling agent added the retest section (vercel.app, PASS 21.3s); this session's localhost run also passed (11.5s). Steps 6–8 now PASS.

## Verification

```
✓ tests/e2e/waiter/dine-in.spec.ts (1 passed, 11.5s) — local :3000
✓ tests/e2e/waiter/dine-in.spec.ts (1 passed, 21.3s) — vercel.app (CoWork)
```

DB state after run: clean (cleanup deletes the test order + payments + items + audit + station rows).

## Carry-overs from session 82 (still pending — not touched)

**Hard prereq for staff seeding**: Ahmed pastes 13 real email addresses for the roster slots in `scripts/seed-staff.ts:54-79`. See session 82 runbook below for full sequence (apply migration 090 → regen types → tsc → seed:staff:dry → seed:staff → invitees consume magic links).

| # | Role | Branch |
|---|---|---|
| 1 | branch_manager | riffa |
| 2 | branch_manager | qallali |
| 3 | cashier | riffa |
| 4 | cashier | qallali |
| 5 | kitchen | riffa |
| 6 | kitchen | qallali |
| 7 | driver | riffa |
| 8 | driver | qallali |
| 9 | waiter | riffa |
| 10 | waiter | qallali |
| 11 | inventory_manager | riffa |
| 12 | inventory_manager | qallali |
| 13 | marketing | — |

Migration 090 still on disk only; types regen + TSC clean still depend on its apply.

---

# Session 82 — superseded notes below

> **Session**: 82 (Claude Code track)
> **Date**: 2026-05-09
> **Focus**: PRICE_MISMATCH fix for size/variant orders + staff-seeding scaffolding (paused on emails)

## Session deliverables

### Database
- **Migration 091 applied to production** — `091_rpc_price_check_size_variant_aware.sql`. Recreates `rpc_create_order` with the same signature, GRANTS, and behaviour as migration 086, except the `PRICE_MISMATCH` guard now also bypasses lines where `selected_size` or `selected_variant` is set. This was the QA blocker found in step 6 of `docs/qa/waiter-table-qa.md`. Unblocks every flow that uses VariantPicker: customer checkout, POS, QR table, waiter.
- **Migration 090 on disk, NOT yet applied** — `090_extend_staff_role_waiter.sql`. `ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'waiter'`. Apply immediately before running the staff seeder so the waiter rows in `STAFF_ROSTER` succeed.

### Code
- `src/lib/auth/rbac.ts` — added `waiter: 3` to `ROLE_RANK`; added `'waiter'` to assignable lists for owner / GM / branch_manager; added `waiter: []` to `ASSIGNABLE_BY` (waiters cannot manage other staff).
- `src/lib/auth/rbac-ui.ts` — granted `waiter` role access to `waiter` and `tables` sections (kept `cashier` on `waiter` for backward-compat).
- TSC will fail on these edits until 090 is applied + types regenerated. Sequence is documented in the runbook below.

### Scripts
- `scripts/seed-staff.ts` — idempotent seeder using `supabase.auth.admin.inviteUserByEmail()` + `staff_basic` upsert via service role. Skips invite if `auth.users` already has the email; only updates `staff_basic` on drift.
- `package.json` — added `seed:staff` and `seed:staff:dry`.

### Docs
- Pre-launch QA master checklist (`docs/qa/pre-launch-checklist.md`) was authored earlier in the session 80 thread.
- Waiter dine-in QA report (`docs/qa/waiter-table-qa.md`) — steps 1–5 PASS, step 6 FAIL on PRICE_MISMATCH (root-caused + fixed by 091); steps 7–8 SKIP pending step-6 retry.

## Verification gates

- 091 verification SQL provided in conversation: `pg_get_functiondef('rpc_create_order'::regproc::oid) ILIKE '%selected_size%'` should return `t`, and a synthetic `rpc_create_order` call with `selected_size: 'M'` and unit_price ≠ base should return a UUID (not raise).
- Once 091 is verified, re-run waiter QA step 6 → expect order created with `branch_id='riffa'`, `order_type='dine_in'`, `source='waiter'`, `table_number=1`.

## Decisions / non-obvious notes

- **091 trades safety for unblock speed.** A direct `rpc_create_order` caller could spoof `selected_size: "M"` to bypass the price guard, but this matches the trust model already used for modifiers since 083 and is gated by `auth.uid()` / RLS from migration 064. Long-term mitigation = move size/variant prices into DB tables (`menu_item_sizes`, `menu_item_variants`) and recompute server-side in `rpc_create_order`.
- **090 is intentionally on disk only.** Applying it earlier than the seeder run risks landing types/code drift if the session is interrupted. The seeder run is the natural moment to apply 090 + regen types + run TSC + run the seeder, all in one pass.
- **Waiter PWA role gating: `cashier` retained on `waiter` section.** Removing it would break existing cashiers who currently double as waiters. New dedicated waiters get the new `waiter` role.

## Pending — picks up next session

**Hard prerequisite for staff seeding**: Ahmed pastes 13 real email addresses for the roster slots in `scripts/seed-staff.ts:54-79`:

| # | Role | Branch | Slot in script |
|---|---|---|---|
| 1 | branch_manager | riffa | `TODO+bm-riffa@…` |
| 2 | branch_manager | qallali | `TODO+bm-qallali@…` |
| 3 | cashier | riffa | `TODO+cash-riffa@…` |
| 4 | cashier | qallali | `TODO+cash-qallali@…` |
| 5 | kitchen | riffa | `TODO+kit-riffa@…` |
| 6 | kitchen | qallali | `TODO+kit-qallali@…` |
| 7 | driver | riffa | `TODO+drv-riffa@…` |
| 8 | driver | qallali | `TODO+drv-qallali@…` |
| 9 | waiter | riffa | `TODO+wai-riffa@…` |
| 10 | waiter | qallali | `TODO+wai-qallali@…` |
| 11 | inventory_manager | riffa | `TODO+inv-riffa@…` |
| 12 | inventory_manager | qallali | `TODO+inv-qallali@…` |
| 13 | marketing | — | `TODO+marketing@…` |

**Run order when emails arrive:**
1. Replace TODOs in `scripts/seed-staff.ts` with real emails.
2. Apply migration 090 (SQL Editor or `npm run db:migrate:prod`).
3. Register 090 in `schema_migrations` if applied via SQL Editor.
4. `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts`.
5. `npx tsc --noEmit` — expect 0 errors after types regen.
6. `npm run seed:staff:dry` — sanity check.
7. `npm run seed:staff` — invites + inserts. Resend sends magic-link emails.
8. Each invitee opens the email, hits the link, lands logged in. First-login = magic-link auth.
9. Update `.agent/phase-state.json` to mark 090 applied + add a "production_staff_seeded" flag in `external_dependencies`.

## Other carry-overs

- **Waiter QA retest** (steps 6–8 of `docs/qa/waiter-table-qa.md`) — should be re-run by the Playwright agent now that 091 is live, before staff seeding consumes more session time.
- Legacy `kds_queue` table — still a candidate for deletion post-launch. `order_item_station_status` is canonical.
