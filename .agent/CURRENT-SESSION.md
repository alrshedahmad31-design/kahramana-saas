━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-18 17:39
Master: 626362b93754e0bc15bcfddd5354723eaaa60bb6
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-18 (session 152 close-out — navbar layout iteration)
# Master: 3b6647c

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational  →  **dev work complete; only operator actions remain**
Next milestone: Soft-launch (cash-only)
Posture: session-152 iterated the navbar layout to a stable production
shape across 6 commits (visual feedback loop with Playwright screenshots
on /ar + /en at 1440/1280 widths). Final pattern: single flex row with
absolutely-positioned logo (`left-1/2 -translate-x-1/2`) at the bar's
geometric center; groupStart holds 4 nav links (menu, branches, catering,
about); groupEnd holds 1 link (contact) + utilities (EN/AR, account, cart)
+ slim Reserve CTA (`px-4 py-2` from `px-6 py-2.5`); header now `h-20`
unconditional (was `h-16 sm:h-20` morph) so the logo has stable headroom
in both scrolled and unscrolled states. No code-only RTL conditionals on
spacing. All 9 gates green at HEAD.

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
soft-launch (cash-only).

Optional next-lane candidates (none queued; only fire on explicit ask):
- **PUB-007 + PUB-009** (deferred from session 144 T3-B). Both documented
  in `.agent/BACKLOG.md` under "Session 144 — Public-surface audit
  deferred items". PUB-007 needs a Supabase migration to switch the
  reserve RPC from substring sentinel matching to SQLSTATE codes;
  PUB-009 is a ~15-line narrow row type for `/order/[id]` to replace the
  `as unknown as OrderWithItems` cast. Pair them in the next hygiene lane.

CLOSED in sessions 137–145 (newest first):

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
     `table/[branchId]/[tableNumber]/page.tsx`. Removed three stale
     "restaurant_tables not yet in Database types" comments (table is in
     `types.ts:3446` since session-142 type regen).
   - Behavior change: the 3 `notFound()` / `redirect()` fallbacks on
     missing env vars are gone. Factory throws a descriptive Error that
     surfaces in Sentry. Missing env is a deploy bug, not a runtime path.
   - Single commit (`81d0194`), all 9 gates green at HEAD, no migrations.

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
   - Also: pre-audit chores landed early-session — `bc0811c` (session
     143 9-gate hygiene chore — amber → brand-gold + gate-5/6 regex
     tightening); `c55f0c9` (drop `Record<string, never>` cast on
     `notified_at` UPDATE in birthday-notify route, types.ts now covers
     migration 172).
   - Deferred to backlog: PUB-007 (RPC SQLSTATE migration), PUB-009
     (narrow row type refactor). Both in `.agent/BACKLOG.md`.

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
     RPCs with localized errors + audit trail: KDS advanceOrderStatus
     (`d3582de`); POS post-RPC writes folded into rpc_create_order
     (`aa23514`); waitlist via migration 168 + RPC wiring
     (`7ed94fe` + `76307fd`); shifts approveShift via migration 169
     (`44274e2` + `70da885`); coupon writes via migration 170
     (`225e39b` + `8ace248`); promotion writes via migration 171
     (`bdd60ab` + `03a8714`); reports + error-handling gaps across
     8 pages (`2a3f8d2`); eliminate remaining dynamic imports on
     dashboard routes (`094fe35`); staff + settings write hygiene +
     audit trail (`c6893ae`).
   - Close-outs: `ca230e9` + `f2ecc88`.

✅ Sessions 137-139 — First-pass dashboard audit clean, 34 findings, migrations 165-167
   - First-pass P0 sweep: section gates on menu + shifts + shifts
     fail-closed (`444b042`); fail-closed null branch_id in orders
     list (`7f60f59`); branch filter on ops_alerts + coupons + marketing
     scope (`a835779`); staff branch filter + loyalty config audit
     (`5d283de`); catering defense-in-depth + inventory RLS verified
     (`24f99f3`).
   - First-pass P1 sweep: orders write hygiene + error handling
     (`4691f72`); KDS RBAC + client + branchId clamp (`3208f39`);
     POS service RBAC + inventory branch clamp (`325ef2e`); reports +
     reservations + waitlist (`b6243b6`); analytics + promotions +
     payments + staff (`cb30180`); settings + menu i18n (`5fd1147`).
   - Migrations 165 (rpc_update_order_status + rpc_cancel_order),
     166 (rpc_update_reservation_status), 167 (rpc_create_leave_request)
     replace direct dashboard writes. Wired via `7671239`.
   - Close-out: `cc7147a`.

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
  137–140 converted direct supabase-js INSERT/UPDATE calls on
  orders / reservations / leave_requests / waitlist / shifts /
  coupons / promotions / staff / settings into SECURITY DEFINER RPCs
  (migrations 165–171). Audit row + parent mutation share a transaction.
- **Public write surfaces fail closed in production** (session 142, T1;
  extended in session 144, T3-A1) — Turnstile, Upstash, missing env vars
  all return rate_limit/error in production across contact, reserve,
  catering, staff login, customer login, customer register, forgot-password,
  set-password; dev/preview keep honeypot-only fallback.
- **Per-user authenticated pages pin `force-dynamic`** (session 144, T3-A3) —
  `/order/[id]`, `/payment/[orderId]`, `/account`, `/checkout`. Pure
  insurance against a future layout-hoist refactor breaking the
  implicit-dynamic guarantee and exposing user A's data via the shared
  static cache.
