# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 136 close-out + operator follow-ups)
# Master: 3a78f76

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational  →  **dev work complete; only operator actions remain**
Next milestone: Soft-launch (cash-only)

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

CLOSED this session (136):

✅ ARCH-004 extension to table/waiter/POS — atomic payment row (`8610587`)
   - table/, waiter/, POS service: `p_payment_mode='cod'` on
     rpc_create_order; dropped JS payments insert.
   - dashboard/pos/: left with ARCH-004-SKIP comment because
     p_payment_mode didn't support 'tap_card' for card/tap.

✅ ARCH-004 final — POS card/tap atomicity (`e93c1bf` + `3a78f76`, migration 164)
   - rpc_create_order: extended p_payment_mode with 'tap_card' branch
     (method='tap_card', status='pending').
   - rpc_pos_finalize_order: 8-arg → 5-arg audit-only; payment INSERT
     stripped. DROP-then-CREATE pattern from migration 135.
   - dashboard/pos/actions.ts: paymentMode = 'cod' | 'tap_card' →
     rpc_create_order; finalize call now audit args only.
   - ARCH-004 is fully closed across all 5 order-entry surfaces.

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

DEFERRED / NEXT-LANE CANDIDATES:
- (none — all candidates landed in session 136)

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard routes
- **All financial DB writes via RPC only** — ARCH-004 fully closed across
  all 5 order-entry surfaces (checkout, table, waiter, POS, POS service).
  Order + payment row commit atomically in rpc_create_order via
  p_payment_mode = 'cod' | 'online' | 'tap_card'.
- AnalyticsResult<T> pattern for all analytics queries (AUD-V3-008)
- createClient() (anon) for analytics reads where RLS covers it
- createServiceClient() only for: matviews + RPCs without authenticated grant
- x-real-ip before x-forwarded-for for rate limiting
- No console.error swallowing — Sentry via captureAnalyticsError
- Customer-facing + staff-facing error strings go through next-intl
  (localizeCheckoutError for checkout; waiter.errors namespace for waiter)
- Catering occasion_type / service_type persisted as enum keys, not
  locale strings (single source of truth: CATERING_OCCASION_TYPES /
  CATERING_SERVICE_TYPES in src/lib/whatsapp-catering-message.ts)
- git add -p always — never stage sibling work
- Work on master directly — no worktrees unless explicitly requested

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision

## MIGRATION STATE
- Local = Remote = 164 migrations applied (paired)
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

## SESSION HISTORY (last 5)
- Session 132: orders reorder button + sonner toasts + branded
  confirmation modal + account birthday save fix + Latin digits fix
- Session 133: catering form rate-limit + Turnstile + DB save UX
- Session 134: ARCH-004 atomic checkout RPC (migration 163) +
  catering form #6/#8 polish
- Session 135: catering occasion/service enum normalization +
  migration 015 un-gitignored + waiter error localized + migration
  131 cowork DDL backfilled
- Session 136: ARCH-004 extension to table/waiter/POS (`8610587`) +
  ARCH-004 final POS card/tap atomicity (`e93c1bf` + `3a78f76`,
  migration 164) + bridge sync (`00d42aa`). ARCH-004 fully closed
  across all 5 order-entry surfaces. **All dev work complete.**

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only
