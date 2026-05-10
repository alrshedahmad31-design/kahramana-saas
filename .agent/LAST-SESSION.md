# LAST-SESSION.md — Kahramana Baghdad

> **Session**: 87 (Claude Code track — long session, ran in parallel with Gemini for analytics work)
> **Date**: 2026-05-10
> **Focus**: Loyalty discoverability end-to-end (Header button → home section → checkout nudge → SEO allow/sitemap), customer registration fix, migration 097 audit + repair of CLI sync drift, 5 security/privacy audit fixes (Sentry sampling + PII, CSP, cookie consent gating analytics, /privacy consolidation, Turnstile soft-launch), Sentry HTML meta-tag suppression, then 2 hours debugging why every deploy was failing — root cause was a single ESLint error from Gemini's analytics commit.

## Session 87 deliverables

### Loyalty system — discoverability completed end-to-end
The loyalty backend was 100% functional but had **zero UI entry points** at session start (verified via code audit). Closed every gap:
- **`feat(header) 115627c`** — customer account button. Signed-out: gold "Sign In / Register" pill (desktop) + icon (mobile) + nav-overlay link. Signed-in: pill with user icon + points + tier badge → dropdown (name, tier, balance, "My Account", "Sign Out"). Mobile top-strip is icon-only with mini tier badge corner. Reads `customer_profiles` via browser supabase client; refreshes via `onAuthStateChange`. RTL: logical properties only.
- **`feat(home) a024286`** — Kahramana Club section between ProtocolStack and HomeFAQ. Server component, follows PhilosophyManifesto styling. Title + 3 numbered cards (sign up / earn 10 pts/BD / redeem from 200 pts) + gold CTA → `/account/register`. `home.loyalty.*` keys (server-only namespace per layout's SERVER_ONLY_NS strip).
- **`feat(checkout) 6e78a76`** — gold-tinted "Sign in to earn points" card directly above Step 2 (Customer Information) when `customerProfile === null`. Same commit also bumped registration rate limit 5→10 / 15min (login stays 5; real users mistype phone/email). Operational cleanup: deleted 9 orphan `auth.users` rows (7 e2e fixtures + 2 half-registration leftovers).
- **`seo(account) 8579d3c`** — removed 5 `/account*` Disallow rules from `robots.ts`. Added `/account` (priority 0.40) and `/account/register` (0.50) to `sitemap.ts` for both ar+en with hreflang alternates. `/account/login` intentionally excluded from sitemap (per-page noindex on `/account/register/page.tsx` is intentional and was left in place — discoverability without indexing the form itself).

### Customer registration fix (`fix(auth) a0e60ac`)
"An error occurred during registration" — diagnosed via postgres logs: multiple `ERROR: AUTH_REQUIRED` entries from `rpc_create_customer_profile` (line 44 of `064_rpc_security_hardening.sql`). Root cause: Supabase email-confirmation flow does NOT create a session on signUp → no cookies → `auth.uid()` returns NULL → RPC raises AUTH_REQUIRED → error swallowed as `signup_error`. Fix: after `signUp` succeeds, insert `customer_profiles` via `createServiceClient()` using `authData.user.id` directly. Bypasses the auth.uid() gate. Self-heals existing half-registered users on retry (signUp obfuscates "user exists" and returns the existing user.id, then service-role insert fills the missing profile). Added `Sentry.captureException` at both failure points so future regressions surface.

### Migration 097 verification + repair sprint (Gemini's WIP audited and fixed)
Gemini built Labor Cost Widget + Menu Engineering Matrix in parallel session, leaving migration 097 + components untracked. Verification found:
- Migration 097 had **branch_id UUID** (project uses TEXT — silent comparison failure)
- **Missing GRANT EXECUTE** to `authenticated` (would fail at first call)
- Temp-table race condition (CREATE TEMP TABLE without ON COMMIT DROP)
- LEFT JOIN + `WHERE t.total_qty > 0` (cancels outer semantics; intended INNER JOIN)
- `total_hours` column assumed without fallback
- 3 new `as any` casts in `queries.ts` (lines 696, 714, plus `payload?: any[]` in component)

**`fix(migrations) 6f4857a`** rewrote migration 097 with all five SQL fixes + correct GRANT statements (with corrected parameter order — Gemini's spec had wrong order), applied via Supabase MCP (CLI's `db push` failed due to short-prefix vs timestamp registration mismatch — known project quirk). Dropped legacy UUID overloads via 098. Regenerated `types.ts` to include both new RPCs (150,913 chars), removed `as any` casts in queries.ts. Phase-state.json session label corrected 83 → 87.

Also a **dedicated migration-history-repair sprint** the user approved separately:
- Phase 1: `migration repair --status reverted` on 9 timestamp versions (`20260509000088`-`20260510111454`) + `--status applied` on short prefixes (088, 090, 091, 092, 093, 094, 095, 097, 098). One hiccup: `097b` rejected by CLI (non-digit suffix) — renamed file to `098_drop_legacy_uuid_overloads.sql` and re-registered.
- Phase 2: verified live schema artifacts for 085/086/087/089 (4/4 pass: restaurant_tables exists, promotions table + enum, dine_in CHECK, oiss.branch_id+created_at) → registered as applied.
- Phase 4: `migration list --linked` → all rows now show `Local | Remote` matched. `db push --linked` returns "Remote database is up to date." exit 0.

### 5 security+privacy audit fixes (`security+privacy 8d46326`)
1. **Sentry sample rates**: `tracesSampleRate 1 → 0.1` in both `sentry.server.config.ts` and `instrumentation-client.ts`. Server config: `sendDefaultPii true → false` (was auto-capturing client IPs/cookies on every event).
2. **CSP additions in middleware**: `connect-src` + Sentry endpoints (fallback if `/monitoring` tunnel ever blocked). `script-src` + `frame-src` + `https://challenges.cloudflare.com` (Turnstile — added frame-src beyond user spec because the widget renders in an iframe).
3. **Cookie consent now gates analytics** (this was the most impactful fix). New `src/components/layout/Analytics.tsx` client component reads `cookie-consent` from localStorage, listens for `cookie-consent-updated` event, only renders GA4+Clarity `<Script>` tags after accept. CookieBanner dispatches the event on accept. SSR-safe (`useState(false)` initial → server renders null). The previous behavior was that GA4+Clarity loaded on every page regardless of consent — banner was cosmetic.
4. **`/privacy` consolidated into `/privacy-policy`**: deleted `src/app/[locale]/privacy/page.tsx` (257-line duplicate). Added 2 permanent 301 redirects in `next.config.ts`. CookieBanner href updated.
5. **Cloudflare Turnstile on `/contact`**: installed `@marsidev/react-turnstile`, added widget to ContactForm, server-side `siteverify` in actions.ts. Soft-launch pattern: if `TURNSTILE_SECRET_KEY` is unset, falls back to honeypot-only — form keeps working, defense activates the moment env vars land. Ahmed has not yet provisioned the Cloudflare account or Vercel env vars (tracked as **BL-002** in `docs/qa/post-launch-backlog.md`).

### Sentry HTML meta-tag suppression (`security 4b49ba1`)
User reported `<meta name="baggage">` and `<meta name="sentry-trace">` in HTML responses exposing the git commit SHA (sentry-release) and route name on every page. Investigation confirmed `withSentryConfig` doesn't have a direct off-switch; the right knob is `autoInstrumentAppDirectory: false` (under `webpack` block), which stops App Router from creating server-side transactions → no meta tag injection. Also added `autoInstrumentServerFunctions: false` (per user spec) and `autoInstrumentMiddleware: false` (for completeness). User's spec also asked for `sentryOptionsToSend` and `hideSourceMaps` — both rejected because they're not real options in `@sentry/nextjs@10.52.0` types. Trade-off: automatic SSR/RSC performance traces are gone; error capture, manual `Sentry.startSpan()` calls, and client-side tracing continue to work.

### Build was broken for ~2 hours — single ESLint error
Email + Vercel MCP showed every commit since `30917244` (Gemini's analytics UI) failing. Local build reproduced with the exact error:

```
./src/components/analytics/AnalyticsMenuMatrix.tsx
18:13  Error: Unexpected any. Specify a different type.
@typescript-eslint/no-explicit-any
```

The project's `next build` fails on ESLint errors (warnings allowed). `tsc --noEmit` doesn't run ESLint, so `tsc clean` reports throughout the session were technically true but didn't catch this gate. **I'd flagged this exact `any[]` as "🟢 LOW priority" during the verification round** (commit message of fix calls this out for future-me). Fix `9d18db4` was a one-line replacement: `payload?: any[]` → `payload?: Array<{ payload: AnalyticsMenuEngineeringRow }>`. Vercel deploy succeeded immediately after; all 11 queued commits shipped to production in one build.

### Supabase health snapshot (post-deploy)
- Project status: ACTIVE_HEALTHY, Postgres 17.6, Tokyo region
- DB size 18.6 MB, 2 active connections
- `auth.users`: 4, `customer_profiles`: 1, active staff: 6, menu items: 168, branches: 4, restaurant_tables: 40
- Orders: 66 total, 0 today, 12 in non-terminal status — all from Ahmed's Waiter app + POS testing on May 8-9, zero real customers stuck
- Postgres logs: zero ERROR-level events in the last hour (registration AUTH_REQUIRED noise gone, fix holding)
- **Security advisors flagged 4 ERROR + 76 WARN** entries — see "Carry-overs" below

### Verification (full session)
- `npx tsc --noEmit` → 0 errors (every commit before push)
- `npm run build` → exit 0 after 9d18db4 (was failing for 2h before)
- E2E: not re-run this session
- Production `/api/health`: serving 200 with `db.ok: true`

## Carry-overs into next session

**New (from session 87) — security backlog candidates worth grading before launch:**
1. **4 SECURITY DEFINER views** — real RLS-bypass risk. `public.order_source_summary`, `public.customer_segments_view`, `public.coupon_analytics_view`, `public.v_kds_station_items` all execute with creator privileges (`postgres`). Fix: `ALTER VIEW <name> SET (security_invoker = on);` per view + UI test under RLS. Could be **BL-003**.
2. **8 `rls_policy_always_true` policies** — policies that say `USING (true)` are effectively no policy. Need enumeration + per-policy decision (intentional public-read vs missed scoping). Could be **BL-004**.
3. **22 + 22 + 16 + 6 + 1 + 1 = 68 lower-priority WARN entries** in advisors (anon/auth SECURITY DEFINER fns, search_path mutable, matview-in-API, password-leak protection disabled, public bucket listing). Tidiness sweep, not launch-blocking.

**New (from session 87) — operational items:**
4. **Provision Turnstile env vars** in Cloudflare + Vercel (BL-002) — already documented; one Cloudflare site setup + 2 Vercel env vars (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY). Until then, /contact runs honeypot-only.
5. **12 stale test orders** in non-terminal status from May 8-9 — bulk-clean before launch (or leave for QA traceability).
6. **GA4 / Clarity traffic will drop short-term** after the consent gate ships — users haven't re-consented yet. Expected, not a bug.

**Carried from session 86 (no movement this session):**
- 13 staff emails for `scripts/seed-staff.ts:54-79` (blocks migration 090 + first staff seed cycle).
- Refund modal for `code === 'refund_required'` (toast still in use).
- Legacy `kds_queue` table — post-launch cleanup candidate.
- Pre-launch QA master checklist `docs/qa/pre-launch-checklist.md` — not re-run end-to-end this session.
- **BL-001** (loyalty helpers split) — bundle-bloat smell, no security risk.

## Decisions / non-obvious notes

- **`tsc clean` ≠ build clean.** This project's `next build` runs ESLint with `no-explicit-any` configured as **error**. Running `tsc --noEmit` only does type-checking and never runs ESLint, so my "tsc clean" reports throughout the session were technically true but missed a build-blocking gate. Going forward: when reviewing code with `any` casts, treat them as build-blockers by default; downgrade to "low priority" only after confirming `.eslintrc` allows them. **A new memory has been saved capturing this.**
- **Gemini's `payload?: any[]` was flagged "LOW" in verification** — same root cause as above. Should have been HIGH the moment I saw `no-explicit-any` would be enforced.
- **Sentry's `withSentryConfig` does NOT have `sentryOptionsToSend` or `hideSourceMaps`** in v10.52.0 — both common knowledge from older docs. Always grep `node_modules/@sentry/nextjs/build/types/config/types.d.ts` before adding options.
- **Email confirmation OFF + service-role insert** is now the registration architecture — works regardless of confirmation setting. The RPC `rpc_create_customer_profile` is now effectively unused for the primary signup path; kept for any future client-side direct call.
- **Migration history repair was risky atomic-revert + apply.** One CLI parser surprise (`097b` rejected) created a window where 8 short-prefix versions were unregistered. Recovered immediately by re-running with valid IDs only. **Lesson:** when calling `migration repair` with multiple version IDs, validate each against the CLI's parser (digits only) before chaining the revert step.
- **Long deploy outage (2h) had no production impact** because Vercel keeps serving the last successful deploy on ERROR. Customers continued to see `6e78a76` throughout. UptimeRobot didn't alert because `/api/health` kept passing.

## Session 86 deliverables

### Phase-completion gates re-run
- All 8 phase-completion gates from CLAUDE.md ran clean against current `master`:

## Session 86 deliverables

### Phase-completion gates re-run
- All 8 phase-completion gates from CLAUDE.md ran clean against current `master`:
  1. `tsc --noEmit` → 0 errors
  2. `NEXT_BUILD_WORKERS=1 npm run build` → exit 0, 333+ static pages
  3. RTL violations (`pl-/pr-/ml-/mr-`) → 0
  4. Forbidden fonts → 0 (only false-positive substring matches on `Inter`val/`Inter`active)
  5. Raw hex colors → only token files (design-tokens.ts + delivery/tokens.ts)
  6. Hardcoded phones / `wa.me/` → only `src/constants/contact.ts`
  7. Currency → `KWD/SAR/USD/€/£` zero; `BD` is intended display label (gate 5 forbids only `BHD`)
  8. Service-role key in `.next/` → 20 hits in `.next/server/...` (expected); **1 hit in client bundle** (`dashboard/settings/page-*.js`) — investigated: literal `process.env.SUPABASE_SERVICE_ROLE_KEY` appears, but Next.js does not inline non-`NEXT_PUBLIC_*` env vars on the client, so the secret value itself never leaks. Logged as **BL-001** in post-launch backlog (split `src/lib/loyalty/config.ts` so client components don't drag in the supabase-js client + env reference).

### Docs touched
- **`CLAUDE.md`** — gate 7 exempt comment now lists both `src/lib/design-tokens.ts` and `src/lib/delivery/tokens.ts`; timestamp bumped to `2026-05-10 (session 86)`. Commit `022ad17`.
- **`docs/qa/post-launch-backlog.md`** — new file. First entry **BL-001** (loyalty helpers split, low severity, S effort, no security risk). Created per `pre-launch-checklist.md` §7 ("`-` fails → log for post-launch backlog"). Commit `022ad17`.

### Vercel redeploy trigger
- **Empty commit `9d1f5a8`** to force a fresh Vercel build so the GA4 + Microsoft Clarity env vars activate. No code change.

### Sentry Next.js SDK installed
- Wizard run **manually by Ahmed in PowerShell** (subprocess via Bash failed with `ERR_TTY_INIT_FAILED` — wizard cannot initialize a TTY in non-interactive parent). Commit `15e587c` — adds `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `global-error.tsx`, `sentry-example-page/`, `sentry-example-api/`, wraps `next.config.ts` with `withSentryConfig`, adds `@sentry/nextjs` to deps. Follow-up commit `70da288` pinned `import-in-the-middle@3.0.1` to resolve a Sentry × Prisma instrumentation conflict (also by Ahmed).
- Vercel env vars added by Ahmed (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` — all Sensitive, Production+Preview).
- **Auth-token rotation incident**: Ahmed initially pasted the `sntrys_*` auth token into chat (and into the `SENTRY_DSN` Vercel field by mistake). Token treated as compromised, revoked at sentry.io, replaced. The DSN field was corrected to the actual URL.

### `/api/health` upgraded from stub to real liveness probe
- **Before**: `src/app/api/health/route.ts` returned `{status:'ok', ts}` unconditionally.
- **After (commit `fc24590`)**: queries `branches` via `createServiceClient()` (head:true count:exact — cheapest possible Postgres reachability check, no rows transferred), wrapped in `Promise.race` with a 4s hard timeout. Returns 503 + JSON failure detail on DB error/timeout, 200 + status `'ok'` otherwise. Body always includes `sha` (short Vercel commit SHA), `iso` timestamp, total `latencyMs`, and `checks.db.{ok,latencyMs,error?}` for debugging. `Cache-Control: no-store` + `force-dynamic` + `runtime: 'nodejs'`.
- Defaults chosen via AskUserQuestion (Recommended on all three): DB-reachability only (no Sentry/Stripe/env-var checks), strict 503-on-failure, no auth.

### Middleware fix — `/api/*` excluded from `next-intl` matcher
- **Symptom**: `/api/health` returned 404 in production after `fc24590` deployed.
- **Root cause**: `src/middleware.ts:200` matcher pattern excluded `_next/static`, `auth`, asset extensions, etc. — but **not** `api`. So `next-intl/middleware` ran on every API route and tried to locale-prefix it (with `localePrefix: 'as-needed'`, `defaultLocale: 'ar'`), redirecting `/api/health` → `/ar/api/health` which doesn't exist.
- **Fix (commit `362e121`)**: added `api` to the negative-lookahead. Verified safe — middleware's auth/CSP/Supabase logic only ran for `/dashboard*` and `/login*` paths anyway (line 117 short-circuits everything else with no Supabase call); Sentry instrumentation runs at route-handler level, not middleware.
- **Side effect**: also un-broke `/api/webhooks/tap`, `/api/inventory/{export,template}`, `/api/sentry-example-api`. Tap webhooks would have silently 404'd in production once the payment provider started calling them — pre-launch, so no harm done.
- **Live verification**: `curl https://kahramanat.com/api/health` returns `{"status":"ok","sha":"362e121","iso":"2026-05-10T08:33:48.109Z","latencyMs":485,"checks":{"db":{"ok":true,"latencyMs":485}}}`. DB roundtrip Vercel `sin1` ↔ Supabase `ap-northeast-1` is ~485ms (well under the 4s timeout).

### Menu image audit + cleanup (-2.2 MB)
- Cross-referenced all 168 `menu_items.image_url` values against files in `public/assets/gallery/` (the actual path; `public/images/menu/` does not exist).
- **Zero items have broken image references.** All 152 unique filenames in DB exist on disk.
- **Image quality issues flagged** (not fixed this session — needs AI image generation):
  - **Priority A — misleading reuse across categories** (4 items): `pastry-cheese`/`pastry-spring-pie` show pizza images for pies; `shawarma-lebnani-meat` shows wrong bread; `main-kharof` shows quzi instead of whole lamb.
  - **Priority B — same image used by 3–5 visually-similar items** (4 clusters): `labneh-manakish.webp` ×5, `charcoal-grilled-chicken.webp` ×3, `spinach-pie.webp` ×3, `zaatar-manakish.webp` ×3.
  - **Priority C — pairs sharing one image** (~5 pairs): `arabi-meat-shawarma`, `dolma-platter`, `bahraini-lamb-quzi`, `margherita-pizza`, `meat-chapati-shawarma`, `vegetable-pizza`.
- **31 orphan files deleted** from `public/assets/gallery/`. Commit `20582e6`. Verified safe — no references in `menu_items`, `src/data/menu.json` (the live menu source imported by `src/lib/menu.ts` and `dashboard/menu/actions.ts`), or any other DB table with image-bearing columns. The root-level `menu.json` (stale seed file, not imported) DID reference some — flagged for separate cleanup. Reclaimed 2236 KB. Gallery now 1:1 with `menu_items`: 152 files / 152 unique refs.

### Verification (full session)
- `npx tsc --noEmit` → 0 errors (run after each code change).
- `NEXT_BUILD_WORKERS=1 npm run build` → exit 0.
- E2E `tests/e2e/waiter/dine-in.spec.ts --headed` → 1/1 PASS, 16.6s actual / 38.8s with 6-user setup/teardown.
- Production `/api/health` verified live: HTTP 200, sha matches deployed commit, db.ok=true, latencyMs=485.

### Decisions / non-obvious notes
- **Sentry wizard cannot run from a Bash subprocess** under Claude Code — needs a real TTY. Ahmed had to run it manually in PowerShell. Future Sentry-related setup that requires the wizard should always be run by the user via the `!` prefix or directly in their terminal.
- **Service-role key in client bundle is NOT a leak** — the literal string `process.env.SUPABASE_SERVICE_ROLE_KEY` appears in `dashboard/settings/page-*.js` because a client component imports pure helpers from `src/lib/loyalty/config.ts` (which co-locates server-only `fetchLoyaltyConfig`/`getLoyaltyConfig` with `pointsToCredit`/etc.). Next.js only inlines `NEXT_PUBLIC_*` env vars on the client, so the actual secret never ships. Pure bundle-bloat smell, tracked as BL-001.
- **`/api/health` runtime is `nodejs`** (not edge) because `createServiceClient()` uses `@supabase/supabase-js` server-side. Fluid Compute is the default — fine for the 5-min UptimeRobot interval.
- **Gallery 1:1 mapping**: 152 referenced filenames + 152 disk files. Any future menu_items insert with a new image_url will require uploading the matching .webp first or the page will 404 on `<Image>` load.
- **Stale `menu.json` at repo root** (separate from `src/data/menu.json`) is not imported by any TS file. Probably an early-development seed/spec leftover. Candidate for deletion in a separate commit; deferred this session.

## Carry-overs into next session

**New (from session 86):**
1. **UptimeRobot monitor** — Ahmed to set up the 5-min HTTPS monitor pointing at `https://kahramanat.com/api/health` with optional keyword `"status":"ok"` for second-layer alerting.
2. **Menu image regeneration** — 4 Priority-A misleading images and 4 Priority-B reused-image clusters need per-item AI-generated photos. Decide whether to use `seo-image-gen` skill (Gemini via nanobanana-mcp) or external tooling.
3. **Stale root `menu.json`** — verify nothing imports it (none found this session) and delete in its own commit.
4. **BL-001 (loyalty helpers split)** — post-launch refactor recorded in `docs/qa/post-launch-backlog.md`. Bundle-hygiene cleanup, no security or correctness urgency.

**Carried from session 85 (no movement):**
- 13 staff emails for `scripts/seed-staff.ts:54-79` still outstanding (blocks migration 090 + first staff seed cycle).
- Refund modal for `code === 'refund_required'` (introduced session 84) — toast still in use; dedicated modal not yet built.
- Legacy `kds_queue` table — post-launch cleanup candidate.
- Pre-launch QA master checklist `docs/qa/pre-launch-checklist.md` — not re-run end-to-end this session.

## Session 85 deliverables

### Types regen + cast removal
- **`src/lib/supabase/types.ts`** — regenerated via `npx supabase gen types typescript --linked --schema public`. The `Database["public"]["Enums"]["kds_station"]` union now includes the migration-093 additions (`fryer`, `cold`, `unassigned`) alongside legacy values (`grill | fry | salads | desserts | drinks | packing | shawarma | bakery | appetizer_drinks | main`). Working-tree diff vs the post-089 baseline was minimal because the canonical TS `KDSStation` union in `lib/supabase/custom-types.ts:19` already enumerated the same set.
- **`dashboard/kds/actions.ts:219`** — removed `station as never` cast on `.eq('station', station)` (was the only cast in this file; LAST-SESSION.md from session 84 said "two" but only one was on disk). Removed the 5-line comment block explaining the workaround.
- **`dashboard/menu/actions.ts`** — removed all three casts:
  - line 190 `upsert(allItems as never, …)` → `upsert(allItems, …)` + 3-line comment block
  - line 256 `insert({…} as never)` → `insert({…})` (createMenuItem)
  - line 318 `update({…} as never)` → `update({…})` (updateMenuItem)
- **Verification**: `npx tsc --noEmit` → 0 errors.
- Commits: `6a09f59` (kds + menu upsert + types regen) and `ec9f5e6` (remaining 2 menu casts — committed by Ahmed and pushed).

### E2E re-verification post-094/095
- Ran `npx playwright test tests/e2e/waiter/dine-in.spec.ts --headed` against `http://localhost:3000` on current `master` (post-migration-095 + RLS tighten).
- Result: `1 passed (37.0s)` — actual test 15.3s, plus globalSetup/globalTeardown for 6 e2e users.
- Confirms migrations 094 (KDS RLS role lockdown + canonical-5 trigger CASE + bump_station_order RPC) and 095 (cashier/kitchen removed from orders UPDATE RLS) did not regress the waiter dine-in flow with size+variant pricing (the original PRICE_MISMATCH-bypass scenario from migration 091).

### Conversation notes maintenance
- **`kahramana-conversation-master-notes.md`** — five small corrections committed in `6a09f59`:
  1. Header session label: 82 → 84.
  2. Migration 090 row in the migrations table: ✅ → ⏳ on disk (correctly reflects `phase-state.json:17`, which still lists 090 as pending until the seeder runs).
  3. Session-history table: added rows for sessions 83 and 84.
  4. Session 80 row description corrected to KDS hardening sprint (commit 215d9f1).
  5. Session 79 description set to the commit reference (215d9f1, +671/−110 across 10 files); session 82 description set to "types.ts regen, additive pricing fix (VariantPicker), migration 088 applied, QA checklist (150 items)".
- Note: section-history descriptions for sessions 79/80 and 80/82 are now near-duplicates of each other in the file. Flagged in conversation; not corrected this session — would need a fuller rewrite of the session-by-session table.

### Session 85 verification (recap)
- `npx tsc --noEmit` → 0 errors (post-cast-removal, against regenerated types).
- E2E: 1/1 PASS, 15.3s actual / 37.0s with setup/teardown.
- Build: not re-run that session — last green build was session 84 (`540 pages, 0 errors`).

## Session 84 deliverables

### Migrations (4 new, all applied to git)
- **`092_shift_closing_rls_branch_scope.sql`** — `shift_closings` insert WITH CHECK now enforces `staff_basic.branch_id = shift_closings.branch_id` for branch_manager/cashier (owner/GM unrestricted).
- **`093_kds_station_taxonomy_enum_values.sql`** — adds `'fryer'`, `'cold'`, `'unassigned'` to `kds_station` enum (separate file because PG can't use new enum values in same tx).
- **`094_kds_hardening_and_taxonomy.sql`** — RLS+RPC role lockdown (kitchen/branch_manager/GM/owner only); trigger CASE re-mapped to canonical 5 stations + `ELSE 'unassigned'`; `update_order_item_station_status` gained `p_expected_status` (CONFLICT) + transition graph; new `bump_station_order(p_order_id, p_station)` RPC verifies all-ready before completing; menu_items_sync legacy stations backfilled.
- **`095_orders_update_rls_tighten.sql`** — removed `cashier`/`kitchen` from `orders_update_non_driver_staff` USING+WITH CHECK; their mutations now go through KDS RPCs or service-role server actions only.

### Server actions hardened
- **`dashboard/audit/page.tsx`** — `requireDashboardSection('audit')` guard added (was leaking PII to any same-branch session).
- **`dashboard/shifts/actions.ts`** — full rewrite: Zod schema, `round3()` cash normalization, branch-scope assertion, typed `ShiftActionResult` with discriminant `code` (`forbidden|invalid_input|branch_scope|db_error|conflict|unknown`), `getShiftSummary` returns `{error, expectedCash, orderCount}` shape; `CloseShiftDialog.tsx` updated to read the new error discriminant.
- **`waiter/actions.ts`** — added `'waiter'` to `WAITER_ROLES`; payment + audit_logs inserts now check error and return `warning?: string` for partial-failure surface.
- **`dashboard/pos/actions.ts`** — same payment/audit insert error handling + `warning?: string` field; modifier loader fails closed on query error.
- **`dashboard/promotions/actions.ts`** — `togglePromotion` and `deletePromotion` now look up promotion's `branch_id` and assert non-global-admin caller owns it (also blocks edits to `branch_id IS NULL` global promotions for branch-scoped roles).
- **`dashboard/orders/actions.ts`** — comprehensive rewrite: `requireDashboardSection('orders')` everywhere, UUID validation, explicit field list (no `select('*')`), branch-scope on `getOrderDetails`, `canUpdateOrderStatus(...)` reused inside `updateOrderWithReason` for transition validation, optimistic concurrency via `.eq('status', current)` + `.select('id')` row-count check on both status mutations, refund-aware: `hasCapturedPayment()` blocks `cancelled`/`returned` when `payments.status='completed'` (returns `code: 'refund_required'`); typed `OrderActionErrorCode` union; audit_logs insert error surfaced via `console.error`.
- **`dashboard/orders/[id]/page.tsx`** — `requireDashboardSection('orders')` (was just `getSession + canViewOrder`), branch-scope assertion on fetched order, `notFound()` only on `PGRST116`, `throw` on any other DB error.
- **`components/orders/OrdersClient.tsx`** — new `escapeSearch()` helper escapes ilike wildcards (`%`, `_`, `\`) and strips PostgREST structural chars (`,`, `(`, `)`, `:`, `"`) before interpolation into `.or()`.
- **`driver/actions.ts`** — driver mutations now `role === 'driver'` only (was `driver|branch_manager|GM|owner`); `postDriverLocation` verifies order `assigned_driver_id`/`status='out_for_delivery'`/branch before upsert; `reportDeliveryFailure` requires `status='out_for_delivery'` for ALL callers + concurrency-pinned UPDATE; new `normalizeCashAmount()` helper validates `actualCollected` and `submitCashHandover.actualAmount`; `driverBumpOrder`/`markDriverArrived` now require `order_type='delivery'` defensively.
- **`dashboard/delivery/actions.ts`** — `unassignDriver`, `cancelDeliveryOrder`, `reassignDriver` all gained `ACTIVE_DELIVERY_STATUSES` predicate + `.eq('status', order.status)` + `.select('id')` row-count guard.

### Order_type filter parity (delivery dashboard + driver app)
- **`driver/page.tsx`** — added `.eq('order_type','delivery')` to both `readyQ` and `transitQ` queries.
- **`dashboard/delivery/page.tsx`** — replaced `.neq('order_type','pickup')` with positive `.eq('order_type','delivery')` filter.
- **`components/delivery/DeliveryPageClient.tsx`** — added `.eq('order_type','delivery')` to the realtime refresh query.

### KDS taxonomy alignment (TS layer)
- **`lib/supabase/custom-types.ts:14`** — `KDSStation` union expanded with canonical 5 (`grill | fryer | cold | drinks | desserts | unassigned`); legacy values retained for in-flight rows.
- **`constants/kds.ts`** — `STATION_CONFIG` rewritten with the canonical 5 + `unassigned`; `getStationConfig()` fallback changed from `'main'` to `'unassigned'`. Selector picks up new tiles automatically.
- **`dashboard/kds/actions.ts`** — `updateItemStatus` gained `expectedStatus?: KDSItemStatus` + client-side `ITEM_STATUS_TRANSITIONS` graph for fast-fail; `bumpStationOrder` rewired to call new `bump_station_order` RPC; station-counts query error surfaced via `console.error`.
- **`components/kds/KDSStationOrderCard.tsx:124`** — caller threads `currentStatus` as `expectedStatus`.
- Two `as never` casts at the supabase `.eq()`/`.upsert()`/`.insert()`/`.update()` boundary (`kds/actions.ts:218`, `menu/actions.ts:187/256/318`) — required until generated `Database` types are regenerated against the new enum values.

### UI: payment-warning surface
- **`components/pos/POSClient.tsx`** — `success` state extended with `warning?: string`; new amber banner in success screen when `result.warning` set, bilingual heading "⚠ يلزم تدخّل المدير" / "⚠ Manager resolution required" + server-supplied body; offline-queue catch block now classifies error (only queues on `navigator.onLine === false` or TypeError/network-like errors; auth/perm/server bugs surface as real errors).
- **`app/[locale]/waiter/table/[tableNumber]/WaiterOrderClient.tsx`** — separate `warning` state + amber banner under success.

### i18n cleanup
- Sidebar nav (`DashboardSidebar.tsx:267-285`) — wired `waiter`, `tables`, `promotions` (keys already existed in messages files).
- Replaced raw English/mixed Prep Items + Par Levels labels across 7 files with `الأصناف الجاهزة` / `صنف جاهز` / `مستويات المخزون`.
- Inventory-alerts visible AR text — added `inventory.alerts.{title, severity.*, type.*}` namespace to both messages files; `inventory/page.tsx` now uses `getTranslations` to render alert severity + type instead of raw DB strings.
- `inventory.reports.wasteEscalation` namespace — added missing `title|noPending|awaitingBm|escalatedGm` keys.
- `inventory.recipes.prepItems`/`addPrepItem` — replaced English literals in AR file.
- Delivery dashboard components (`OrderListPanel`, `OrderDetailDrawer`, `DeliveryHeader`, `DriverFleetPanel`) migrated from hardcoded Arabic to `useTranslations('delivery')` with new `delivery` namespace (~70 keys) in both messages files.

### Pre-existing TS error cleanup (Gemini parallel-edits)
At one point Gemini's wide refactor left 56 TS errors. Fixed all in this session:
- Bulk-removed `locale={...}` props passed to ReportHeader/ExportButton/AbcPieChart (those components now use `useLocale()` internally) — then added back where the receiving component still required `locale: string` (AbcUpdateButton, COGSClient, COGSBarChart, ValuationPieChart, VarianceClient, both CustomTooltip components).
- Catering pages: changed `isAr={isAr}` → `locale={locale}` for CateringStatusStepper/CateringOrderForm/CateringIngredientsDrawer.
- `colors.brand.X` → `colors.X` (the design-tokens object is flat) in MenuEngineeringMatrix/PriceHistoryChart/VendorRadarChart.
- `borderSColor` typo → `borderColor`.
- `dead-stock/page.tsx` — added missing `Link` import, removed duplicate `StatCard`/`EmptyReport` imports, added `unit?: string|null` to `DeadStockRow`.
- `expiry/page.tsx` — added `Link` import, imported `ExpiryReportRow` type.
- `valuation/ValuationCharts.tsx` + `waste/WasteCharts.tsx` — `(percent ?? 0) * 100`.
- `WasteEscalationWidget` — removed `isAr` prop pass-through (component uses `useLocale`).
- `SupplierRow` — added missing `address|lead_time_days|payment_terms|min_order_bhd|reliability_pct|notes` (notes optional in 3 places).
- `TransferForm.Ingredient.name_en` → optional with `?.toLowerCase()` chain.
- `ExpiryReportRow.unit?` added as optional.
- ESLint `any` → typed in `expiry/page.tsx:128` and `vendor/VendorRadarChart.tsx:24`.
- `loyalty-actions.ts` — removed `export { DEFAULT_LOYALTY_CONFIG }` (`'use server'` files can only export async functions).
- POS server-component `<select>` — removed no-op `onChange={(_e) => {}}` (Next.js disallows event handlers on RSC native elements; this was the underlying cause of a hydration cascade).

### Verification
- `npx tsc --noEmit` → 0 errors after each P-level + each fix batch.
- `npm run build` → PASS (full route table generated, no ESLint-blocking errors).

### Decisions / non-obvious notes
- **Dev-server stale cache**: when JSON message files are edited mid-session, Next/Turbopack hot-reloads the client bundle but server-side module cache may hold stale parsed JSON, causing transient hydration mismatches (specific symptom: server renders raw key, client renders translation). Restart `npm run dev` to clear. Don't add `setRequestLocale` in nested layouts as a "fix" — that's cargo-cult.
- **Auto-generated `Database` types lag enum migrations**: until `npx supabase gen types typescript` is rerun after migration 093, the new `kds_station` values (fryer/cold/unassigned) require `as never` casts at supabase boundaries. Casts are documented in source.
- **POS/waiter `result.warning`** is the new partial-failure shape: order committed successfully but a non-blocking record (payment row, audit log) failed. UI now shows it as an amber banner; downstream reconciliation should pick these up.
- **Refund-required flow**: `updateOrderStatus`/`updateOrderWithReason` now return `code: 'refund_required'` if `payments.status='completed'`. UI doesn't yet branch on this — currently shown via the existing toast. Future task: open a dedicated refund modal when `code === 'refund_required'`.
- **Migration 095 deployment caution**: any cashier/kitchen client doing direct `supabase.from('orders').update(...)` will start returning empty rowsets after deploy. Verified the KDS RPCs (094) cover the kitchen path and POS server actions cover the cashier path; no remaining direct-update sites in cashier/kitchen client code.
- **Drivers will lose access to dine-in/pickup orders** after fix #3 deploys (positive `order_type='delivery'` filter replaces `.neq('order_type','pickup')`). Acceptable per audit; flag if any branch was relying on drivers seeing those.

## Session 83 deliverables

## Session 83 deliverables

### Tests
- **`tests/e2e/waiter/dine-in.spec.ts`** — codifies steps 1–8 of `docs/qa/waiter-table-qa.md`. Logs in as `e2e-owner`, hits `/waiter/table/1?branch=riffa` (AR locale, desktop viewport), searches `quzi`, picks size M via `VariantPicker`, submits, asserts no PRICE_MISMATCH banner, then verifies `orders` + `order_items` (`selected_size='M'`, `unit_price_bhd=2.500`) + `order_item_station_status` rows via service-role client. Cleans up the test order + all child rows on success.
- **`playwright.config.ts`** — added `dotenv.config({ path: '.env.test' })`, `globalSetup` + `globalTeardown` hooks (previously orphaned but never wired up), env-driven `baseURL`, and a `webServer` block that auto-starts `npm run dev` when `E2E_BASE_URL` is local.
- **`.env.test`** — flipped `E2E_BASE_URL` from `https://kahramana.vercel.app` → `http://localhost:3000` per current debugging default; comment shows how to switch back.

### QA report
- **`docs/qa/waiter-table-qa.md`** — CoWork sibling agent added the retest section (vercel.app, PASS 21.3s); this session's localhost run also passed (11.5s). Steps 6–8 now PASS.

## Verification

```
✓ tests/e2e/waiter/dine-in.spec.ts (1 passed, 11.5s) — local :3000
✓ tests/e2e/waiter/dine-in.spec.ts (1 passed, 21.3s) — vercel.app (CoWork)
```

DB state after run: clean (cleanup deletes the test order + payments + items + audit + station rows).

## Carry-overs from session 82 (still pending — not touched)

**Hard prereq for staff seeding**: Ahmed pastes 13 real email addresses for the roster slots in `scripts/seed-staff.ts:54-79`. See session 82 runbook below for full sequence (apply migration 090 → regen types → tsc → seed:staff:dry → seed:staff → invitees consume magic links).

| # | Role | Branch |
|---|---|---|
| 1 | branch_manager | riffa |
| 2 | branch_manager | qallali |
| 3 | cashier | riffa |
| 4 | cashier | qallali |
| 5 | kitchen | riffa |
| 6 | kitchen | qallali |
| 7 | driver | riffa |
| 8 | driver | qallali |
| 9 | waiter | riffa |
| 10 | waiter | qallali |
| 11 | inventory_manager | riffa |
| 12 | inventory_manager | qallali |
| 13 | marketing | — |

Migration 090 still on disk only; types regen + TSC clean still depend on its apply.

---

# Session 82 — superseded notes below

> **Session**: 82 (Claude Code track)
> **Date**: 2026-05-09
> **Focus**: PRICE_MISMATCH fix for size/variant orders + staff-seeding scaffolding (paused on emails)

## Session deliverables

### Database
- **Migration 091 applied to production** — `091_rpc_price_check_size_variant_aware.sql`. Recreates `rpc_create_order` with the same signature, GRANTS, and behaviour as migration 086, except the `PRICE_MISMATCH` guard now also bypasses lines where `selected_size` or `selected_variant` is set. This was the QA blocker found in step 6 of `docs/qa/waiter-table-qa.md`. Unblocks every flow that uses VariantPicker: customer checkout, POS, QR table, waiter.
- **Migration 090 on disk, NOT yet applied** — `090_extend_staff_role_waiter.sql`. `ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'waiter'`. Apply immediately before running the staff seeder so the waiter rows in `STAFF_ROSTER` succeed.

### Code
- `src/lib/auth/rbac.ts` — added `waiter: 3` to `ROLE_RANK`; added `'waiter'` to assignable lists for owner / GM / branch_manager; added `waiter: []` to `ASSIGNABLE_BY` (waiters cannot manage other staff).
- `src/lib/auth/rbac-ui.ts` — granted `waiter` role access to `waiter` and `tables` sections (kept `cashier` on `waiter` for backward-compat).
- TSC will fail on these edits until 090 is applied + types regenerated. Sequence is documented in the runbook below.

### Scripts
- `scripts/seed-staff.ts` — idempotent seeder using `supabase.auth.admin.inviteUserByEmail()` + `staff_basic` upsert via service role. Skips invite if `auth.users` already has the email; only updates `staff_basic` on drift.
- `package.json` — added `seed:staff` and `seed:staff:dry`.

### Docs
- Pre-launch QA master checklist (`docs/qa/pre-launch-checklist.md`) was authored earlier in the session 80 thread.
- Waiter dine-in QA report (`docs/qa/waiter-table-qa.md`) — steps 1–5 PASS, step 6 FAIL on PRICE_MISMATCH (root-caused + fixed by 091); steps 7–8 SKIP pending step-6 retry.

## Verification gates

- 091 verification SQL provided in conversation: `pg_get_functiondef('rpc_create_order'::regproc::oid) ILIKE '%selected_size%'` should return `t`, and a synthetic `rpc_create_order` call with `selected_size: 'M'` and unit_price ≠ base should return a UUID (not raise).
- Once 091 is verified, re-run waiter QA step 6 → expect order created with `branch_id='riffa'`, `order_type='dine_in'`, `source='waiter'`, `table_number=1`.

## Decisions / non-obvious notes

- **091 trades safety for unblock speed.** A direct `rpc_create_order` caller could spoof `selected_size: "M"` to bypass the price guard, but this matches the trust model already used for modifiers since 083 and is gated by `auth.uid()` / RLS from migration 064. Long-term mitigation = move size/variant prices into DB tables (`menu_item_sizes`, `menu_item_variants`) and recompute server-side in `rpc_create_order`.
- **090 is intentionally on disk only.** Applying it earlier than the seeder run risks landing types/code drift if the session is interrupted. The seeder run is the natural moment to apply 090 + regen types + run TSC + run the seeder, all in one pass.
- **Waiter PWA role gating: `cashier` retained on `waiter` section.** Removing it would break existing cashiers who currently double as waiters. New dedicated waiters get the new `waiter` role.

## Pending — picks up next session

**Hard prerequisite for staff seeding**: Ahmed pastes 13 real email addresses for the roster slots in `scripts/seed-staff.ts:54-79`:

| # | Role | Branch | Slot in script |
|---|---|---|---|
| 1 | branch_manager | riffa | `TODO+bm-riffa@…` |
| 2 | branch_manager | qallali | `TODO+bm-qallali@…` |
| 3 | cashier | riffa | `TODO+cash-riffa@…` |
| 4 | cashier | qallali | `TODO+cash-qallali@…` |
| 5 | kitchen | riffa | `TODO+kit-riffa@…` |
| 6 | kitchen | qallali | `TODO+kit-qallali@…` |
| 7 | driver | riffa | `TODO+drv-riffa@…` |
| 8 | driver | qallali | `TODO+drv-qallali@…` |
| 9 | waiter | riffa | `TODO+wai-riffa@…` |
| 10 | waiter | qallali | `TODO+wai-qallali@…` |
| 11 | inventory_manager | riffa | `TODO+inv-riffa@…` |
| 12 | inventory_manager | qallali | `TODO+inv-qallali@…` |
| 13 | marketing | — | `TODO+marketing@…` |

**Run order when emails arrive:**
1. Replace TODOs in `scripts/seed-staff.ts` with real emails.
2. Apply migration 090 (SQL Editor or `npm run db:migrate:prod`).
3. Register 090 in `schema_migrations` if applied via SQL Editor.
4. `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts`.
5. `npx tsc --noEmit` — expect 0 errors after types regen.
6. `npm run seed:staff:dry` — sanity check.
7. `npm run seed:staff` — invites + inserts. Resend sends magic-link emails.
8. Each invitee opens the email, hits the link, lands logged in. First-login = magic-link auth.
9. Update `.agent/phase-state.json` to mark 090 applied + add a "production_staff_seeded" flag in `external_dependencies`.

## Other carry-overs

- **Waiter QA retest** (steps 6–8 of `docs/qa/waiter-table-qa.md`) — should be re-run by the Playwright agent now that 091 is live, before staff seeding consumes more session time.
- Legacy `kds_queue` table — still a candidate for deletion post-launch. `order_item_station_status` is canonical.
