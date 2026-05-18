# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-18 (session 155 close-out — open-lane sweep: logo/image fallback/KDS trigger alignment/loyalty grid)
# Master: 624c7ed

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational  →  **dev work complete; only operator actions remain**
Next milestone: Soft-launch (cash-only)
Posture: session-155 shipped a 5-item open-lane sweep as 5 commits +
1 close-out. (1) `d77283e` brand asset cleanup — renamed `logoo.webp`
typo to `logo.webp` (added in `f646ab6`, never referenced), restored
the 44630b horizontal `logo-full.webp` that had been clobbered with
the 15286b portrait variant (Header renders it at 526x335), updated
MembershipCard reference. (2) `a9b3962` branded onError fallback in
MenuItemImage — flips to a dark `bg-brand-black` + logo watermark when
next/image fires onError, instead of leaking a broken-image glyph onto
the menu surface; refactored menu-item-card.tsx to use the same
component with `withOverlay={false}` so the card doesn't inherit the
hero's dark gradient. Image audit confirmed 0 missing today
(160/160 DB image_urls + 175/175 menu.json image_urls resolve on
disk) — fallback is preventive UX. (3) `351411f` + migration 183 —
closed the carry-forward KDS station-routing alignment from session
153. Premise correction: prior carry-forward described the gap as
"fryer/drinks/desserts emitted by older triggers," but the real gap
was `fn_kds_enqueue_item`'s `'packing'` fallback for slugs missing
from `menu_items_sync` — `'packing'` isn't in STATION_CONFIG, so 82
historical kds_queue rows had DB column `'packing'` while
getStationConfig() cosmetically remapped them to Unassigned at render
time. Trigger fallback now writes `'unassigned'` directly + UPDATE
backfilled the 82 rows + any other abandoned legacy enum values.
Applied to kahramana-prod via MCP; verified kds_queue distribution
now reads `unassigned/cold/mains/grill` only. (4) `138641e`
`.gitignore` adds `.tmp-screenshots/` (local visual-check scratch).
(5) `624c7ed` loyalty tier benefits panel — replaced the horizontal
snap carousel with a 2-col responsive grid so all four tiers are
visible without horizontal scrolling; header re-flexes to column on
mobile, row on sm+, badge self-aligns at start in stacked layout.
All 9 gates green at HEAD.

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

All remaining work is operator-side. No dev lanes outstanding.

CLOSED post-session-136 (operator-side, no commits):
- ✅ البديع branch row deleted from `branches` table (Supabase SQL Editor).
- ✅ CONTACT_NOTIFY_EMAIL set to asaadaljobory@gmail.com (Vercel env,
  added 2026-05-14).
- ✅ Vercel redeploy of `3a78f76` confirmed Ready (1m 56s build).
- ✅ VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT added to
  Vercel (Production + Preview) and redeploy triggered. Driver push
  notifications are now configured end-to-end.

STILL PENDING:

Infra 🔴
- Supabase Free → Pro + Singapore migration.
- Resend domain verification for kahramanat.com.

Accounts 🔴
- 13 staff emails pending from owner → run staff seed (migration 090).
  After staff lands ⏳: flip NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true.

Payments (merchant-approval blocked) ⏳
- TAP keys (merchant approval) → once arrived, wire Refund Modal
  (refundPayment currently flips DB state only, does NOT call Tap
  to push money back).
- Sprint 6B WhatsApp Business API (Meta verification).
- Sprint 6C Benefit Pay API (CBB approval).

External-contract-locked ⏳
- Phase 7B Deliverect / POS aggregator integration.
- Phase 8 AI assistant + demand forecasting (needs 6 months data).

Assets (operator) 🟡
- ~12 missing dish photos (concrete shoot list in commit `da5b199`).

## ACTIVE DEV PRIORITIES

**Status: empty.** All dev work that is not operator-blocked or
externally locked is complete. The project is production-ready for
soft-launch (cash-only). Note that PUB-007 and PUB-009 — both flagged
as deferred from session 144 in some older bridge revisions — were
already closed earlier today by sessions 148 + 149 (see history below).

Optional next-lane candidates (none queued; fire only on explicit ask):
- (none — session 153's KDS station-routing carry was closed in
  session 155 with a premise correction; see session 155 entry below.)

CLOSED in sessions 137–155 (newest first):

