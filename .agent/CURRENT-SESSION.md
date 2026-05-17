━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 139 close-out)
Master: 7671239
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 139 close-out — dashboard audit CLEAN)
# Master: 7671239

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational  →  **dev work complete; only operator actions remain**
Next milestone: Soft-launch (cash-only)

Dashboard audit (session 137 prompt):
  • 11 P0 findings — ✅ all closed (session 138, commits `444b042` → `24f99f3`)
  • 23 P1 findings — ✅ all closed (session 139, commits `4691f72` → `5fd1147`)
  • 3 RPC-PENDING markers from P1 sweep — ✅ all closed (session 139,
    migrations 165/166/167 + wiring refactor, commits `7250292` → `7671239`)

All dashboard writes now route through RPCs with atomic
transition + audit transactions. Architecture rule "all financial /
lifecycle DB writes via RPC only" is enforced platform-wide.

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

All remaining work is operator-side. No dev lanes outstanding.

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
- Chef recipe Excel — inventory deduction is a no-op for live
  orders until this lands.

Confirmed ✅ (no further action needed):
- البديع branch row deleted from `branches` table.
- CONTACT_NOTIFY_EMAIL set to asaadaljobory@gmail.com.
- VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT set.
- CRON_SECRET set.
- Cloudflare Turnstile + SESSION_BIND_SECRET + SENTRY_AUTH_TOKEN set.

## ACTIVE DEV PRIORITIES

**Status: empty.** All dev work that is not operator-blocked or
externally locked is complete. The project is production-ready for
soft-launch (cash-only).

CLOSED this session (139):

✅ Dashboard audit P1 sweep — 23 findings, 6 commits
   - `4691f72` P1-12/13/14/15: orders write hygiene + error handling
   - `3208f39` P1-16/17/18: KDS RBAC + client + branchId clamp
   - `325ef2e` P1-19/20/21/22: POS service RBAC + inventory branch clamp
   - `b6243b6` P1-23/24/25/26/27: reports + reservations + waitlist
   - `cb30180` P1-28/29/30/31/32: analytics + promotions + payments + staff
   - `5fd1147` P1-33/34: i18n localize settings + menu
   - Added 3 new loading.tsx + error.tsx pairs (reservations,
     waitlist, promotions); error.tsx files now Sentry-capture and
     show a localized generic copy instead of leaking `error.message`.
   - Aligned `SECTION_ROLES` / `SERVICE_ROLES` / inventory layout
     gates so the source-of-truth role list matches the page gate
     (P1-19 waiter dropped from pos/service; P1-22 kitchen added
     to inventory layout for recipes/ingredients/waste access).

✅ RPC-PENDING elimination — 3 RPCs, 4 commits
   - `7250292` migration 165 — rpc_update_order_status +
     rpc_cancel_order. Atomic order-status transitions with
     role/branch/transition/refund/CAS + audit_logs row in one txn.
   - `a607efe` migration 166 — rpc_update_reservation_status.
     Atomic reservation transition + timestamp stamps + audit.
   - `1d4660a` migration 167 — rpc_create_leave_request. Self-id
     enforced by *removing* p_staff_id from the param list; staff_id
     comes from auth.uid() unconditionally.
   - `7671239` wiring refactor — all three call sites
     (dashboard/orders/actions.ts, dashboard/reservations/actions.ts,
     dashboard/staff/[id]/actions.ts) now route through the new
     RPCs. Removed unused `hasCapturedPayment` helper +
     `PaymentStatus` import. types.ts patched with the four new
     RPC entries.

CLOSED session 138 (preserved list):

✅ Dashboard audit P0 sweep — 11 findings, 5 commits
   (`444b042` → `24f99f3`)
   - P0-1/2/3: section gates on menu + shifts + shifts fail-closed
   - P0-4: fail-closed null branch_id in orders
   - P0-5/6/7: branch filter ops_alerts + coupons + marketing scope
   - P0-8/9: staff branch filter + loyalty config audit trail
   - P0-10/11: catering defense-in-depth + inventory RLS verified

CLOSED sessions 121-136 (preserved list, in commit order):

✅ ARCH-004 closed across all 5 order-entry surfaces (sessions 134-136)
   - migration 163 — rpc_create_order folds order + items + loyalty
     + coupon + delivery_flat + initial payment into one txn.
   - migration 164 — p_payment_mode 'tap_card' branch +
     rpc_pos_finalize_order audit-only (8-arg → 5-arg).
   - All 5 surfaces (checkout, table, waiter, POS, POS service)
     commit order + payment atomically.

✅ Security audit remediation sweep (sessions 122-124)
   - VULN-001/002/003/004/006/007/008/009/010/011/012/013/014/015/017/
     018/019/020/021/022 + VULN-A03/A04/A05/A06/A07/A08/A10 + AUD-V3
     residuals.

