━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 17:51
Master: da5b1996a9ea8d0f1a404db35a582acba6d1d5fd
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 135 close-out)
# Master: ca61e41

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

CLOSED since session 120 bridge:
- SESSION_BIND_SECRET env var (assumed set in Vercel — dropped from
  session 135's pending list; /auth/callback recovery flow live).
- SENTRY_AUTH_TOKEN re-rotation (assumed done — dropped from session
  135's pending list; sourcemaps tagging restored).

STILL PENDING (curated from session 135 close-out):
- Supabase Free → Pro + Singapore migration.
- DNS kahramanat.com → Vercel (pre-launch only).
- TAP keys (blocked — merchant approval) → once arrived, wire Refund
  Modal (refundPayment currently flips DB state only, does NOT call
  Tap to push money back).
- 13 staff emails pending from owner → after lands, flip
  NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true.
- Resend domain verification for kahramanat.com.
- VAPID keys for driver push notifications.
- CONTACT_NOTIFY_EMAIL (optional).
- Sprint 6B WhatsApp Business API (Meta verification).
- Sprint 6C Benefit Pay API (CBB approval).
- البديع branch row DB cleanup (SQL provided session 126).
- ~11 missing dish photos (concrete shoot list in commit `da5b199`).

## ACTIVE DEV PRIORITIES

CLOSED since session 120 (sessions 121-135 — full list, in commit order):

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

DEFERRED / NEXT-LANE CANDIDATES (from session 135 close-out):
- Apply ARCH-004 atomic pattern to table/waiter/POS payment row
  inserts (POS uses rpc_pos_finalize_order — not a pure copy of
  checkout).
- Phase 7B Deliverect / POS aggregator integration (external contract).
- Phase 8 AI assistant + demand forecasting (needs 6 months data).

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard routes
- All DB writes via RPC only (atomic — ARCH-004 pattern now applied
  to checkout via rpc_create_order; remaining surfaces to follow)
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
- Local = Remote = 163 migrations applied (paired)
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
- Session 131: F-01 cookie consent + /dashboard/catering listing
  + birthday email/WhatsApp notify + dead-code cleanup
- Session 132: orders reorder button + sonner toasts + branded
  confirmation modal + account birthday save fix + Latin digits fix
- Session 133: catering form rate-limit + Turnstile + DB save UX
- Session 134: ARCH-004 atomic checkout RPC (migration 163) +
  catering form #6/#8 polish
- Session 135: catering occasion/service enum normalization +
  migration 015 un-gitignored + waiter error localized + migration
  131 cowork DDL backfilled

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