✅ Session 155 — Open-lane sweep: brand assets, dish-image fallback, KDS trigger alignment, loyalty grid (5 commits, d77283e → 624c7ed)
   - `d77283e` fix(brand): rename `logoo.webp` typo → `logo.webp` (added
     in `f646ab6` Driver UI rebuild, never referenced under the typo'd
     name) + restored `logo-full.webp` to its 44630b horizontal mark
     (had been clobbered with the 15286b portrait variant, which
     Header.tsx renders at 526x335). MembershipCard reference updated
     in the same commit since git detected the rename together.
   - `a9b3962` feat(menu): branded onError fallback. MenuItemImage now
     flips to a dark `bg-brand-black` placeholder with a centered logo
     watermark (low opacity, mix-blend-screen) when next/image fires
     onError, instead of leaking a browser broken-image glyph. Added
     optional `withOverlay` prop (default true) so menu-item-card.tsx
     can reuse the component without inheriting the dish-hero gradient.
     Audit context: 160/160 DB image_urls + 175/175 src/data/menu.json
     image_urls resolve on disk right now — this is preventive UX for
     future CDN hiccups or seed-migration typos.
   - `351411f` fix(kds): align trigger fallback with UI taxonomy. The
     prior session-153 carry described the gap as "fryer/drinks/
     desserts emitted by older triggers" — the live audit corrected
     that. The actual live router is `fn_kds_enqueue_item`, which falls
     back to `'packing'` (legacy enum, no STATION_CONFIG entry) when a
     slug is missing from `menu_items_sync`. 82 historical kds_queue
     rows carried `'packing'` while the UI cosmetically aliased them
     to Unassigned via getStationConfig's fallback (kds.ts:49) — the
     DB column and the UI screen disagreed. Migration 183 replaces the
     trigger's fallback with `'unassigned'` and UPDATE-backfills the 82
     `packing` rows + 8 other abandoned legacy values
     (fryer/bakery/appetizer_drinks/main/fry/salads/drinks/desserts)
     so the column matches the screen. Applied to prod via MCP;
     verified kds_queue distribution now reads `unassigned/cold/mains/
     grill` only — no legacy values remain in live data. KDSStation TS
     union keeps the legacy values so historical export data still
     type-checks.
   - `138641e` chore(gitignore): added `.tmp-screenshots/` (Claude Code
     visual-check scratch).
   - `624c7ed` fix(loyalty): tier benefits panel — carousel → grid.
     Replaced `overflow-x-auto snap-x snap-mandatory` horizontal
     carousel with `grid grid-cols-2 gap-3 sm:gap-4` so all four tiers
     are visible without horizontal scrolling. Each card drops the
     carousel sizing (snap-start, min-w/max-w) and gains responsive
     padding (p-4 sm:p-5). Header re-flexes to column on mobile, row
     on sm+; the "current level" badge self-aligns at the start of
     the stacked mobile header.
   - All 9 gates green at HEAD. Migration 183 paired (local + remote).

CLOSED in sessions 137–154 (newest first):

✅ Session 154 — Mobile navbar polish + a11y focus rings (2 commits, 32f4fc5 → 9dc0cf0)
   - `32f4fc5` fix(nav): mobile logo visibility + sheet language-toggle
     hit target. At 375 + 430 px on the top (unscrolled) state, the
     wordmark was dissolving into the dark hero photography behind the
     transparent bar — gold emblem only became readable once the glass
     capsule appeared on scroll. Bumped mobile logo from h-12/max-w-170
     to h-14/max-w-190 and added drop-shadow that fades out when the
     glass capsule takes over (purely a top-state scrim). transition-
     [filter] matches the existing 500ms ease on the bar transition.
     Hamburger sheet's AR/EN toggle now has a real 44x44 hit target
     (min-w-11 h-11) — previously bare text.
   - `9dc0cf0` a11y(nav): focus-visible rings on every interactive
     control in Header. Extracted FOCUS_RING constant
     (focus-visible:ring-2 ring-brand-gold/60 + outline-none) and
     applied to all 18 keyboard-interactive controls: desktop nav
     links (NavItem), home logo links, language toggles, account login
     + dropdown trigger, account-menu items, signout buttons, cart
     buttons, hamburger toggle, mobile sheet links, sheet
     signin/customer/signout rows, and both Reserve CTAs. :focus-visible
     (not :focus) so mouse clicks don't paint the ring. Small rounded-md
     added to text-only controls so the ring renders tidily.
   - Item 3 (PUB-007 reserve RPC SQLSTATE migration) and item 4
     (PUB-009 /order/[id] row type refactor) from the user's open lane
     were no-ops — both were already on master (see sessions 148 + 149).
   - Process note: bridge sync revealed that sessions 146-153 close-outs
     never updated CLAUDE-AI-CONTEXT.md. This file is now the
     consolidated source — sessions 146-150 backfilled into history.
   - All 9 gates green at HEAD. No migrations.

