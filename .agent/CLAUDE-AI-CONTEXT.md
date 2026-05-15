# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-16 (session 120 close-out)
# Master: 81eb296

## CURRENT STATUS
Launch Risk: 8/10
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

COMPLETED 2026-05-15:
- Supabase new signups disabled
- order_item_station_status added to Realtime (8→9 tables)
- Turnstile keys live (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)
- ~~SENTRY_AUTH_TOKEN rotated (deployment 6F9Nps8SG)~~ — REGRESSED, see below

STILL PENDING:
- Supabase Free → Pro + Singapore migration
- DNS kahramanat.com → Vercel (pre-launch only)
- TAP keys (blocked — merchant approval)

ADDED 2026-05-16 (session 120):
- SESSION_BIND_SECRET env var (Vercel prod + preview).
  Generate: `openssl rand -hex 32`
  Without this, /auth/callback recovery flow throws at runtime
  (L1 commit 81eb296 enforces it via getSecret()).

- SENTRY_AUTH_TOKEN re-rotation needed (REGRESSED from 2026-05-15).
  Symptom: `cef2850` deploy logs (02:30) show Sentry CLI 401 "Invalid token"
  on `releases new` and `sourcemaps upload` across Node/Edge/Client runtimes.
  Build itself succeeded (562/562 pages); only release tagging + sourcemap
  upload failed → prod stack traces will be minified until token is fixed.
  Fix path:
    1. New token at https://sentry.io/settings/account/api/auth-tokens/
       Scopes: project:releases, org:read, project:read
    2. Vercel → kahramana → env vars → SENTRY_AUTH_TOKEN (Production + Preview)
    3. Redeploy (or wait for next push to trigger a fresh build)
  Not a launch blocker — observability is degraded, not the deploy itself.

## ACTIVE DEV PRIORITIES (in order)

COMPLETED 2026-05-16 (session 120 — full sweep):
✅ operations_alerts banner (780feb7)
   - OperationsAlertsBanner: severity styles, dismiss, +N more
   - markAlertRead server action (role-gated, RLS-scoped)
   - Owner/GM/BM only on dashboard home
   - i18n AR/EN with ICU plural

✅ AUD-V3-012 — analytics least-privilege CLOSED (af87d85, migration 151)
   - GRANT SELECT on hourly_order_distribution / menu_item_performance /
     customer_lifetime_value matviews to authenticated
   - GRANT EXECUTE on get_labor_cost_metrics + get_menu_engineering_matrix
   - 6 queries.ts callers swapped: createServiceClient() → createClient()
   - refresh_analytics_views kept service-role (admin maintenance, intentional)
   - 16/16 analytics queries now follow least-privilege

✅ Birthday field + countdown (572704c, migration 152)
   - birthday DATE column on customer_profiles
   - BirthdayGiftCard: countdown mode + empty-state CTA
   - Gift mechanic deferred (cron + idempotency table = follow-up)

✅ customerNavUrl Cowork carry (7bc0a37)
   - goo.gl passthrough, PWA-native maps URL, freetext geocode guard,
     coord regex tightened (≥4 decimals)
   - Source: dirty diff in relaxed-sutherland-1e8f48 worktree (no commit
     existed — applied via git apply, worktree later removed)

✅ Recipe linking dedup (9b35f92, migration 153)
   - 24h dedup gate added to fn_inventory_reserve unmapped_item INSERT
   - 158 unread alerts bulk-marked read; 364 audit rows preserved
   - Functional index on metadata->>'menu_item_slug' for fast dedup
   - NOTE: recipes table is empty (0/168 menu items mapped) — chef Excel
     import has been pending since session 38 (May 1). This is the
     noise-suppression operational fix; root cause unaddressed.

✅ L1 recovery cookie HMAC binding (81eb296)
   - signRecoveryCookie / verifyRecoveryCookie helper using
     HMAC-SHA256 + timingSafeEqual (Node built-ins, no new deps)
   - Cookie value: <user_id>.<base64url-hmac>
   - /auth/callback signs cookie with freshly exchanged user_id
   - /set-password rejects cross-user cookie with new error code
     'recovery_user_mismatch' instead of silently rotating wrong account
   - i18n key auth.setPassword.recoveryUserMismatch added (ar+en)
   - REQUIRES SESSION_BIND_SECRET env var in Vercel (see operator section)

DEFERRED (separate sessions):
- Birthday gift cron + idempotency + loyalty_config.birthday_bonus_points
- WhatsApp/email birthday notification surface
- Chef Excel recipe import — root-cause fix for 168/168 unmapped
  (pending since session 38, blocks meaningful inventory deduction)
- Inventory page banner: "0/168 recipes mapped — chef Excel import pending"
  (operator visibility once dedup hides the alert flood)
- SetPasswordClient.tsx dead-code cleanup (deferred since session 101 —
  page mounts SetPasswordForm; SetPasswordClient is orphaned)

UPDATED DEV PRIORITIES:
All four named priorities for 2026-05-16 are done. Next lane TBD —
candidates: birthday cron follow-up, inventory page banner, chef Excel
import nudge, dead-code cleanup. None are blockers for soft-launch.

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
- Recipes empty (0/168 mapped) until chef Excel lands — alert flood
  is suppressed (dedup), but inventory deduction is no-op for live orders

## MIGRATION STATE
- Local = Remote = 153 migrations applied
- Session 120 added: 151 (analytics grants), 152 (customer birthday),
  153 (unmapped_item dedup)
- Migration 131: placeholder committed (cowork branch)
- Migration repair: 125/129/130/139-144 applied

## SESSION HISTORY (last 5)
- Session 116: AUD-V3-008 closed — 20 analytics error swallow sites → AnalyticsResult<T>
- Session 117: AUD-V3-012 partial — 9/16 swapped to anon client
- Session 118: H-2 hydration fix — global-error.tsx reads locale from cookie
- Session 119: Launch audit + 3 fixes (driver delivered, location push, stuck orders)
- Session 120: 4-priority sweep (operations_alerts banner + AUD-V3-012 close
  + birthday + recipe dedup + L1 HMAC) + Cowork customerNavUrl carry; +3 migrations

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only