✅ Birthday gift end-to-end (sessions 128-131)
   - migration 158 (cron + idempotency), /api/cron/birthday-notify,
     BirthdayGiftCard reads loyalty_config.birthday_bonus_points,
     Resend email + wa.me deep-link.

✅ /dashboard/catering + occasion/service enum normalization
   (sessions 130-135)
   - migration 160 (catering_inquiries), owner/GM-only listing
     page, form persists enum keys, dashboard re-translates.

✅ Repo hygiene (session 135)
   - migration 015 un-gitignored — password → runtime placeholder.
   - migration 131 backfill — real REVOKE PUBLIC EXECUTE DDL.

✅ Dead-code cleanup (sessions 130-133)
   - ForgotPasswordClient.tsx, SetPasswordClient.tsx removed.
   - HIDDEN_BRANCHES length guards removed (~30 files, 15 files
     touched, −123 / +18 LOC).

✅ Riffa branch isOpen() timezone + cross-midnight (sessions 124-125)
✅ Cookie-consent gating on GA4 + Clarity (F-01, session 131)
✅ Checkout/waiter error localization (sessions 131, 135)
✅ Driver notifications + KDS hygiene (session 129)
✅ Sundry UX fixes (sessions 125-127)

DEFERRED / NEXT-LANE CANDIDATES:
- (none — dashboard audit is fully clean, ARCH-004 closed, no
  outstanding dev lanes)

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard routes
- **All financial DB writes via RPC only** — ARCH-004 fully closed
  across all 5 order-entry surfaces. Order + payment row commit
  atomically in rpc_create_order via p_payment_mode =
  'cod' | 'online' | 'tap_card'.
- **All dashboard lifecycle writes via RPC only** — session 139
  added rpc_update_order_status / rpc_cancel_order /
  rpc_update_reservation_status / rpc_create_leave_request
  (migrations 165-167) so order status flips, reservation status
  flips, and leave request inserts all commit with their audit_logs
  row atomically. No direct `.update()` / `.insert()` against
  orders / reservations / leave_requests anywhere in the dashboard.
- AnalyticsResult<T> pattern for all analytics queries (AUD-V3-008)
- createClient() (anon) for analytics reads where RLS covers it,
  and for RPC calls that need auth.uid() / auth_user_role()
- createServiceClient() only for: matviews + RPCs without authenticated
  grant + cross-branch reads where the JS guard has already asserted
  access (e.g. pre-RPC snapshot reads in orders/actions.ts)
- x-real-ip before x-forwarded-for for rate limiting
- No console.error swallowing — Sentry via captureAnalyticsError
- Customer-facing + staff-facing error strings go through next-intl
  (localizeCheckoutError for checkout; waiter.errors namespace for
  waiter; loyalty.errors / dashboard.* for admin actions)
- Catering occasion_type / service_type persisted as enum keys, not
  locale strings (single source of truth: CATERING_OCCASION_TYPES /
  CATERING_SERVICE_TYPES in src/lib/whatsapp-catering-message.ts)
- types.ts hand-patched for new RPCs when the migration is recent —
  a later `supabase gen types typescript --linked` regen will
  overwrite cleanly because the hand-typed entries match the
  generator's shape.
- git add -p always — never stage sibling work
- Work on master directly — no worktrees unless explicitly requested

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision

## MIGRATION STATE
- Local = Remote = **167 migrations applied** (paired)
- Session 139 added: 165 (rpc_update_order_status +
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

## i18n STATE
- AR keys = EN keys = **2,457** (parity green)
- Session 139 added 12 keys: paymentsPage.title,
  paymentsPage.emptyBranch, loyalty.errors.goldMustExceedSilver,
  loyalty.errors.platinumMustExceedGold,
  dashboard.analytics_missing_title,
  dashboard.analytics_missing_description, dashboard.export_json,
  dashboard.export_success, dashboard.export_error,
  dashboard.slug_taken, dashboard.file_too_large,
  dashboard.file_format_unsupported

## SESSION HISTORY (last 5)
- Session 135: catering occasion/service enum normalization +
  migration 015 un-gitignored + waiter error localized + migration
  131 cowork DDL backfilled
- Session 136: ARCH-004 extension to table/waiter/POS (`8610587`) +
  ARCH-004 final POS card/tap atomicity (`e93c1bf` + `3a78f76`,
  migration 164) + bridge sync (`00d42aa`). ARCH-004 fully closed
  across all 5 order-entry surfaces.
- Session 137: dashboard audit prompt — 11 P0 + 23 P1 findings
  reported (no code changes).
- Session 138: 11 P0 findings landed (5 commits, `444b042` →
  `24f99f3`). All 9 phase-completion gates clean.
- Session 139 *(this session)*: 23 P1 findings landed (6 commits,
  `4691f72` → `5fd1147`) + 3 new RPCs (migrations 165/166/167,
  4 commits `7250292` → `7671239`) closing every RPC-PENDING
  marker. Master `24f99f3` → `7671239`. **Dashboard audit fully
  clean. No dev lanes outstanding.**

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
