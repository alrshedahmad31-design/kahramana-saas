━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 133 close-out)
Master: 57ac6a9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 133 close-out)
# Master: 57ac6a9

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

COMPLETED 2026-05-17 (session 133):
- ✅ CRON_SECRET set in Vercel (Production + Preview)
- ✅ Vercel redeploy triggered → birthday cron wired end-to-end

COMPLETED 2026-05-17 (session 130):
- ✅ SESSION_BIND_SECRET set in Vercel
- ✅ SENTRY_AUTH_TOKEN rotated

COMPLETED 2026-05-15:
- Supabase new signups disabled
- order_item_station_status added to Realtime (8→9 tables)
- Turnstile keys live (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)

STILL PENDING:
- Supabase Free → Pro + Singapore migration
- TAP keys (blocked — merchant approval)
- Staff accounts — 13 staff emails pending from owner
- Resend domain verification for kahramanat.com (birthday cron now
  wired but needs this for actual email delivery)
- VAPID keys for driver push notifications
- CONTACT_NOTIFY_EMAIL (optional)
- After staff accounts: flip NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true
- Send chef recipe Excel for inventory import (pending since session 38)
- البديع branch row DB cleanup (one-shot UPDATE SQL provided session 126)
- ~11 missing dish photos

## ACTIVE DEV PRIORITIES (in order)

COMPLETED 2026-05-17 (session 133 — cleanup-only):
✅ Docs cleanup (f6e403e)
   - AUD-V3-007/011 stale references marked CLOSED with commit hashes
     in .agent/LAST-SESSION.md + kahramana-conversation-master-notes.md
   - Investigation confirmed src/ already has zero `as any` casts
     (shipped earlier: f921e66 + 0f95f5a)

✅ HIDDEN_BRANCHES dead-guard removal (57ac6a9)
   - 30 unreachable `HIDDEN_BRANCHES.length > 0` branches removed
     across 15 files (analytics queries, dashboard stats, reports
     validator, owner/payments/delivery/kds/orders/reports pages,
     inventory page + widgets + catering + food-cost, OrdersClient,
     OrderStatsBar)
   - Net −123 / +18 LOC
   - const HIDDEN_BRANCHES + isHiddenBranch() + BRANCH_LIST.filter
     retained as no-ops (in case a branch is hidden again)
   - tsc clean; next build clean (566/566 pages)

DEFERRED (separate sessions, none are launch blockers):
- Resend domain verification verify smoke-test (send a birthday email
  to a test profile once Resend lights up)
- Extend localizeCheckoutError to waiter/actions.ts:222 (staff
  surface, different return shape)
- Catering audit findings #6 (no email fallback) + #8 (HTML5
  validation balloon doesn't follow next-intl locale)
- Catering occasion_type / service_type normalization (currently
  stored as locale-rendered string)
- ARCH-004 atomic checkout RPC
- Sprint 6B WhatsApp Business API (Meta verification)
- Sprint 6C Benefit Pay API (CBB approval)
- Inventory page banner: "0/168 recipes mapped — chef Excel import
  pending" (operator visibility)
- Chef Excel recipe import — root-cause fix for 168/168 unmapped
  (pending since session 38; alert flood is dedup-suppressed but
  inventory deduction is no-op for live orders)
- Migration 015 gitignore issue (copied by hand into fresh tree)
- Migration 131 cowork diff verification
- Once Tap keys arrive: Refund Modal (refundPayment currently flips
  DB state only; does NOT call Tap to push money back)

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard routes
- All DB writes via RPC only (atomic)
- AnalyticsResult<T> pattern for all analytics queries (AUD-V3-008)
- createClient() (anon) for analytics reads where RLS covers it
- createServiceClient() only for: matviews + RPCs without authenticated grant
- x-real-ip before x-forwarded-for for rate limiting
- No console.error swallowing — Sentry via captureAnalyticsError
- git add -p always — never stage sibling work
- Work on master directly — no worktrees unless explicitly requested
- HIDDEN_BRANCHES retained as empty BranchId[] — if a branch ever
  needs hiding again, add its id to the array AND restore the
  `.length > 0` guard at relevant query sites

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision
- Recipes empty (0/168 mapped) until chef Excel lands — alert flood
  is suppressed (dedup), but inventory deduction is no-op for live orders

## MIGRATION STATE
- Local = Remote = 162 migrations applied (paired)
- Session 130 added: none (operator + dev cleanup only)
- Session 131 added: none (dead-code cleanup)
- Session 132 added: none (P4-2 + F-01 + catering page + birthday cron)
- Session 133 added: none (docs + refactor only)

## SESSION HISTORY (last 5)
- Session 129: Points cap UX + cart drawer fix + driver UX + supabase client hardening
- Session 130: P2/P3/B-001 sweep (recipes import, banner, Riffa hours, birthday card, QR scan flag)
- Session 131: P4-1 dead-code cleanup (ForgotPasswordClient.tsx removed, 144 LOC)
- Session 132: P4-2 (checkout i18n) + F-01 (consent gating) + /dashboard/catering
  + birthday notification (cron route + email + wa.me); +5 commits
- Session 133: Stale-reference cleanup (AUD-V3-007/011 docs) +
  HIDDEN_BRANCHES dead-guard removal (15 files, −123/+18 LOC); +2 commits

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
