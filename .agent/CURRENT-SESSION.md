━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 131 close-out)
Master: c4fe9a8
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 131 close-out)
# Master: c4fe9a8

## CURRENT STATUS
Launch Risk: 7/10 (unchanged — operator actions cleared session 130)
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

COMPLETED 2026-05-17 (session 130):
- SESSION_BIND_SECRET added to Vercel (Production + Preview) ✅
- SENTRY_AUTH_TOKEN rotated + added to Vercel (Production + Preview) ✅
- Vercel redeploy triggered successfully ✅

COMPLETED 2026-05-15:
- Supabase new signups disabled
- order_item_station_status added to Realtime (8→9 tables)
- Turnstile keys live (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)
- DNS kahramanat.com → Vercel

STILL PENDING:
- Supabase Free → Pro + Singapore migration
- TAP keys (blocked — merchant approval)
- Staff accounts — 13 staff emails pending from owner (blocks waiter/cashier
  activation + the QR loyalty flag flip)
- Resend domain verification for kahramanat.com (transactional email)
- VAPID keys for driver push notifications (Web Push)
- CONTACT_NOTIFY_EMAIL (optional — contact-form forwarding destination)
- After staff accounts: flip NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true per
  pre-flip checklist in `.env.example`

## ACTIVE DEV PRIORITIES (in order)

COMPLETED 2026-05-17 (session 131 — single-lane sweep):
✅ P4-1 — ForgotPasswordClient.tsx dead-code removed (c4fe9a8)
   - `src/app/[locale]/forgot-password/page.tsx` mounts `ForgotPasswordForm`
     from `@/components/auth/ForgotPasswordForm`. The sibling
     `ForgotPasswordClient.tsx` had zero references in `src/` / `app/`.
   - 144 LOC deleted, tsc clean, no i18n touched.
   - SetPasswordClient.tsx was already removed in an earlier pass —
     verified via Glob, only stale references in docs.

DEFERRED (separate sessions — none are launch blockers):
- WhatsApp/email birthday notification surface (cron + DB done, UI surface deferred)
- /dashboard/catering page (migration 160 + server action shipped; no UI)
- ~15 `as any` sites (AUD-V3-007/011) — P4 follow-up
- F-01 consent check — Chrome incognito, confirm GA/Clarity blocked pre-consent
- Extend localizeCheckoutError to remaining raw-English errors
- HIDDEN_BRANCHES cleanup follow-up (~30 redundant `length > 0` guards)

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

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision
- Recipes empty (0/168 mapped) until chef Excel lands — import surface
  shipped session 130 (P2-1); waiting on chef workbook + operator smoke-test

## MIGRATION STATE
- Local = Remote = 162 migrations applied (no new migrations this session)
- Session 131 added: 0 migrations.

## SESSION HISTORY (last 5)
- Session 119: Launch audit + 3 fixes (driver delivered, location push, stuck orders)
- Session 120: 4-priority sweep (operations_alerts banner + AUD-V3-012 close
  + birthday + recipe dedup + L1 HMAC) + Cowork customerNavUrl carry; +3 migrations
- Session 129: Points auto-cap, cart drawer fix, driver notifications, supabase
  client hardening, .env.local copied into fresh tree
- Session 130: P2-1 chef Excel recipes import, P2-2 banner actionable,
  B-001 + BUG-001 Riffa hours (closes 02:00, opens 07:00 — full fanout),
  P3-1 birthday bonus wired to UI, P3-2 QR loyalty flag audited;
  operator cleared SESSION_BIND_SECRET + SENTRY_AUTH_TOKEN
- Session 131: P4-1 ForgotPasswordClient.tsx dead-code removed (144 LOC).
  SetPasswordClient.tsx was already gone in an earlier pass.

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