✅ Session 153 — KDS station coverage audit + 2 DB fixes (3 commits, 5d35237 → 9ea3420)
   - Audited the KDS station-routing pipeline end-to-end. Discovered
     the prior memory got the trigger story wrong: the LIVE KDS router
     is `fn_kds_enqueue_item`, a slug-lookup against
     `menu_items_sync.station` with fallback to `'packing'` (which has
     no UI screen and renders as Unassigned). The migration 094
     slug-pattern CASE trigger (`on_order_item_created`) still runs but
     only feeds `order_item_station_status` for the status-grid view,
     not the operator-facing KDS screens.
   - 8 items added by migrations 144 + 180 (7 egg sandwiches +
     turkish-coffee) were missing from `menu_items_sync` entirely — so
     every order containing them was landing in Unassigned at the
     kitchen.
   - `5d35237` migration 181 (cosmetic: UPDATE menu_items.station 'main'
     → 'mains' on 7 rows — that column isn't read by either trigger,
     so this is purely visual). `c3694bf` migration 182 (backfill 8
     missing rows into menu_items_sync: egg sandwiches → 'mains',
     turkish-coffee → 'cold' matching the 13 existing drinks-* rows
     which all use 'cold'). menu_items_sync now has 176 rows =
     menu_items count.
   - Carried to backlog: STATION_CONFIG ↔ trigger-output overlap audit.

✅ Session 152 — Navbar layout iteration (6 commits, b7f73fd → 3b6647c)
   - Drove the centered-logo design through several approaches before
     landing on the proven Nobu/Zuma pattern: single flex row with the
     logo absolutely-positioned at `left-1/2 -translate-x-1/2`.
   - Attempted (and reverted): absolute CTA outside the grid (`b7f73fd`
     — broken: class conflict in CinematicButton's hardcoded
     `inline-flex` collided with `hidden md:inline-flex` and `hidden`
     won the cascade, rendering CTA `display:none` on every viewport);
     symmetric `minmax(0,1fr)` grid with phantom CTA-shaped spacer
     (`7c7bfe3`); flex+absolute reverted (`614658a`); min-w + slim CTA
     padding (`8732cb8`); `justify-end` to pull groupStart close to
     logo (`25e61b6`); finally moved About to groupStart (4 vs
     1+icons+CTA balances naturally, no min-w needed) and bumped
     header to `h-20` unconditional for logo headroom (`3b6647c`).
   - Screenshots at each iteration via Playwright on local dev server
     (/ar + /en at 1440 + 1280 widths). No migrations, no i18n changes.

✅ Session 151 — Navbar redesign + Turkish Coffee seed (3 commits)
   - `a612770` Header.tsx rewrite (luxury restaurant pattern — centered
     logo on `grid-cols-[1fr_auto_1fr]`, split nav groups, premium typo
     with English tracking + uppercase / Arabic untracked, gold-underline
     on active route via `::after`, hover removes underline for
     gold-fade, account icon-only signed-out + signed-in dropdown
     preserved, EN/AR literal toggle, mobile drops calendar icon and
     bumps logo to h-12 max-w-[170px]).
   - `42ef745` migration 180 seeds Turkish Coffee row (applied to
     remote; idempotent).
   - `6aa9d41` adds asset `public/assets/gallery/turkish-coffee.webp`.
   - Note: id `turkish-coffee` does not follow the `drinks-*` prefix
     convention used by the other 3 rows in this category — left as-is
     per user decision; session 153 instead set its station correctly
     in menu_items_sync via migration 182.

✅ Session 150 — Open-lane sweep (5 commits, d958378 → b639a22)
   - `d958378` CI workflows pinned to Node 24 (audit.yml, e2e.yml,
     playwright.yml). engines.node deliberately left at >=20.0.0 as a
     contributor-floor decision.
   - `6e2ea45` dashboard P2 sweep — AUD-V4-011 (fire-and-forget
     audit_logs.insert in 4 sites of delivery/actions.ts now route
     errors through Sentry), AUD-V4-013 (confirmCashHandover CAS via
     .eq('manager_confirmed', false)), AUD-V4-016 (assignDriverToOrder
     client consistency — both reads now use service-role to match
     unassignDriver/cancelDeliveryOrder/confirmDelivery).
   - `b141719` `scripts/gen-types.ps1` wrapper + `npm run gen:types`
     script — handles CRLF cleanup + drops two CLI stdout banners that
     would otherwise land inside types.ts.
   - `d665904` pre-launch smoke suite (12 tests).
   - `b639a22` catering dashboard filters + pagination.