- **Shared public form validation** (session 144, T3-B) —
  `src/lib/validation/phone.ts` exports `PUBLIC_PHONE_RE`. Contact,
  reserve, catering all import from this; do not redeclare the regex.
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
- git add -p always — never stage sibling work
- Work on master directly — no worktrees unless explicitly requested

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision

## MIGRATION STATE
- Local = Remote — migrations applied through 180 (paired).
- Session 152 added: **none** — pure frontend layout work in Header.tsx.
- Session 151 added: 180 (seed Turkish Coffee item: id `turkish-coffee`,
  category `the-heritage-tea-and-coffee`, price 1.600 BHD, station
  `mains`, idempotent `ON CONFLICT (id) DO NOTHING`). Departs from 144's
  pattern by setting station explicitly to match sibling drinks rows
  (default would have been `main`; existing drinks all carry `mains`).
- Session 145 added: **none** — both passes were code-only (Sentry config
  flag flip + service-role factory consolidation). The 6 dashboard v4 P1s
  were either already covered by prior migrations (126 for staff TOCTOU,
  169 for approveShift CAS) or were never migration-shaped.
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
- Session 152: navbar layout iteration (6 commits, `b7f73fd → 3b6647c`).
  Drove the centering through several approaches before landing on the
  proven Nobu/Zuma pattern: single flex row with the logo
  absolutely-positioned at `left-1/2 -translate-x-1/2`. Attempted (and
  reverted): absolute CTA outside the grid (`b7f73fd` — broken: a class
  conflict in CinematicButton's hardcoded `inline-flex` collided with
  `hidden md:inline-flex` and `hidden` won the cascade, rendering the
  CTA `display:none` on every viewport); symmetric `minmax(0,1fr)` grid
  with phantom CTA-shaped spacer (`7c7bfe3`); flex+absolute reverted
  (`614658a`); min-w + slim CTA padding (`8732cb8`); `justify-end` to
  pull groupStart content close to logo (`25e61b6`); finally moved About
  to groupStart (4 vs 1+icons+CTA balances naturally, no min-w needed)
  and bumped header to `h-20` unconditional for logo headroom
  (`3b6647c`). Screenshots captured at each iteration via Playwright on
  the local dev server (/ar + /en at 1440 and 1280 widths). No
  migrations, no i18n changes, no other files touched.
- Session 151: navbar redesign + Turkish Coffee seed. Three commits:
  `a612770` Header.tsx rewrite (luxury restaurant pattern — centered
  logo on `grid-cols-[1fr_auto_1fr]`, split nav groups, premium typo
  with English tracking + uppercase / Arabic untracked, gold-underline
  on active route via `::after`, hover removes underline for gold-fade,
  account icon-only signed-out + signed-in dropdown preserved, EN/AR
  literal toggle, mobile drops calendar icon and bumps logo to h-12
  max-w-[170px]). `42ef745` migration 180 seeds Turkish Coffee row
  (applied to remote; idempotent). `6aa9d41` adds the asset file
  `public/assets/gallery/turkish-coffee.webp`. All 9 gates green.
  Note: id `turkish-coffee` does not follow the `drinks-*` prefix
  convention used by the other 3 rows in this category — left as-is
  per user decision; no corrective migration 181.
- Session 141: mobile responsiveness sweep across recipes/import/
  owner/reservations/shifts/alerts/orders/analytics/reports/payments/
  coupons/promotions/settings/pos/menu (Lane 1) + /kds/[station]
  single-station mobile route (Lane 2)
- Session 142: Tier 1 + Tier 2 security hardening (15 commits) —
  Turnstile + Upstash fail-closed, QR rate-limit, staff login server
  action, order column allowlist, CRLF + phone whitelist, find-tables
  rate-limit, cron timingSafeEqual + sanitize + notified_at idempotency
  (migration 172), honeypot fake-success, slug cap, account login
  Turnstile + email RL, Tap webhook replay dedup (migration 173).
  Types regen + notes refresh.
- Session 143: 9-gate hygiene chore — amber → brand-gold on 3 spots in
  ReservationsClient.tsx; gate 5 BHD regex tightened to display-token
  only; gate 6 exempt list adds birthday-notify cron. One commit
  (`bc0811c`), no migrations, no runtime behaviour change.
- Session 144: public-surface hygiene audit + T3 cleanup. Generated
  `.agent/public-audit-2026-05-18.md` (15 findings, 0 P0, 6 P1, 9 P2).
  Shipped 4 batches in 6 commits: T3-A1 fail-closed login surfaces;
  T3-A2 Sentry on /payment page; T3-A3 force-dynamic pin on 4 auth
  pages; T3-B 7 P2s + PUB-002 + shared phone regex. Two P2s deferred
  to BACKLOG.md (PUB-007 needs migration, PUB-009 ~15-line refactor).
  No migrations, all 9 gates green.
- Session 145: dashboard v4 P1 sweep finalization. Verified all 6
  HIGH findings (AUD-V4-004..009) against current master — four were
  already closed pre-session (migrations 126/169, toSafeError, npm
  audit clean). Pass 1 dropped `enableLogs: true` across all 3 Sentry
  configs + routed two `getShiftSummary` errors through
  `Sentry.captureException`. Pass 2 collapsed 4 inline service-role
  constructions into `createServiceClient()`. Single commit
  (`81d0194`), no migrations, all 9 gates green. With this and the
  session-144 PUB-* closures, every P1 in either audit doc is now
  closed on master.

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
