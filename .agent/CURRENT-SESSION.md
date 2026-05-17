━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 134 close-out)
Master: 22ee548
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 134 close-out)
# Master: 22ee548

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

COMPLETED 2026-05-17 (session 134):
✅ ARCH-004 atomic checkout RPC — migration 163 (be15f22 + 80f737e)
   - rpc_create_order now folds delivery_flat + initial payments row
     INSERT into the same transaction as order/items/loyalty/coupon
   - Three opt-in params (p_delivery_flat, p_payment_mode,
     p_payment_expires_at) with NULL defaults
   - Legacy 28-arg overload DROPped; new 31-arg version sole resident
   - Return type stays uuid for source-compat with 4 callers
   - Legacy callers (table, waiter, POS, POS service) unchanged — they
     pass NULL p_payment_mode and keep JS payments INSERT
   - Migration paired (Local = Remote = 163)
   - tsc clean; i18n 2,436 / 2,436; next build clean (566/566 pages)

✅ Catering audit findings #6 + #8 (22ee548)
   - #6: "Copy WhatsApp link" button on success card as popup-block
     fallback; uses navigator.clipboard.writeText with toast feedback
   - #8: noValidate on form so browser native validation balloons
     no longer leak non-localized text; server-side Zod via sonner
   - 3 new i18n keys × 2 locales (copyLink + copyLinkSuccess +
     copyLinkFailed)

DEFERRED (separate sessions, none are launch blockers):
- Resend domain verification verify smoke-test (send a birthday email
  to a test profile once Resend lights up)
- Extend localizeCheckoutError to waiter/actions.ts:222 (staff
  surface, different return shape)
- Catering occasion_type / service_type normalization (currently
  stored as locale-rendered string)
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
- Apply ARCH-004 pattern to table/waiter/POS payment row inserts (POS
  also uses rpc_pos_finalize_order — not a pure copy of checkout)

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
- Local = Remote = 163 migrations applied (paired)
- Session 130 added: none (operator + dev cleanup only)
- Session 131 added: none (dead-code cleanup)
- Session 132 added: none (P4-2 + F-01 + catering page + birthday cron)
- Session 133 added: none (docs + refactor only)
- Session 134 added: 163 (rpc_create_order atomic payment + delivery_flat)

## SESSION HISTORY (last 5)
- Session 130: P2/P3/B-001 sweep (recipes import, banner, Riffa hours, birthday card, QR scan flag)
- Session 131: P4-1 dead-code cleanup (ForgotPasswordClient.tsx removed, 144 LOC)
- Session 132: P4-2 (checkout i18n) + F-01 (consent gating) + /dashboard/catering
  + birthday notification (cron route + email + wa.me); +5 commits
- Session 133: Stale-reference cleanup (AUD-V3-007/011 docs) +
  HIDDEN_BRANCHES dead-guard removal (15 files, −123/+18 LOC); +2 commits
- Session 134: ARCH-004 atomic checkout RPC (migration 163) + catering
  form #6 popup-block fallback + #8 noValidate locale fix; +3 commits

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