✅ Session 149 — BHD hygiene + PUB-009 leftover + types regen (2 commits)
   - `5848f24` BHD display hygiene + orphaned type alias removal +
     full types regen.
   - `5152434` PUB-009 follow-up: confirmed `OrderConfirmationRow =
     Pick<OrderRow, ...>` narrow type + `.returns<>()` in
     `order/[id]/page.tsx` replaces the prior blind cast. PUB-009 now
     fully closed.

✅ Session 148 — PUB-007 extension + 174/175 registry sync (1 commit, 814866b)
   - PUB-007 closed: `5a57f9a` (earlier in session) shipped migration
     174 `rpc_create_reservation_sqlstate_codes.sql` — every sentinel
     RAISE now carries a distinct ERRCODE in class KH (KH001…KH014).
     `reserve/actions.ts:215` switches on `error.code` instead of
     substring-matching `error.message`. Future RPC refactors that wrap
     error context can no longer silently degrade to `server_error`.
   - Migration 175 (`rpc_replace_recipes`) also landed in this session
     to fold inventory recipe writes into the RPC + audit-trail pattern.
   - `814866b` synced the migrations registry + the bridge.

✅ Session 147 — Dashboard RPC sweep finalization (migrations 176–179)
   - 176 (`rpc_menu_writes`) — all menu-item INSERT/UPDATE/DELETE
     consolidated into RPCs with audit trail.
   - 177 (`rpc_staff_writes`) — staff list mutations (including
     `rpc_set_staff_active` with CAS via `p_expected_state`).
   - 178 (`rpc_coupon_toggles`) — coupon enable/disable as RPC.
   - 179 (`rpc_create_order_sqlstate_codes`) — extended the SQLSTATE
     pattern from PUB-007 (migration 174) onto the order-creation path.

✅ Session 146 — Open-lane backlog sweep (1 commit, 0cb27d8)
   - Cleared residual P2/P3 items from BACKLOG.md that had been
     transparently closed by sessions 137-145's RPC sweep. No code
     changes — bridge + backlog hygiene only.

✅ Session 145 — Dashboard v4 P1 sweep finalization (1 commit, 81d0194)
   - Verified the 2026-05-13 dashboard v4 audit's 6 HIGH findings
     (AUD-V4-004..009) against current master. Four were already closed
     pre-session by prior work: AUD-V4-004 (migration 126
     `rpc_update_staff`), AUD-V4-005 (migration 169 `rpc_approve_shift`),
     AUD-V4-008 (`toSafeError` in Tap webhook route), AUD-V4-009
     (`npm audit --audit-level=high` = 0 vulns; fast-uri@3.1.2 post-patch).
   - Pass 1 — P1-4 (AUD-V4-007) Sentry scrub: dropped `enableLogs: true`
     from `sentry.server.config.ts`, `sentry.edge.config.ts`,
     `src/instrumentation-client.ts`. Routed two `getShiftSummary` error
     paths through `Sentry.captureException` with stage tags so the sites
     that legitimately need observability stay visible.
   - Pass 2 — P1-3 (AUD-V4-006) service-role factory consolidation:
     replaced inline `createSupabaseClient(url, key, {...})` with
     `await createServiceClient()` in 4 page.tsx files —
     `dashboard/tables/page.tsx`, `waiter/page.tsx`,
     `waiter/table/[tableNumber]/page.tsx`,
     `table/[branchId]/[tableNumber]/page.tsx`.
   - Behavior change: the 3 `notFound()` / `redirect()` fallbacks on
     missing env vars are gone. Factory throws a descriptive Error that
     surfaces in Sentry. Missing env is a deploy bug, not a runtime path.

