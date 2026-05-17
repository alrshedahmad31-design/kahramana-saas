━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 135 close-out)
Master: ca61e41
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 135 close-out)
# Master: ca61e41

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

COMPLETED 2026-05-17 (session 135):
✅ Catering occasion_type + service_type enum normalization (aa2bffa)
   - Form <option value> now binds the enum key (`familyFeast`, `pickup`…)
     instead of the locale-rendered translation; display text via t()
     unchanged so users see no visual difference
   - Zod action validates with z.enum(CATERING_OCCASION_TYPES /
     SERVICE_TYPES); DB persists the enum key (column stays TEXT, no
     migration needed)
   - Dashboard CateringInquiriesList translates the stored key back via
     dashboard.catering.{occasionTypes,serviceTypes}.x; legacy
     locale-string rows render as-is via typeguard fallback
   - wa.me message body still localized — form passes an enum→label map
     in whatsappCopy so customer's WhatsApp text reads naturally
   - Single source of truth: CATERING_OCCASION_TYPES /
     CATERING_SERVICE_TYPES exported from
     src/lib/whatsapp-catering-message.ts
   - i18n parity 2,436 → 2,445 (+18 keys × 2 locales — dashboard maps
     + occasionType/serviceType WhatsApp labels)

✅ Migration 015 unblocked from gitignore + credential redacted (27e1a98)
   - 015_production_admin.sql was gitignored because it contained the
     hardcoded admin password; fresh clones hit a migration-numbering
     gap (014 → 016)
   - Hardcoded credential replaced with a runtime-setting placeholder
     (`current_setting('app.admin_password', true)`); migration RAISEs
     if the placeholder is reached on a fresh DB without a >=12 char
     password supplied
   - Production already has the admin user → the INSERT-into-auth.users
     branch is unreachable in prod, placeholder never consumed there
   - .gitignore entry removed; file is now tracked

✅ Waiter orderCreationFailed localized (f9bb840)
   - waiter/actions.ts:222 was leaking a raw English literal ('Order
     creation failed') or, when rpcError existed, the raw Postgres
     message (with sentinel codes like `insufficient_stock`) into the
     staff UI — both bypassed next-intl on the Arabic locale
   - Now uses `getTranslations('waiter.errors').orderCreationFailed`;
     underlying rpcError is logged for Sentry / ops
   - New keys in waiter.errors namespace (ar + en); parity stays green

✅ Migration 131 cowork backfill — real REVOKE PUBLIC EXECUTE DDL (ca61e41)
   - Migration 131 was applied to remote via cowork branch (commit
     26c059e) but only a 1-line placeholder ever landed in the repo;
     fresh clones would have PUBLIC retaining EXECUTE on every public.rpc_*
     function — measurably weaker than prod (0/30 verified via aclexplode)
   - DDL backfilled from live ACLs (`wwmzuofstyzworukfxkt`); single DO
     block loops over pg_proc by name so:
       * Signature drift (rpc_create_order has 4+ versions since 131)
         is handled — all overloads of a name are revoked together
       * Functions created in later migrations (rpc_close_shift /
         rpc_pos_finalize_order / rpc_refund_payment in 138,
         rpc_restore_redeemed_loyalty_points in 141) are silently
         skipped — they get their own REVOKE in the migration that
         creates them
       * Re-running is a Postgres no-op
   - Verified live: executing the new DO block against
     wwmzuofstyzworukfxkt left state unchanged at 0/30 PUBLIC EXECUTE
   - schema_migrations.statements entry still has the old placeholder
     — this backfill matters for fresh-clone parity + source-of-truth,
     not for production drift

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

✅ Catering audit findings #6 + #8 (22ee548)
   - #6: "Copy WhatsApp link" button on success card as popup-block
     fallback; uses navigator.clipboard.writeText with toast feedback
   - #8: noValidate on form so browser native validation balloons
     no longer leak non-localized text; server-side Zod via sonner

DEFERRED (separate sessions, none are launch blockers):
- Resend domain verification verify smoke-test (send a birthday email
  to a test profile once Resend lights up)
- Sprint 6B WhatsApp Business API (Meta verification)
- Sprint 6C Benefit Pay API (CBB approval)
- Inventory page banner: "0/168 recipes mapped — chef Excel import
  pending" (operator visibility)
- Chef Excel recipe import — root-cause fix for 168/168 unmapped
  (pending since session 38; alert flood is dedup-suppressed but
  inventory deduction is no-op for live orders)
- Once Tap keys arrive: Refund Modal (refundPayment currently flips
  DB state only; does NOT call Tap to push money back)
- Apply ARCH-004 pattern to table/waiter/POS payment row inserts (POS
  also uses rpc_pos_finalize_order — not a pure copy of checkout)
- Phase 7B Deliverect / POS aggregator integration (external contract)
- Phase 8 AI assistant + demand forecasting (needs 6 months data)

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
- Enum-keyed DB columns over locale-rendered strings — store enum keys,
  translate via i18n at the read surface (catering occasion/service
  set the precedent — session 135)

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision
- Recipes empty (0/168 mapped) until chef Excel lands — alert flood
  is suppressed (dedup), but inventory deduction is no-op for live orders

## MIGRATION STATE
- Local = Remote = 163 migrations applied (paired)
- Session 131 added: none (dead-code cleanup)
- Session 132 added: none (P4-2 + F-01 + catering page + birthday cron)
- Session 133 added: none (docs + refactor only)
- Session 134 added: 163 (rpc_create_order atomic payment + delivery_flat)
- Session 135 added: none (file-content backfill of 131 placeholder
  + 015 redaction + un-gitignore; schema unchanged on remote)

## SESSION HISTORY (last 5)
- Session 131: P4-1 dead-code cleanup (ForgotPasswordClient.tsx removed, 144 LOC)
- Session 132: P4-2 (checkout i18n) + F-01 (consent gating) + /dashboard/catering
  + birthday notification (cron route + email + wa.me); +5 commits
- Session 133: Stale-reference cleanup (AUD-V3-007/011 docs) +
  HIDDEN_BRANCHES dead-guard removal (15 files, −123/+18 LOC); +2 commits
- Session 134: ARCH-004 atomic checkout RPC (migration 163) + catering
  form #6 popup-block fallback + #8 noValidate locale fix; +3 commits
- Session 135: Catering occasion/service enum normalization +
  migration 015 un-gitignored + waiter error localized + migration 131
  cowork backfill (real DDL replaces placeholder); +4 commits

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
