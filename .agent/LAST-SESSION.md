# LAST-SESSION.md — Kahramana Baghdad

> **Session**: 78 (Claude Code track)
> **Date**: 2026-05-09
> **Focus**: Waiter page bug audit + Dashboard/Menu full self-management + DB-first menu architecture

## Session commit
Pending — see git push at end of session.

## What was done

### Migrations applied (085–087)

| # | File | What it does |
|---|---|---|
| 085 | `085_waiter_tables_and_qr_source.sql` | `restaurant_tables` (FK to `branches.id` TEXT) + 40 seeded rows (20 × {riffa, qallali}) + RLS (staff read own branch, branch_manager write own branch) + `orders.table_number INT` + `orders_source_check` CHECK now allows `direct/online/manual/waiter/kiosk/qr` (legacy `direct` kept) + `rpc_create_order` extended with `p_table_number INT`; status CASE auto-`accepted` for `manual/waiter/qr` sources |
| 086 | `086_promotions.sql` | `promotion_type` ENUM (`bogo / bundle / time_discount / item_discount / spend_discount`) + `promotions` table (branch_id NULL = global, JSONB config per type, time window, max_uses cap, atomic use_count) + RLS (owner/GM global writes, branch_manager + marketing branch-only) + `orders.promotion_id UUID` + `orders.promotion_discount_bhd NUMERIC(10,3)` + `rpc_create_order` extended with `p_promotion_id` + `p_promotion_discount_bhd` (validates window/cap, increments use_count atomically) |
| 087 | `087_dine_in_order_type.sql` | `orders.order_type` CHECK now allows `dine_in` alongside `delivery`/`pickup` — required by waiter + QR flows that pass `p_order_type='dine_in'` |

All three applied manually via Supabase SQL Editor on production.

### Feature 1 — Waiter App PWA (`/[locale]/waiter/`)
Staff order-taking at the table from a phone. Auth-gated (cashier/branch_manager/general_manager/owner). branch_manager + cashier get the lightweight `WaiterPWAShell`; owner/GM keep the dashboard sidebar.

- **`/waiter`** — table grid: live occupancy (active-order count + elapsed minutes per table), branch switcher for owner/GM
- **`/waiter/table/[tableNumber]`** — order builder: compact `WaiterMenuBrowser` (h-24 horizontal cards, sticky category bar with smooth-scroll-to-section), reuses `VariantPicker` + `ModifierPicker` from POS, sticky cart bar with always-visible "View Order" + total, drawer with per-line qty/notes + order-level notes + send-to-kitchen button. Client-owned UUID idempotency key (rotated only on success). `createWaiterOrder` server action: zod-validated, server-side price + modifier validation, calls `rpc_create_order` with `p_source='waiter'` + `p_table_number` → straight to `accepted` → KDS picks up via existing trigger
- **`/waiter/orders`** — active orders list, Supabase realtime subscription on `orders` filtered by branch (source filter applied client-side)
- PWA: `public/manifest.json` renamed to "Kahramana Staff", `shortcuts[]` for Driver + Waiter, single `/sw.js` shared

### Feature 2 — QR Table Ordering (`/[locale]/table/[branchId]/[tableNumber]/`)
Customer scans table QR → no auth → places dine-in order → KDS as `source='qr'` (auto-accepted).

- Single-page `QRTableClient` with branch + table banner, compact menu, cart drawer with optional name/phone/notes inputs (cash-only checkout), success view with `/order/[id]` track-link
- `createQROrder` server action: validates branch + table active, modifier prices, server-side price resolution, optional Bahrain phone validation; falls back to `WAITER_PLACEHOLDER_PHONE` sentinel when customer leaves phone blank
- Dashboard QR generator at **`/[locale]/dashboard/tables/`**: per-table 720×720 PNG download via `qrcode` package (already installed), bulk "Download all" sequential generator. QR encodes canonical AR URL `${SITE_URL}/table/${branchId}/${tableNumber}` (no `/ar` prefix because `localePrefix: as-needed`). Brand-toned (`tokens.color.qrInk` / `qrPaper`)
- New `tables` section in `rbac-ui.ts` (owner / GM / branch_manager)

### Feature 3 — Promotion Engine
- **Library** `src/lib/promotions/`:
  - `types.ts` — config schemas + `classifyPromotion()` for tabs
  - `evaluator.ts` — pure framework-agnostic per-type math: BOGO (same-slug → cheapest × floor(qty/2); cross-slug → cheapest × min(buy,get)), Bundle (all slugs present, discount = Σ cheapest unit − bundle price), TimeDiscount (day-of-week + window, overnight 22:00–02:00 supported), ItemDiscount (% off matched lines), SpendDiscount (subtotal ≥ min). `selectBestPromotion()` picks single highest-discount applicable
  - `server.ts` — `resolveBestPromotion(branchId, cart)` fetches active promos + globals, runs evaluator. Errors swallowed — promotion eval never blocks order creation
- **Dashboard** `/[locale]/dashboard/promotions/`:
  - List with status tabs (active / scheduled / expired / inactive / all), toggle/edit/delete with optimistic local updates
  - Modal create/edit form with type-specific fields (BOGO slugs, bundle items+price, time-discount % + day toggles + start/end time, item slug+%, spend min+%) + shared fields (bilingual name, branch lock for non-global admins, datetime-local window, max_uses, is_active)
  - Server actions: `upsertPromotion`, `togglePromotion`, `deletePromotion`. zod-validated, role + branch-scope checked. Only owner/GM can create global (`branch_id=NULL`) promotions; branch_manager + marketing locked to own branch