✅ Session 144 — Public-surface hygiene audit + T3 cleanup (6 commits, 94e01c0 → a572bdb)
   - Generated `.agent/public-audit-2026-05-18.md` (15 findings: 0 P0,
     6 P1, 9 P2). The session-142 T1/T2 sweep visibly raised the floor.
   - T3-A1 (`94e01c0`): fail-closed Turnstile + rate limits on
     `/account/login` + `/account/register` + `/forgot-password`
     (PUB-003 + PUB-004 + PUB-014). Mirrors staff `/login` post-T1.
   - T3-A2 (`4444c3d`): swap `console.warn`/`console.error` to
     `Sentry.captureException` in `/payment/[orderId]/page.tsx`
     (PUB-001).
   - T3-A3 (`67f9f59`): pin `export const dynamic = 'force-dynamic'` on
     `/order/[id]`, `/payment/[orderId]`, `/account`, `/checkout`
     (PUB-013). Structural insurance against a future layout-hoist
     refactor flipping these to ISR.
   - T3-B (`a572bdb`): 7 P2 hygiene fixes + PUB-002 (P1, folded in
     since it lives on the same surface as PUB-001). Shared
     `PUBLIC_PHONE_RE` extracted to `src/lib/validation/phone.ts`,
     `registerSchema` Zod object for registerAction, `.max(50)` on
     contact branch_id, `q` searchParam clamp on `/menu`, `.max(72)` +
     5/15m rate-limit on setPasswordAction, Sentry on checkout error
     boundary, UUID guard on `/payment/[orderId]`.
   - Deferred at session-144 time: PUB-007 + PUB-009. Both subsequently
     closed in sessions 148 + 149.

✅ Session 142 — Security Tier 1 + Tier 2 hardening sweep (15 commits, fb3995f → e53c17a)
   - T1 (fail-open holes): Turnstile + Upstash now fail-closed in
     production across contact/reserve/catering (`fb3995f`); QR-order
     rate-limit on `/table` createQROrder + staff `/login` server
     action with Zod + Upstash (`93705bd`); `/order/[id]` column
     allowlist excludes driver_notes / actual_collected /
     cash_handed_over / handed_over_at / delivery_proof_url /
     customer_signature (`cf0e975`).
   - T2 (abuse vectors): CRLF guard on contact name + phone whitelist
     regex + find-tables rate-limit (`f53b0aa`); cron secret
     `timingSafeEqual` + error sanitization + birthday cron idempotency
     via migration 172 `notified_at` (`6c8927f`); honeypot fake-success
     on reserve+catering + slug length cap + account login Turnstile +
     email rate-limit (`972756d`); Tap webhook replay dedup regardless
     of `processed` flag via migration 173 (`3ec9b32`).
   - Types regen after 172 + 173 (`c7e9b3a`); notes refresh (`e53c17a`).

✅ Session 141 — Mobile responsiveness sweep + single-station mobile KDS
   - Lane 1 (responsive fixes): recipes/import tables overflow-x +
     card fallback (`1376554`); owner table + reservations card +
     shifts dialog (`f8a107e`); 44px touch targets on alerts/orders/
     reservations (`c8ee4c4`); filters + 16px inputs + wizard stacking
     across analytics/reports/payments/coupons/promotions/settings/pos
     (`dad7ef0`); menu dialogs + orders-detail single column
     (`994d449`).
   - Lane 2: `/kds/[station]` single-station mobile route + station
     selector (`e703d35`).
   - Close-out: `5711e58`.

✅ Session 140 — Second-pass dashboard audit clean, 14 fixes, migrations 168-171
   - Second-pass P0: clamp coupon branch scope for branch_manager +
     marketing (`93d5ce7`).
   - P1-A → P1-J converting remaining dashboard direct writes into
     RPCs with localized errors + audit trail (migrations 168/169/170/
     171). Final commits: `ca230e9` + `f2ecc88`.

✅ Sessions 137-139 — First-pass dashboard audit clean, 34 findings, migrations 165-167
   - First-pass P0 + P1 sweep converted direct supabase-js INSERT/UPDATE
     calls on orders / reservations / leave_requests into SECURITY
     DEFINER RPCs (migrations 165, 166, 167). Close-out: `cc7147a`.

CLOSED in session 136:

✅ ARCH-004 extension to table/waiter/POS — atomic payment row (`8610587`)
   - table/, waiter/, POS service: `p_payment_mode='cod'` on
     rpc_create_order; dropped JS payments insert.

✅ ARCH-004 final — POS card/tap atomicity (`e93c1bf` + `3a78f76`, migration 164)
   - rpc_create_order: extended p_payment_mode with 'tap_card' branch.
   - rpc_pos_finalize_order: 8-arg → 5-arg audit-only.
   - ARCH-004 fully closed across all 5 order-entry surfaces.

CLOSED since session 120 (sessions 121-135 — preserved list, in commit order):

✅ Security audit remediation sweep (sessions 122-124)
   - VULN-001/002/003/004/006/007/008/009/010/011/012/013/014/015/017/
     018/019/020/021/022 + VULN-A03/A04/A05/A06/A07/A08/A10 + AUD-V3
     residuals.

✅ Inventory banner + chef Excel import (P2-1/P2-2, session 128)
   - `786f549` chef Excel import wires inventory deduction.
   - `d5da803` + `5916ac2` 0-recipes-mapped banner.

