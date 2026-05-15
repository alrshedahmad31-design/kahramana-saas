# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-16
# Master: 780feb7

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

COMPLETED 2026-05-15:
- Supabase new signups disabled
- order_item_station_status added to Realtime (8→9 tables)
- Turnstile keys live (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)
- SENTRY_AUTH_TOKEN rotated (deployment 6F9Nps8SG)

STILL PENDING:
- Supabase Free → Pro + Singapore migration
- DNS kahramanat.com → Vercel (pre-launch only)
- TAP keys (blocked — merchant approval)

## ACTIVE DEV PRIORITIES (in order)

COMPLETED 2026-05-16:
✅ Priority #1 — operations_alerts banner (780feb7)
   - OperationsAlertsBanner component (severity styles, dismiss, +N more)
   - markAlertRead server action (role-gated, RLS-scoped)
   - Dashboard page fetches for owner/GM/BM only
   - i18n AR/EN with ICU plural

UPDATED DEV PRIORITIES:
1. AUD-V3-012 — 7 matviews/RPCs → grant authenticated (migration 151)
2. Birthday field + loyalty gift countdown
3. Recipe linking → suppress 158 unmapped_item alerts
4. L1 — recovery cookie (low risk, deferred)

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
- AUD-V3-012: 7 functions remain on service-role (matviews, no authenticated grant)

## MIGRATION STATE
- Local = Remote = 150 migrations applied
- Migration 131: placeholder committed (cowork branch)
- Migration repair: 125/129/130/139-144 applied

## SESSION HISTORY (last 5)
- Session 115: HSTS verified + anon EXECUTE re-audit (9 revoked, migration 149)
- Session 116: AUD-V3-008 closed — 20 analytics error swallow sites → AnalyticsResult<T>
- Session 117: AUD-V3-012 partial — 9/16 swapped to anon client
- Session 118: H-2 hydration fix — global-error.tsx reads locale from cookie
- Session 119: Launch audit + 3 fixes (driver delivered, location push, stuck orders)

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only
