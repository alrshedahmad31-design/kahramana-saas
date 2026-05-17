━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 140 close-out)
Master: c6893ae
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 140 close-out — second dashboard audit pass CLEAN)
# Master: c6893ae

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational  →  **dev work complete; only operator actions remain**
Next milestone: Soft-launch (cash-only)

Second-pass dashboard audit (session 140 prompt):
  • 1  P0 finding   — ✅ closed (coupon branch clamp, commit `93d5ce7`)
  • 9  P1 groups    — ✅ all closed (A through J, commits `d3582de` → `c6893ae`)
  • 4  new migrations 168/169/170/171 — applied + paired + audited

All dashboard write paths now enforce branch scope + role + transition +
audit at the DB level. Coupon + promotion branch-scope clamp is now
DOUBLE-enforced: JS pre-flight UX + DB-level rejection via
`_coupon_clamp_branches` (170) and equivalent guard in 171. The only
remaining direct service-role writes are the staff CRUD pair
(blocked on `supabase.auth.admin` not being callable from SECURITY
DEFINER) and `loyalty_config` (low-risk, single-table) — both marked
with `// RPC-PENDING` comments explaining the deferral.

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
- Chef recipe Excel (drives 0-recipes-mapped inventory banner).

## ACTIVE DEV PRIORITIES

**Status: empty.** All dev work that is not operator-blocked or
externally locked is complete. Both audit passes (session 137 and
session 140 prompts) closed with 0 P0 + 0 P1 remaining.

CLOSED this session (140 — second dashboard audit pass):

✅ P0 — coupon branch clamp (`93d5ce7`)
   - branch_manager + marketing can no longer create global /
     cross-branch coupons. Empty / null / mismatched
     applicable_branches arrays rejected BEFORE the insert hits the
     DB. owner / GM bypass.

✅ P1-A — KDS advanceOrderStatus via RPC (`d3582de`)
   - rpc_update_order_status (migration 165) closes the last direct
     UPDATE on orders from a KDS surface. Raw English errors →
     kds.errors.* (11 keys). console.error swallowing → Sentry.

✅ P1-B — POS post-RPC writes folded in (`aa23514`)
   - delivery_lat / delivery_lng / delivery_flat written via
     rpc_create_order's p_delivery_* params (migration 163). The
     Nominatim geocoder fallback stays out-of-band with an explicit
     comment explaining why. pos.errors.* / pos.service.errors.*
     namespaces added (24 keys).

✅ Migration 168 (`7ed94fe`)
   - rpc_add_waitlist_entry + rpc_update_waitlist_status with
     role/branch/transition gates + CAS + audit in one transaction.

✅ P1-C — waitlist via RPC (`76307fd`)
   - addToWaitlist + updateStatus wired to migration 168 RPCs.
     Throw-based contract preserved; RPC error codes mapped to
     waitlist.errors.* (10 keys).