✅ Birthday gift end-to-end (sessions 128-131)
   - `34e2da2` BirthdayGiftCard reads bonus points from loyalty_config.
   - `fbb4b21` account birthday save fix.
   - `bd2fb5e` migration 158 — birthday cron + idempotency table.
   - `29ac5f2` /api/cron/birthday-notify route + Vercel Cron config.
   - `d24e5e3` Resend email + wa.me WhatsApp deep-link.

✅ Riffa branch isOpen() timezone + cross-midnight (BUG-001, sessions 124-125)
   - `e7ab0cb` + `bfc18cd` riffa closing 01:00→02:00 across surfaces.

✅ /dashboard/catering inquiry listing (session 130, P4-1)
   - `1d67b4a` owner/GM-only listing page.
   - `48d9285` migration 160 — catering_inquiries table.
   - `e5908b4` + `2ef822c` server action + UX polish.

✅ Catering occasion/service enum normalization (session 135)
   - `aa2bffa` form persists enum keys, dashboard re-translates;
     legacy locale-string rows still render via typeguard fallback.

✅ ARCH-004 atomic checkout RPC (session 134)
   - `be15f22` migration 163 — rpc_create_order packs order + items
     + loyalty + coupon in single transaction.
   - `80f737e` checkout server action replaces serial JS steps.

✅ Cookie-consent gating on GA4 + Clarity (F-01, session 131)
   - `92c6fba` analytics blocked until consent.

✅ Checkout/waiter error localization (sessions 131, 135)
   - `9a93fe1` 7 raw-English checkout errors → localizeCheckoutError.
   - `f9bb840` waiter "Order creation failed" → waiter.errors.

✅ Dead-code cleanup (sessions 130-131)
   - `c4fe9a8` ForgotPasswordClient.tsx removed.
   - `993ee3b` SetPasswordClient.tsx removed.
   - `57ac6a9` HIDDEN_BRANCHES length guards removed (~30 files).

✅ Driver notifications + KDS hygiene (session 129)
   - `2079f2c` driver sound + visual on new delivery.
   - `2b45a6d` migration 161 — auto-complete KDS items on terminal status.
   - `dabfb87` selector counts active orders only.

✅ Sundry UX fixes (sessions 125-127)
   - `22f7071` cart "إضافة المزيد" closes drawer.
   - `efe68b1` supabase env-var actionable error.
   - `0ae1d6d` + `b2f0555` checkout points 50% cap UI+server alignment.
   - `568a6a0` migration 162 — membership_id generated column.
   - `3957abe` waiter QR member scanner (feature-flagged off).
   - `20fdf58` driver customerNavUrl decimal coord guard.
   - `a2b2009` all البديع branch references removed.

✅ Repo hygiene (session 135)
   - `27e1a98` migration 015 un-gitignored — password → runtime placeholder.
   - `ca61e41` migration 131 backfill — real REVOKE PUBLIC EXECUTE DDL
     replaces cowork 1-line placeholder; verified no-op against live.

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard routes (re-enforced session 140, P1-I)
- **All financial DB writes via RPC only** — ARCH-004 fully closed across
  all 5 order-entry surfaces (checkout, table, waiter, POS, POS service).
  Order + payment row commit atomically in rpc_create_order via
  p_payment_mode = 'cod' | 'online' | 'tap_card'.
- **All dashboard mutating writes via RPC + audit trail** — sessions
  137–147 converted direct supabase-js INSERT/UPDATE calls on
  orders / reservations / leave_requests / waitlist / shifts /
  coupons / promotions / staff / settings / menu / recipes into
  SECURITY DEFINER RPCs (migrations 165–179). Audit row + parent
  mutation share a transaction.
- **Public write surfaces fail closed in production** (session 142, T1;
  extended in session 144, T3-A1) — Turnstile, Upstash, missing env vars
  all return rate_limit/error in production across contact, reserve,
  catering, staff login, customer login, customer register, forgot-password,
  set-password; dev/preview keep honeypot-only fallback.
- **Per-user authenticated pages pin `force-dynamic`** (session 144, T3-A3) —
  `/order/[id]`, `/payment/[orderId]`, `/account`, `/checkout`.
- **Shared public form validation** (session 144, T3-B) —
  `src/lib/validation/phone.ts` exports `PUBLIC_PHONE_RE`. Contact,
  reserve, catering all import from this; do not redeclare the regex.
