# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-15
# Master: ceaafe8

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)
1. DNS — CNAME kahramanat.com → Vercel (B-1)
2. Supabase Free → Pro + migrate to Singapore region (B-2)
3. Turnstile keys → Vercel env vars (B-3)
4. Realtime: enable order_item_station_status in Supabase Publications (H-1)
5. Disable "Allow new signups" in Supabase Auth (H-3)
6. SENTRY_AUTH_TOKEN rotation
7. TAP keys (blocked — merchant approval pending)

## ACTIVE DEV PRIORITIES (in order)
1. operations_alerts UI — banner in dashboard/page.tsx for managers
2. AUD-V3-012 remaining 7 matviews/RPCs → grant authenticated (migration needed)
3. Birthday field + loyalty gift countdown
4. Recipe linking → suppress 158 unmapped_item alert noise
5. L1 — recovery cookie session binding (low risk, deferred)

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
