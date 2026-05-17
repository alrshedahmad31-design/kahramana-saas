━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 130 close-out)
Master: e7ab0cb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 130 close-out)
# Master: e7ab0cb

## CURRENT STATUS
Launch Risk: 7/10 (down from 8/10 — operator actions cleared)
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
- Staff accounts (waiter/cashier) — external dependency
- After staff accounts: flip NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true

## ACTIVE DEV PRIORITIES (in order)

COMPLETED 2026-05-17 (session 130 — full sweep):
✅ P2-1 — Chef Excel recipes import (786f549)
   - /dashboard/inventory/recipes/import route, owner/GM/inventory_manager
   - Single-sheet workbook: menu_item_slug | ingredient_id | quantity_used | unit
   - analyze pass validates against menu_items_sync + ingredients (dup detect)
   - import pass writes via service-role + audit_logs source='chef_excel_import'

✅ P2-2 — Inventory mapped-recipes banner (d5da803)
   - RecipesBannerClient gained importHref + CTA <Link>
   - Role gate: owner/GM/inventory_manager (dropped branch_manager)
   - Trigger: menuItemsCount > 0 && recipesCount < menuItemsCount
   - Mapped count = DISTINCT menu_item_slug (not raw row count)
   - i18n: recipesBanner.title reworded + recipesBanner.cta added

✅ B-001 — Riffa closing 01:00 → 02:00 (bfc18cd)
   - All surfaces: contact.ts, branches.ts, ar/en.json FAQ, llms.txt, docs

✅ P3-1 — BirthdayGiftCard reads bonus from loyalty_config (34e2da2)
   - Migration 158 (already shipped) provided the column + cron + RPC
   - LoyaltyConfig type + getLoyaltyConfig extended; cache key v1 → v2
   - Account page fetches config and passes bonusPoints
   - i18n {points} placeholder in all three states (countdown/today/prompt)

✅ P3-2 — QR Loyalty scan flag audit + activation comment (256b35e)
   - Flag stays OFF — staff accounts not yet activated
   - Off-path verified clean: scan button + modal mount + scannedMember
     all dead branches; lookupMemberByQR exposed but inert
   - Migration 162 confirmed applied on remote
   - Added inline activation comment next to flag definition

✅ BUG-001 — Riffa isOpen() at 10:55 AM (e7ab0cb)
   - isOpen logic was CORRECT (cross-midnight handled via Intl.DateTimeFormat
     in Asia/Bahrain). Root cause was stale data: opens=19:00 should have
     been 07:00. BRANCH_CONTACTS.md (operator source-of-truth) had always
     said "Daily 7:00 AM - 2:00 AM". B-001 fixed closes but missed opens.
   - Fanout: contact.ts opens 19:00→07:00, hours.ar/en, branches.ts
     opens_display, ar/en.json FAQ, llms.txt, docs/branches.md

DEFERRED (separate sessions — none are launch blockers):
- WhatsApp/email birthday notification surface (cron + DB done, UI surface deferred)
- /dashboard/catering page (migration 160 + server action shipped; no UI)
- SetPasswordClient.tsx dead-code cleanup (orphaned since session 101)
- ~15 `as any` sites (AUD-V3-007/011)
- F-01 consent check — Chrome incognito, confirm GA/Clarity blocked pre-consent
- Extend localizeCheckoutError to remaining raw-English errors

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
  now shipped (P2-1); waiting on chef workbook + operator smoke-test

## MIGRATION STATE
- Local = Remote = 162 migrations applied (no new migrations this session)
- Session 130 added: 0 migrations. P3-1 used the already-shipped migration 158.

## SESSION HISTORY (last 5)
- Session 117: AUD-V3-012 partial — 9/16 swapped to anon client
- Session 118: H-2 hydration fix — global-error.tsx reads locale from cookie
- Session 119: Launch audit + 3 fixes (driver delivered, location push, stuck orders)
- Session 120: 4-priority sweep (operations_alerts banner + AUD-V3-012 close
  + birthday + recipe dedup + L1 HMAC) + Cowork customerNavUrl carry; +3 migrations
- Session 129: Points auto-cap, cart drawer fix, driver notifications, supabase
  client hardening, .env.local copied into fresh tree
- Session 130: P2-1 chef Excel recipes import, P2-2 banner actionable,
  B-001 + BUG-001 Riffa hours (closes 02:00, opens 07:00 — full fanout),
  P3-1 birthday bonus wired to UI, P3-2 QR loyalty flag audited

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