- **RPC error sentinels use SQLSTATE codes in class KH** (PUB-007,
  closed session 148; extended to order-create in session 147 via
  migration 179) — JS callers must discriminate on `error.code`, never
  on `error.message` substring matching. A future RPC refactor wrapping
  error context would silently degrade message-based branches to
  generic server_error.
- **Narrow row types via `Pick<X, ...>` + `.returns<>()`** on
  hand-written explicit-column selects (PUB-009, closed session 149) —
  never `as unknown as X` blind casts. Column drift between the select
  list and the type then gets flagged by tsc.
- AnalyticsResult<T> pattern for all analytics queries (AUD-V3-008)
- createClient() (anon) for analytics reads where RLS covers it
- createServiceClient() only for: matviews + RPCs without authenticated grant
- **Service-role client construction goes through `createServiceClient()`** —
  never inline `createClient(url, key, {...})` in pages or actions (AUD-V4-006,
  closed session 145). Single source of truth for the env-var read, the
  `persistSession: false` block, and any future hardening (regional clients,
  key rotation, telemetry hooks).
- **Sentry `enableLogs: true` is forbidden** in any of the three Sentry config
  files (AUD-V4-007, closed session 145) — application-level console output
  leaks order/branch IDs to breadcrumbs. Sites that need observability call
  `Sentry.captureException` explicitly.
- **Navbar keyboard accessibility** (session 154) — every interactive
  control in `Header.tsx` carries the shared `FOCUS_RING` constant
  (focus-visible:ring-2 ring-brand-gold/60 + outline-none). Use
  :focus-visible, never :focus, so mouse clicks stay clean.
- x-real-ip before x-forwarded-for for rate limiting
- No console.error swallowing — Sentry via captureAnalyticsError
- Customer-facing + staff-facing error strings go through next-intl
  (localizeCheckoutError for checkout; waiter.errors namespace for waiter;
  audit-sweep P1 added namespaces for waitlist/shifts/coupons/promotions)
- Catering occasion_type / service_type persisted as enum keys, not
  locale strings (single source of truth: CATERING_OCCASION_TYPES /
  CATERING_SERVICE_TYPES in src/lib/whatsapp-catering-message.ts)
- Cron routes use `crypto.timingSafeEqual` on equal-length Buffers
  (matches verifyWebhookSignature in tap-client.ts)
- **Bridge protocol** — close-outs that update `CURRENT-SESSION.md`
  must ALSO update `.agent/CLAUDE-AI-CONTEXT.md` (the canonical source
  that `sync-context.ps1` reads). Otherwise the next sync silently
  drops history. Session 154 backfilled 146-153 after the regression
  was caught.
- git add -p always — never stage sibling work
- Work on master directly — no worktrees unless explicitly requested

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision

## MIGRATION STATE
- Local = Remote — migrations applied through 183 (paired).
- Session 155 added: 183 (`kds_unassigned_fallback` — replaces
  fn_kds_enqueue_item's `'packing'` fallback with `'unassigned'` so
  the DB column matches the UI screen; UPDATE backfills 82 historical
  rows + 8 other abandoned legacy enum values). Applied via MCP.
- Session 154 added: **none** — both commits were frontend-only
  (Header.tsx polish + a11y focus rings).
- Session 153 added: 181 (UPDATE menu_items SET station='mains' WHERE
  station='main' — cosmetic), 182 (backfill 8 rows into
  menu_items_sync — 7 egg sandwiches @ 'mains', turkish-coffee @
  'cold' — closes Unassigned-in-KDS gap).
- Session 152 added: **none** — pure frontend layout work in Header.tsx.
- Session 151 added: 180 (seed Turkish Coffee item: id `turkish-coffee`,
  category `the-heritage-tea-and-coffee`, price 1.600 BHD, station
  `mains`, idempotent `ON CONFLICT (id) DO NOTHING`).
- Session 149 added: **none** — types regen + BHD hygiene + PUB-009
  follow-up review only.
- Session 148 added: 174 (rpc_create_reservation_sqlstate_codes —
  PUB-007 close), 175 (rpc_replace_recipes).
- Session 147 added: 176 (rpc_menu_writes), 177 (rpc_staff_writes),
  178 (rpc_coupon_toggles), 179 (rpc_create_order_sqlstate_codes).
- Session 142 added: 172 (birthday_point_credits.notified_at +
  partial index — cron send-idempotency for Vercel retries),
  173 (process_tap_webhook short-circuits on ANY prior payment_webhooks
  row with matching gateway_id, not just processed=true)
- Session 140 added: 168 (rpc_add_waitlist_entry +
  rpc_update_waitlist_status), 169 (rpc_approve_shift),
  170 (rpc_create/update/delete_coupon with branch scope),
  171 (rpc_create/update/delete_promotion)