- **Wired into all 4 order paths**: `checkout/actions.ts`, `dashboard/pos/actions.ts`, `waiter/actions.ts`, `table/actions.ts`. Each calls `resolveBestPromotion()` after server-side priced cart and passes `p_promotion_id` + `p_promotion_discount_bhd` to RPC. Stacking with coupons + loyalty is independent at the RPC level (each subtracts independently from subtotal)

### Build & deploy
- TSC: **0 errors**
- Production build: **540 pages, 0 errors** (PowerShell `$env:NEXT_BUILD_WORKERS=1; npm run build` — Windows local build serialised per `feedback_windows_build_race.md`)
- All RTL/hex/phone violation greps clean across new files

## Issues hit & fixed mid-flight

1. **Hydration mismatch on `/waiter`** — Turbopack HMR cache desync between SSR and client bundles after editing `Header.tsx` and `DashboardSidebar.tsx`. Hardened with CSS-only safety net: added `data-public-header` / `data-public-bottom-nav` attributes + `body:has([data-staff-shell])` rule in `globals.css` that hides them and nullifies root `<main>`'s pt-20/pb-24 padding. JS-level `pathname.includes('/waiter')` check in `Header`, `ConditionalFooter`, `MobileBottomNav` retained as primary mechanism. Restart of dev server resyncs bundles.
2. **"Missing `<html>` and `<body>` tags in the root layout"** — Next.js 15.5 strict check. App-root `not-found.tsx` was rendering through bare `app/layout.tsx` without html/body when `notFound()` bubbled past `[locale]/layout.tsx` (e.g. invalid locale check). Fixed by giving `app/not-found.tsx` its own `<html dir="rtl" lang="ar"><body>` shell.
3. **`localePrefix: 'as-needed'` prefix bug** — initially used `prefix = locale === 'en' ? '/en' : '/ar'` in 5 waiter files; convention is `: ''` for AR. Fixed all router redirects and Link hrefs.
4. **`dine_in` was always mapped to `pickup` in DB** — POS had been doing this since launch because `orders.order_type` CHECK only allowed `delivery`/`pickup`. Created migration 087 to support real `dine_in` so waiter + QR can persist truthfully.
5. **Concurrent agent corruption** — `actions.ts`, `lib/menu.ts`, `rbac-ui.ts`, `dialog.tsx` all had duplicate orphan tail fragments (one with a stray `>` from a half-resolved conflict marker) introduced by a parallel CoWork agent mid-session. All cleaned up; per memory `project_cowork_sibling_agent.md` this is a known risk when CoWork edits the same files in parallel.
6. **`DialogContent` shim didn't accept `dir` prop** — pre-existing issue per memory `feedback_broken_ui_shims.md`. Extended the shim's prop type to accept `dir?: 'rtl' | 'ltr'` and forward to inner content div.

## Decisions made

- **`source` CHECK constraint** kept legacy `'direct'` value alongside the new five (`online/manual/waiter/kiosk/qr`) — existing rows from before 008's `DEFAULT 'direct'` would have failed the check otherwise. No data backfill performed.
- **QR auto-accept** — implemented via `rpc_create_order` `v_status` CASE (`p_source IN ('manual','waiter','qr') → 'accepted'`) rather than a new RPC. Keeps trigger logic intact for `order_item_station_status` insertion.
- **Promotion stacking** — promotion + coupon + loyalty stack independently. Each is capped against the subtotal individually but not against each other. If exclusivity is needed later, the guard goes in the dashboard apply layer rather than the DB.
- **Promotion eval on idempotency-retried orders** — RPC's existing idempotency lookup short-circuits before the new use_count increment, so retries don't double-count promotion uses.
- **`use_count` is increment-only** — no decrement on order cancel/refund. Refund-aware accounting deferred unless requested.
- **WaiterMenuBrowser is a separate component** — not a `compact` prop on `MenuBrowser` so POS keeps its current visual treatment unchanged.
- **All four order paths now go through `resolveBestPromotion()`** — best-effort, swallows errors. Promotion evaluation never blocks order creation.

## What's next

### Untouched / deferred
- **Tap (online card) payment for QR** — spec said "cash only OR tap (if configured)"; shipped cash-only because Tap merchant approval is still deferred per `phase-state.json`. To enable: extend `createQROrder` payment branch + drawer to mirror `payment/[orderId]`.
- **Browser end-to-end test** — none of the new screens have been clicked through in a real browser this session (CLAUDE.md requires this for UI work). Dev server should be smoke-tested: `/dashboard/promotions` create flow → `/waiter/table/1` order → `/table/riffa/1` order → confirm `orders.promotion_id` populates and KDS shows the new orders.
- **Per-branch promotion overrides UI** — branch column exists; admin form already supports it; no special "branch hierarchy" view yet.

### When `Database` types are regenerated
- Replace untyped raw `createSupabaseClient` calls in `waiter/actions.ts`, `table/actions.ts`, `dashboard/promotions/actions.ts`, `dashboard/tables/page.tsx`, `waiter/page.tsx`, and `waiter/table/[tableNumber]/page.tsx` with the typed `createServiceClient` once `restaurant_tables`, `promotions`, and the new RPC params land in the generated `Database` type.

### Strategic note
Sprint shipped two new revenue paths (table dine-in and QR self-service) plus a marketing tool (promotions) that all bypass the public website. The waiter and QR flows specifically address two of the SaaS-readiness gaps from session 76's audit (table-aware POS + customer self-service ordering) — the platform now matches Toast's basic dine-in feature parity for these two paths.