✅ Migration 169 (`44274e2`)
   - rpc_approve_shift: owner/GM only, status CAS, approved_by
     stamped from auth.uid() (forged payload can't misattribute),
     audit row in the same transaction.

✅ P1-D — shifts approveShift via RPC + static import (`70da885`)
   - approveShift wired to migration 169. shifts/page.tsx:65 dynamic
     import → static. dashboard.shifts.errors.* (10 keys).

✅ Migration 170 (`225e39b`)
   - rpc_create_coupon + rpc_update_coupon + rpc_delete_coupon with
     DB-LEVEL branch scope clamp via _coupon_clamp_branches helper.
     Business caps (max % 30, max BHD 5, usage_limit > 0,
     percentage cap required) re-enforced server-side.
     rpc_delete_coupon short-circuits on coupon_usages > 0 with
     typed code='in_use' (no Postgres FK violation leak).

✅ P1-E — coupon writes via RPC + static import (`8ace248`)
   - createCoupon + updateCoupon wired to migration 170. toggle
     helpers kept on direct UPDATE (single boolean field, scope
     already covered). coupons/page.tsx:20 dynamic import → static.
     dashboard.coupons.errors.* (14 keys).

✅ Migration 171 (`bdd60ab`)
   - rpc_create_promotion + rpc_update_promotion + rpc_delete_promotion.
     Branch scope at DB level: non-globals cannot create global promos
     (code='global_forbidden') or touch other branches' rows.
     Update path re-checks scope against EXISTING row.

✅ P1-F — promotion writes via RPC + audit + localize (`03a8714`)
   - upsertPromotion / togglePromotion / deletePromotion wired to
     migration 171. The dropped getServiceClient() helper + JS-level
     assertPromotionBranchScope moved entirely into the RPC body.
     promotions.errors.* (9 keys).

✅ P1-G/H — reports + 8 swallowed-error pages (`2a3f8d2`)
   - reports/actions.ts: logReport + logExportFormat wrapped in
     try/catch + Sentry; auth errors localized via reports.errors.*.
   - 7 pages where query failures were silently dropped now route
     through captureAnalyticsError: dashboard/page.tsx,
     dashboard/owner/page.tsx, inventory/page.tsx,
     inventory/recipes/page.tsx, payments/page.tsx, waiter/page.tsx
     (2 spots), reservations/actions.ts (4 raw .message throws
     sanitised), recipes/import/actions.ts (chef-facing Postgres
     error leak sanitised).

✅ P1-I — eliminate remaining dynamic imports (`094fe35`)
   - 3 inventory subroute page.tsx files (stock, transfers, waste/new)
     converted to static imports of getActiveBranches.
   - inventory/reports/actions.ts intentionally left with its
     dynamic imports (lazy-loads ExcelJS export-only dep).

✅ P1-J — staff + loyalty RPC-PENDING markers + audit hygiene (`c6893ae`)
   - 5 staff/actions.ts service-role writes get RPC-PENDING comments
     explaining the auth.admin deferral.
   - createStaffFull profile UPDATE (line 318) — previously NO error
     check + NO audit — now Sentry-captured + audit_logs UPDATE row.
   - loyalty-actions.ts: console.error swallowing replaced with
     Sentry; audit_logs INSERT gets explicit error check + Sentry
     so an audit failure no longer breaks the trail silently.

DEFERRED / NEXT-LANE CANDIDATES:
- rpc_create_staff / rpc_create_staff_full — blocked on
  supabase.auth.admin not callable from SECURITY DEFINER body.
  Tracked via inline `// RPC-PENDING:` comments in staff/actions.ts.
- rpc_update_staff / rpc_set_staff_active — could be standalone
  but grouped with the auth-blocked work for a single migration.
- rpc_update_loyalty_config — single-table write, deferred because
  the section gate + JS audit pattern is already strong.

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard ROUTES (page.tsx files). Server
  actions may keep `await import()` for genuinely lazy/heavy deps
  (e.g. ExcelJS in inventory/reports/actions.ts).
- **All financial DB writes via RPC only** — ARCH-004 fully closed.
  Order + payment row commit atomically in rpc_create_order via
  p_payment_mode = 'cod' | 'online' | 'tap_card'.
- **All dashboard mutations via RPC** — second-pass audit closed
  the orders / reservations / leave (sess 139) and the waitlist /
  shifts / coupons / promotions (sess 140) write paths. Only the
  staff + loyalty pair remains JS-side, both with documented
  RPC-PENDING markers and the auth.admin blocker spelled out.
- **Branch-scope clamp on coupons + promotions enforced at DB level**
  via `_coupon_clamp_branches` (170) and the equivalent inline
  branch check in rpc_create_promotion / rpc_update_promotion (171).
  JS-layer guards stay as pre-flight UX, not as enforcement.
- AnalyticsResult<T> pattern for all analytics queries (AUD-V3-008).
- createClient() (anon) for analytics reads where RLS covers it.
- createServiceClient() only for: matviews + RPCs without
  authenticated grant.
- x-real-ip before x-forwarded-for for rate limiting.
- No console.error swallowing — Sentry via captureAnalyticsError
  (analytics surfaces) or Sentry.captureException tagged with
  area + action (everything else).
- Customer-facing + staff-facing error strings go through
  next-intl. New namespaces this session: kds.errors, pos.errors,
  pos.service.errors, waitlist.errors, dashboard.shifts.errors,
  dashboard.coupons.errors, promotions.errors, reports.errors,
  reservations.errors.
- Catering occasion_type / service_type persisted as enum keys, not
  locale strings.
- git add -p always — never stage sibling work.
- Work on master directly — no worktrees unless explicitly requested.

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision

## MIGRATION STATE
- Local = Remote = **171 migrations applied (paired)**
- Session 140 added: 168 (rpc_waitlist), 169 (rpc_approve_shift),
  170 (rpc_coupons), 171 (rpc_promotions)
- All four applied via Supabase MCP, then version-paired via
  `supabase migration repair --status reverted <timestamp> --linked
  && --status applied <N> --linked`. Types regenerated after each
  via `supabase gen types typescript --linked` (stderr separated
  via `2>/tmp/sb.err` to avoid the "Initialising login role…"
  banner corrupting types.ts line 1).
- Sessions 121-139 added 154-167.

## SESSION HISTORY (last 5)
- Session 135: catering occasion/service enum normalization +
  migration 015 un-gitignored + waiter error localized + migration
  131 cowork DDL backfilled.
- Session 136: ARCH-004 extension to table/waiter/POS (`8610587`) +
  ARCH-004 final POS card/tap atomicity (`e93c1bf` + `3a78f76`,
  migration 164). ARCH-004 fully closed across all 5 order-entry
  surfaces.
- Session 137: dashboard audit prompt — 11 P0 findings flagged.
- Session 138: P0 sweep — 11 commits `444b042` → `24f99f3`.
- Session 139: P1 sweep — 23 findings (6 commits) + RPC-PENDING
  elimination via migrations 165/166/167 (4 commits) =
  10 commits `4691f72` → `7671239`.
- Session 140: **second dashboard audit pass** — 1 P0 + 9 P1
  groups + 4 migrations = 14 commits `93d5ce7` → `c6893ae`,
  pushed to origin. Second pass CLEAN.

## GATES (session 140 close)

```
tsc --noEmit            clean
i18n parity             AR 2,541 = EN 2,541
next build              566 pages, 0 errors (NEXT_BUILD_WORKERS=1, 26.3s)
supabase migration list Local = Remote, head = 171
git push origin master  pushed (cc7147a..ca230e9)
```

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