- Sessions 137-139 added: 165 (rpc_update_order_status +
  rpc_cancel_order), 166 (rpc_update_reservation_status),
  167 (rpc_create_leave_request)
- Session 136 added: 164 (rpc_create_order tap_card branch +
  rpc_pos_finalize_order audit-only)
- Sessions 121-135 added: 154 (security), 155 (VULN-004 coupon_usages
  in-RPC), 156-157 (security), 158 (birthday cron + idempotency),
  159 (security), 160 (catering_inquiries), 161 (auto-complete KDS),
  162 (membership_id), 163 (ARCH-004 atomic rpc_create_order)
- Migration 131: content backfilled session 135 — real REVOKE DDL
  (was 1-line cowork placeholder). schema_migrations.statements still
  carries old placeholder; backfill matters for fresh-clone parity only.
- Migration 015: un-gitignored session 135, password → runtime
  setting placeholder (current_setting('app.admin_password', true))
- Migrations 172 + 173 applied via MCP under timestamped suffixes
  (20260517193957, 20260517194237). Local files use 172_ / 173_ prefix
  matching project's monotonic numbering. `supabase migration list
  --linked` flags the mismatch cosmetically; no production impact.

## SESSION HISTORY (last entries)
- Session 155: open-lane sweep — brand assets, dish-image onError
  fallback, KDS trigger fallback alignment + migration 183, gitignore,
  loyalty tier panel carousel → 2-col grid (5 commits, `d77283e →
  624c7ed`). Premise correction on session-153 carry: real KDS gap
  was `fn_kds_enqueue_item`'s `'packing'` fallback (82 historical
  rows), not "fryer/drinks/desserts." Trigger fallback now writes
  `'unassigned'` directly + backfill UPDATE realigned 82 rows.
  Image-asset audit: 0 missing (160/160 DB + 175/175 menu.json
  resolve on disk).
- Session 154: mobile navbar polish + a11y focus rings (2 commits,
  `32f4fc5 → 9dc0cf0`). At 375 + 430 px, logo at top state was
  dissolving into hero photography — bumped h-12→h-14, max-w-170→190,
  added drop-shadow that fades out when glass capsule takes over.
  Sheet language toggle now 44x44 hit target. FOCUS_RING constant
  applied to all 18 interactive controls in Header.tsx
  (focus-visible:ring-2 ring-brand-gold/60 + outline-none).
  :focus-visible (not :focus) so mouse clicks stay clean. Items 3 + 4
  from open lane (PUB-007 + PUB-009) were no-ops — already closed in
  sessions 148 + 149. Process glitch caught: sessions 146-153 had
  been writing to CURRENT-SESSION.md without updating
  CLAUDE-AI-CONTEXT.md; this session backfilled the source.
- Session 153: KDS station coverage audit + 2 DB fixes (migrations
  181 + 182). fn_kds_enqueue_item identified as live router; 8 items
  backfilled into menu_items_sync. Carry: STATION_CONFIG ↔ trigger
  output overlap audit.
- Session 152: navbar layout iteration (6 commits). Landed
  Nobu/Zuma absolute-centered logo pattern after several reverts.
- Session 151: navbar redesign + Turkish Coffee seed (3 commits +
  migration 180).
- Session 150: open-lane sweep (5 commits) — CI Node 24, dashboard
  P2 sweep AUD-V4-011/013/016, gen-types.ps1 wrapper, smoke suite,
  catering filters.
- Session 149: BHD hygiene + PUB-009 leftover + types regen
  (2 commits, no migrations).
- Session 148: PUB-007 close + migrations 174 + 175 + registry sync.
- Session 147: dashboard RPC sweep finalization (migrations 176-179).
- Session 146: open-lane backlog hygiene (1 commit, no code).
- Session 145: dashboard v4 P1 sweep finalization (Sentry enableLogs
  drop + service-role factory consolidation).

## BRIDGE PROTOCOL
- Claude Code reads `.agent/CURRENT-SESSION.md` at session start via:
  `pwsh .agent/sync-context.ps1`
- `sync-context.ps1` REGENERATES `CURRENT-SESSION.md` from
  `CLAUDE-AI-CONTEXT.md`. Any edits made directly to
  `CURRENT-SESSION.md` are lost on next sync.
- Claude.ai (or Claude Code, when authoring a close-out) updates
  `CLAUDE-AI-CONTEXT.md` — the canonical source.
- Never delete either file — append/overwrite sections only.
