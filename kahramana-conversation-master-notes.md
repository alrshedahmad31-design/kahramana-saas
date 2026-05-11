# Kahramana Baghdad — Conversation Master Notes

**Generated:** 2026-05-11 (Session 88)
**Language:** Arabic-first
**Purpose:** Consolidated Markdown record of this conversation: decisions, prompts, architecture notes, implementation guidance, risks, integrations, and next steps for the Kahramana Baghdad website/platform project.

> ملاحظة: هذا الملف ليس تفريغًا حرفيًا لكل كلمة في المحادثة، بل نسخة تنفيذية منظمة تجمع ما تم الاتفاق عليه وما تم توليده من برومبتات وقرارات تقنية وتشغيلية.

---

## 1. Project Context

مطعم **كهرمانة بغداد** لديه موقع قائم، وكانت الطلبات تتم أساسًا عبر WhatsApp. الهدف من المشروع هو تحويل الموقع إلى منصة طلبات وتشغيل احترافية تشمل:

- موقع فخم وسريع ومناسب للهواتف.
- منيو منظم وتجربة طلب كاملة.
- Checkout مع WhatsApp fallback في البداية.
- Dashboard للطلبات.
- KDS متعدد المحطات للمطبخ.
- Staff Management وRBAC.
- Driver PWA.
- Loyalty + Coupons.
- Inventory (Phase 3 — complete).
- Manual POS لطلبات الهاتف والـ Walk-in.
- Waiter App PWA لخدمة الطاولات.
- QR Ordering للزبائن من الطاولة.
- Promotion Engine للعروض والخصومات.
- Waitlist Management للطاولات.
- Payments, Analytics, AI (future phases).

الفروع المعتمدة:

| الفرع | الحالة |
|---|---|
| الرفاع | Active |
| قلالي | Active |
| البديع | Hidden (platform-wide, code-level filter) |

---

## 2. Latest Project Status (Session 88 — 2026-05-11)

### Completed Phases

- ✅ **Phase 0 — Discovery**
- ✅ **Phase 1 — Foundation** — 56 files
- ✅ **Phase 2 — Security + KDS** — 20 files
- ✅ **Phase 3 — Inventory** — complete with full audit fixes
- ✅ **Phase 4 — Driver PWA** — 10 files (real-time GPS + Leaflet maps)
- ✅ **Phase 5 — Loyalty + Coupons** — 28 files (incl. redemption on checkout + customer-facing discoverability)
- ✅ **Phase 6 — Payment Infrastructure** — Tap integration scaffolded
- ✅ **Phase 6b — Dashboard Inventory Widgets** — 4 widgets + Realtime alerts
- ✅ **Phase 7 — Analytics & Reporting** — including Labor Cost gauge + Menu Engineering Matrix (session 87, Gemini)
- ✅ **Security Hardening** — 14 Critical fixes + clock_pin hashing + comprehensive sessions 84/87 sweeps
- ✅ **Manual POS** — full system with item notes, branch scope, hydration-safe CSS Module
- ✅ **KDS Multi-Station** — 5 canonical stations (grill/fryer/cold/drinks/desserts) with Realtime + full audit fixes
- ✅ **Menu Management** — full CRUD with AR/EN editor + DB-first architecture
- ✅ **Out of Stock Toggle** — real-time, customer menu filtered
- ✅ **Audit Log Viewer** — owner/GM only, section guard added
- ✅ **End of Shift Closing** — with discrepancy detection + GM branch selector + Zod validation
- ✅ **Mobile Bottom Nav** — floating capsule, customer pages only
- ✅ **Competitive Gaps Closed** — image upload, offline POS queue, menu modifiers, ESC/POS receipt, configurable loyalty
- ✅ **Waiter App PWA** — table-aware ordering, dine_in type, POS-style layout
- ✅ **QR Ordering** — `/table/[branchId]/[tableNumber]`, guest flow, QR PNG generation
- ✅ **Promotion Engine** — 5 types, wired into all 4 order paths
- ✅ **Waitlist Management** — `/dashboard/waitlist` with real-time channel + WhatsApp notify (session 88, Gemini)
- ✅ **Loyalty Discoverability** — Header customer button, home Kahramana Club section, checkout sign-in nudge, robots/sitemap allow (session 87)
- ✅ **Customer Registration** — service-role insert pattern bypassing auth.uid() gate (session 87 fix)
- ✅ **`/api/health` Liveness Probe** — Promise.race 4s timeout, DB reachability via head:true count (session 86)
- ✅ **5 Security+Privacy Audit Fixes** — Sentry sampling+PII, CSP, cookie consent gating analytics, /privacy consolidation, Turnstile soft-launch (session 87)
- ✅ **Sentry SDK** — installed by Ahmed via PowerShell wizard, HTML meta-tag suppression applied (session 86–87)
- ✅ **Production Deployment** — Vercel; intended hostname `https://kahramanat.com` BUT see § 2.5 below

### Build Statistics (Session 88)

| Metric | Value |
|---|---:|
| Pages | 540+ static |
| Build errors | 0 |
| TSC errors | 0 |
| ESLint warnings | a few unused vars (non-blocking) |
| Migrations applied | 088–099 |
| Last commit (master) | `50cc17f` — chore: session 88 final close |
| Last code commit | `3ec0982` — fix(tokens): replace amber/yellow tailwind classes with brand design tokens |
| CLAUDE.md gates passing | 7 of 7 active (1 tsc, 2 RTL, 3 fonts, 4 colors, 6 phones, 7 hex; gate 8 i18n WARN) |

### Pending / In Progress

- ⏳ **Staff accounts seeding** — migration 090 ready, `scripts/seed-staff.ts` ready, **still waiting on 13 emails from restaurant owner** (carry-over since session 82)
- ⏳ **Tap payment** — waiting on merchant account (Ahmed)
- ⏳ **WhatsApp Business API** — blocked on Meta verification
- ⏳ **Benefit Pay** — blocked on CBB approval (2–4 months)
- ⏳ **Cloudflare Turnstile env vars** — `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` not yet provisioned; `/contact` runs honeypot-only until then (BL-002)
- ⏳ **kahramanat.com DNS / Cloudflare routing** — see § 2.5 below
- ⏸️ **Phase 7b — Deliverect/POS** — blocked on contract
- 🔒 **Phase 8 — AI Features** — requires 6 months real data

### Pre-Launch Checklist Status

| Item | Status |
|---|---|
| QA checklist doc (197 items) | ✅ Created `docs/qa/pre-launch-checklist.md` |
| Machine-verifiable QA pass (Vercel URL) | ✅ Session 88 — 7/7 gates clean, 11/11 marketing routes 200/200, sitemap 394 URLs, i18n 1944/1944 |
| Waiter E2E QA (steps 6–8) | ✅ PASS (migration 091 verified) |
| Staff accounts (13) | ⏳ Awaiting emails |
| Legal pages | ✅ /privacy-policy /terms /refund-policy live and in sitemap |
| Missing images (~11) | ⏳ Content + 4 Priority-A misleading + 4 Priority-B reused-image clusters flagged session 86 |
| PDF staff guides | ⏳ Handover |
| Delete `kds_queue` legacy table | 🟢 Low priority |
| UptimeRobot 5-min monitor on /api/health | ⏳ Pending (depends on hostname routing fix) |
| Stale root `menu.json` cleanup | 🟢 Low priority — verified no imports session 86 |
| BL-001 (loyalty helpers split) | 🟢 Bundle hygiene only — `docs/qa/post-launch-backlog.md` |

### 2.5 — kahramanat.com routing issue (CRITICAL)

Discovered during session 88 diagnostic for Cloudflare cache purge question:

- `https://kahramanat.com/*` is currently serving the **OLD STATIC HTML SITE**, not the Next.js Vercel deployment.
- Evidence: loads `/css/shared.min.css?v=2.2.0`, `/js/schema.min.js?v=2.1.0`, references `index.html`/`menu.html`, anti-FOUC reads `localStorage.getItem('kahramana_lang')`, no `_next/static/...` chunks, no `x-vercel-*` headers, `/en/branches` 301-redirects to `/?cb=...`.
- DNS resolves to Cloudflare anycast (`104.21.88.191`, `172.67.152.48`) — should be `cname.vercel-dns.com` if pointing at Vercel.
- All responses show `cf-cache-status: DYNAMIC` + `Cache-Control: no-store` → Cloudflare cache purge is NOT the issue. Origin is genuinely a different backend.
- **Interim production URL: `https://kahramana.vercel.app`** — verified healthy session 88 at sha `aafda83`/`3ec0982`: `/api/health` returns 200 + `db.ok=true`, all 11 sampled marketing/menu routes return 200, `X-Matched-Path: /[locale]/branches` confirms intl rewrite is working.
- Resolution path (next session blocking item): Vercel dashboard → Domains; Cloudflare DNS records; Cloudflare Page Rules / Workers; capture true Vercel production URL.

---

## 3. Applied Migrations Reference

| Migration | Name | Applied |
|---|---|---|
| 061 | loyalty_points_redeemed + loyalty_discount_bhd | ✅ |
| 062 | rpc_create_order atomic | ✅ |
| 063 | customer security + RLS | ✅ |
| 064 | dashboard security hardening | ✅ |
| 065 | dashboard security hardening 2 | ✅ |
| 066 | rpc_create_order p_branch_id TEXT | ✅ |
| 067 | loyalty trigger fix | ✅ |
| 068 | drop jetski_test | ✅ |
| 069 | hash clock_pin | ✅ |
| 070 | menu availability | ✅ |
| 071 | shift closing | ✅ |
| 072 | KDS multi-station | ✅ |
| 073 | POS RPC fix | ✅ |
| 074 | menu items enhanced | ✅ |
| 075 | menu items RLS CRUD | ✅ |
| 076 | menu sync | ✅ |
| 077 | KDS trigger slug fix | ✅ |
| 078 | KDS station mapping | ✅ |
| 079 | KDS station config | ✅ |
| 080 | seed menu_items_sync (168 items) | ✅ |
| 081 | KDS audit P0+P1 | ✅ |
| 082 | KDS realtime payload | ✅ |
| 083 | rpc_create_order modifiers JSONB | ✅ |
| 084 | structured checkout address (Bahrain) | ✅ |
| 085 | rpc_create_order table_number + waiter/qr | ✅ |
| 086 | rpc_create_order promotion_id | ✅ |
| 087 | promotion engine | ✅ |
| 088 | menu_option_groups FK fix | ✅ |
| 089 | KDS RLS hardening + branch_id denorm + UNIQUE(item_id) | ✅ |
| 090 | waiter role enum (staff_role) | ⏳ on disk only — applies just before staff seeder run |
| 091 | rpc_create_order PRICE_MISMATCH bypass for size/variant | ✅ |
| 092 | shift_closing RLS branch scope | ✅ |
| 093 | KDS station taxonomy enum values | ✅ |
| 094 | KDS hardening + taxonomy trigger rewrite | ✅ |
| 095 | orders UPDATE RLS tighten (remove cashier/kitchen) | ✅ |
| 096 | reserved (history-repair sequence) | — |
| 097 | get_labor_cost_metrics + get_menu_engineering_matrix RPCs (TEXT branch_id, GRANT EXECUTE authenticated, total_hours fallback, CTE-based, INNER JOIN) | ✅ |
| 098 | drop_legacy_uuid_overloads (clean up legacy UUID-typed RPC overloads) | ✅ |
| 099 | waitlist_entries (table + RLS branch-scope + index) | ✅ |

---

## 4. Sessions 79–82 — Major Deliverables

### Session 79 — KDS Hardening Sprint
- Migration 089: branch RLS, UNIQUE(item_id), branch_id denorm, SLA timer baseline
- KDS UI: modifier pills, table number, source badges, Arabic status labels, SLA timer, design token cleanup

### Session 80 — Cleanup + QA Bootstrap
- types.ts regenerated clean (post-migration-089)
- CoWork dirty tree committed: additive size+variant pricing in VariantPicker + resolveMenuItemPrice
- Migration 088 applied + registered in schema_migrations
- QA checklist created: 197 items, 9 sections, `docs/qa/pre-launch-checklist.md`

### Session 81 — PRICE_MISMATCH + Waiter RBAC + POS Hydration
- Migration 091: `rpc_create_order` bypass for `selected_size`/`selected_variant` — production verified
- Waiter E2E retest: steps 6–8 PASS
- POS + Waiter hydration fix: lazy `useState(() => resolveMenuItemPrice(item))` — 0 CLS
- Waiter role: `waiter` added to `staff_role` enum + RBAC + `scripts/seed-staff.ts` ready
- Payment warning banner surfaced in POS + Waiter success screen

### Session 82 — Security Hardening + i18n + KDS Taxonomy + Driver
- **i18n/font audit**: prep items, par levels, delivery dashboard, sidebar — all AR/EN clean
- **Badee branch hidden**: `isHiddenBranch()` helper, 12 `as any` casts replaced
- **Google reviews updated**: 4.5→4.6, 1531→1685
- **Orders security**: section guard, transition validation, concurrency, payment awareness, search escape
- **Shifts hardening**: Zod schema, branch scope, RLS WITH CHECK (migration 092)
- **KDS taxonomy**: canonical 5 stations (grill/fryer/cold/drinks/desserts), unassigned fallback, conflict-aware RPC, role whitelist (migrations 093+094)
- **Driver hardening**: driver-only mutations, `order_type='delivery'` everywhere, GPS validation, cash amount validation (migration 095)
- **Promotions**: branch ownership check in togglePromotion/deletePromotion
- **Audit page**: `requireDashboardSection('audit')` guard
- **POS offline queue**: only queue on network failure, not auth/permission errors
- Build: ✅ 540 pages, 0 TSC errors

---

## 4b. Sessions 83–88 — Major Deliverables

### Session 83 — Waiter E2E Test Scaffold
- `tests/e2e/waiter/dine-in.spec.ts` — codifies steps 1–8 of `docs/qa/waiter-table-qa.md`. Logs in as `e2e-owner`, hits `/waiter/table/1?branch=riffa`, picks size M, verifies `orders` + `order_items` (`selected_size='M'`, `unit_price_bhd=2.500`) + station rows via service-role client. Cleans up.
- `playwright.config.ts` — added `dotenv.config({ path: '.env.test' })`, `globalSetup` + `globalTeardown` hooks (previously orphaned), env-driven `baseURL`, `webServer` block to auto-start `npm run dev` for local runs.
- Waiter QA report (`docs/qa/waiter-table-qa.md`) — local PASS 11.5s; vercel.app PASS 21.3s.

### Session 84 — Comprehensive Security Sweep
- **Migrations 092–095**: shift_closing RLS branch scope, KDS station taxonomy enum values, KDS hardening + trigger rewrite, orders UPDATE RLS tighten (cashier/kitchen blocked from direct mutations).
- **Server actions hardened**: dashboard/audit (requireDashboardSection), shifts (Zod + branch assertion + typed ShiftActionResult discriminant), waiter/POS (warning?: string for partial-failure surface), promotions (branch ownership in toggle/delete), orders (UUID validation, explicit field list, branch-scope on details, refund-aware via hasCapturedPayment(), typed OrderActionErrorCode union), driver (driver-only mutations + ownership/branch/status guards + normalizeCashAmount), delivery (ACTIVE_DELIVERY_STATUSES + concurrency rowguards).
- **Order_type=delivery filter parity** across driver/page.tsx + dashboard/delivery + DeliveryPageClient realtime.
- **KDS taxonomy alignment in TS**: KDSStation union + STATION_CONFIG canonical 5 + getStationConfig fallback to unassigned.
- **UI payment-warning surface**: amber banner under success in POSClient + WaiterOrderClient when `result.warning` set.
- **i18n cleanup**: sidebar nav (waiter/tables/promotions wired), prep items + par levels AR translation, inventory.alerts namespace, delivery dashboard ~70 keys migrated.
- **Pre-existing TS error cleanup (Gemini parallel-edits)**: fixed 56 TSC errors across catering pages, COGSClient, ValuationCharts, WasteCharts, dead-stock, expiry, supplier rows, transfer forms, loyalty-actions (`'use server'` files only export async functions).

### Session 85 — Types Regen + E2E Re-verify
- `src/lib/supabase/types.ts` — regenerated via `npx supabase gen types typescript --linked --schema public`; `kds_station` enum now includes migration-093 additions (fryer/cold/unassigned).
- Removed `as never` casts on supabase boundary in dashboard/kds/actions.ts:219 + dashboard/menu/actions.ts (3 sites: upsert, insert, update).
- E2E re-verification post-094/095: `tests/e2e/waiter/dine-in.spec.ts` 1/1 PASS, 15.3s actual / 37.0s with setup/teardown.
- `kahramana-conversation-master-notes.md` (this file): five small corrections — session label 82→84, migration 090 status icon, session-history rows for 83/84, session 79/80 descriptions corrected.

### Session 86 — Phase Gates Re-run + Sentry SDK + /api/health Real Probe
- All 8 phase-completion gates from CLAUDE.md ran clean against current `master` (1 tsc, 2 RTL, 3 fonts, 4 colors, 5 currency, 6 phones, 7 hex tokens-only, 8 service-role bundle scan).
- **CLAUDE.md update**: gate 7 exempt list now includes both `src/lib/design-tokens.ts` and `src/lib/delivery/tokens.ts`. Commit `022ad17`.
- **`docs/qa/post-launch-backlog.md`** new file — first entry **BL-001** (loyalty helpers split, low severity, S effort, no security risk).
- **Sentry Next.js SDK installed** by Ahmed in PowerShell (wizard couldn't run from Bash subprocess — `ERR_TTY_INIT_FAILED`). Commits `15e587c` + `70da288` (pinned `import-in-the-middle@3.0.1` to resolve Sentry × Prisma instrumentation conflict). Vercel env vars added by Ahmed (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`). **Auth-token rotation incident**: token initially pasted in chat, treated as compromised, revoked + replaced.
- **`/api/health` upgraded from stub** (`fc24590`): real DB reachability via `branches` head:true count, Promise.race 4s timeout, returns 503 + JSON failure detail on error/timeout, body includes `sha`/`iso`/`latencyMs`/`checks.db.{ok,latencyMs,error?}`. `runtime: 'nodejs'`.
- **Middleware `/api/*` matcher fix** (`362e121`): added `api` to negative-lookahead. `/api/health` was returning 404 because next-intl middleware was locale-prefixing it to `/ar/api/health`. Side-effect un-broke `/api/webhooks/tap`, `/api/inventory/{export,template}`, `/api/sentry-example-api`.
- **Menu image audit + cleanup** (`20582e6`): cross-referenced 168 `menu_items.image_url` against `public/assets/gallery/`. Zero broken refs. Deleted 31 orphan files (-2.2 MB / 2236 KB). Flagged 4 Priority-A misleading images + 4 Priority-B reused-image clusters for AI regeneration.
- Live `/api/health` verification: HTTP 200, sha matches deployed commit, db.ok=true, latencyMs=485 (Vercel `sin1` ↔ Supabase `ap-northeast-1`).

### Session 87 — Loyalty Discoverability + Registration Fix + Migration Repair + Security/Privacy Audit
- **Loyalty system discoverability** end-to-end (backend was 100% functional but had zero UI entry points at session start):
  - **`feat(header) 115627c`** — customer account button. Signed-out: gold "Sign In / Register" pill (desktop) + icon (mobile). Signed-in: pill with user icon + points + tier badge → dropdown.
  - **`feat(home) a024286`** — Kahramana Club section between ProtocolStack and HomeFAQ. Server component, 3 numbered cards (sign up / earn 10 pts/BD / redeem from 200 pts) + gold CTA → `/account/register`.
  - **`feat(checkout) 6e78a76`** — gold-tinted "Sign in to earn points" card above Step 2 when `customerProfile === null`. Same commit bumped registration rate limit 5→10 / 15min.
  - **`seo(account) 8579d3c`** — removed 5 `/account*` Disallow rules from `robots.ts`. Added `/account` (priority 0.40) + `/account/register` (0.50) to `sitemap.ts` for both ar+en with hreflang alternates.
- **Customer registration fix (`fix(auth) a0e60ac`)**: "An error occurred during registration" — Supabase email-confirmation flow doesn't create a session on signUp → no cookies → `auth.uid()` returns NULL → `rpc_create_customer_profile` raises AUTH_REQUIRED. Fix: after signUp succeeds, insert `customer_profiles` via `createServiceClient()` using `authData.user.id` directly. Self-heals existing half-registered users on retry.
- **Migration 097 verification + repair sprint** (Gemini WIP audited and fixed):
  - 097 had branch_id UUID (project uses TEXT — silent comparison failure), missing GRANT EXECUTE to authenticated, temp-table race condition, LEFT JOIN where INNER intended, total_hours column assumed without fallback, 3 new `as any` casts in queries.ts.
  - **`fix(migrations) 6f4857a`** rewrote 097 with all 5 SQL fixes + corrected GRANT param order. Applied via Supabase MCP (CLI's `db push` failed — short-prefix vs timestamp registration mismatch, known project quirk). Migration 098 dropped legacy UUID overloads. Types regenerated to include both new RPCs (150,913 chars). `as any` casts removed in queries.ts.
  - **Migration history repair**: `migration repair --status reverted` on 9 timestamp versions + `--status applied` on short prefixes. One CLI parser surprise (`097b` rejected — non-digit suffix). Verified live schema artifacts for 085/086/087/089 (all pass). `migration list --linked` → all rows now `Local | Remote` matched. `db push --linked` returns "Remote database is up to date." exit 0.
- **5 security+privacy audit fixes (`security+privacy 8d46326`)**:
  1. Sentry: `tracesSampleRate 1 → 0.1` (server + client); `sendDefaultPii true → false` (server).
  2. CSP additions in middleware: `connect-src` + Sentry endpoints; `script-src` + `frame-src` + `https://challenges.cloudflare.com` (Turnstile iframe).
  3. **Cookie consent now gates analytics** (most impactful): new `src/components/layout/Analytics.tsx` reads `cookie-consent` from localStorage, listens for `cookie-consent-updated`, only renders GA4+Clarity `<Script>` tags after accept. Previous behavior: GA4+Clarity loaded on every page regardless of consent.
  4. `/privacy` consolidated into `/privacy-policy`: deleted 257-line duplicate, added 2 permanent 301 redirects in next.config.ts.
  5. Cloudflare Turnstile on `/contact`: installed `@marsidev/react-turnstile`, added widget + server-side `siteverify` in actions.ts. Soft-launch: if `TURNSTILE_SECRET_KEY` unset, falls back to honeypot-only. Tracked as **BL-002**.
- **Sentry HTML meta-tag suppression (`security 4b49ba1`)**: `<meta name="baggage">` and `<meta name="sentry-trace">` were exposing git commit SHA + route name. `withSentryConfig` doesn't have a direct off-switch; right knob is `autoInstrumentAppDirectory: false` (under webpack block). Also added `autoInstrumentServerFunctions: false` and `autoInstrumentMiddleware: false`. Trade-off: automatic SSR/RSC perf traces gone; error capture + manual `Sentry.startSpan()` + client-side tracing continue.
- **Build broken ~2 hours**: every commit since `30917244` (Gemini's analytics UI) failing on a single ESLint error: `AnalyticsMenuMatrix.tsx:18:13 Unexpected any. Specify a different type.` Project's `next build` fails on ESLint errors; `tsc --noEmit` doesn't run ESLint. Fix `9d18db4`: `payload?: any[]` → `payload?: Array<{ payload: AnalyticsMenuEngineeringRow }>`. 11 queued commits shipped in one build after fix.

### Session 88 — Pre-launch QA Cleanup + Critical Hostname Discovery
- **`83ced0a chore: remove sentry-example pages`** — deleted `src/app/sentry-example-page/` and `src/app/api/sentry-example-api/` (Sentry wizard scaffolding, only remaining source of the Roboto font violation). Bundled the earlier DriverHeader hydration fix (`suppressHydrationWarning` on `<span>{clock}</span>` at `DriverHeader.tsx:29` — root cause: `useState(formatClock)` runs once SSR + once client hydration, ~1s apart).
- **`f127116 style(reports): replace raw hex chart colors with design tokens`** — 5 raw-hex literals (`#22c55e` × 3, `#ef4444` × 2) across COGSClient, FoodCostChart, ValuationCharts, WasteCharts → `colors.success` / `colors.error`. Gate 7 clean across `src/`.
- **`c7645f5 seo(sitemap): add /terms`** — only genuinely public route missing from sitemap. Sitemap was already generating ~416 URLs (the handoff's "10 URLs only" claim was stale).
- **`aafda83 fix(middleware): remove PUBLIC_NO_PREFIX shortcut`** — rolled back session 88's `17c0379`. With `localePrefix: 'as-needed'` + route files at `[locale]/*`, next-intl middleware MUST run on unprefixed paths so the internal rewrite `/branches → /ar/branches` happens. Verified live on Vercel: `X-Matched-Path: /[locale]/branches`.
- **`3ec0982 fix(tokens): replace amber/yellow tailwind classes with brand design tokens`** — `dashboard/menu/page.tsx:59-64` warning banner amber-500 → brand-gold; `ui/badge.tsx:15` warning variant `bg-yellow-100 text-yellow-800` → `bg-brand-gold/15 text-brand-gold`. Gate 4 now clean.
- **Waitlist Management** (Gemini track, commit `ccfb079`): migration 099 `waitlist_entries` table + RLS + index, `/dashboard/waitlist` page with addToWaitlist / updateStatus / getWaitlist server actions, real-time via `supabase.channel()` (KDS pattern), WhatsApp notify via existing `buildWaLinkForPhone()`, RBAC owner/GM/branch_manager/cashier/waiter, translations under `waitlist` namespace.
- **`280e8c1 sec(SEC-08)`**: `src/lib/loyalty/config.ts` was mixing server fetcher with types; LoyaltySettings.tsx (Client Component) imported it → SUPABASE_SERVICE_ROLE_KEY string entered client bundle. Split into 3 files: `types.ts` (client-safe), `config.server.ts` (server-only with `import 'server-only'`), `config.ts` (re-export for compat). grep `.next/static` → 0 hits after.
- **Pre-launch QA pass (machine-verifiable subset against `kahramana.vercel.app`)**:
  - Gates 1, 2, 3, 6, 7 PASS clean.
  - Gate 4 PASS post-3ec0982 fix.
  - Gate 5 (BHD literal): SOFT — 6 hits, all false-positive or correct (Schema.org `priceCurrency` × 2, bilingual ternary `{isAr ? 'د.ب' : 'BHD'}` × 3, `MenuEngineeringMatrix.tsx const currency`). Gate script over-broad.
  - 11/11 marketing+menu routes 200/200 (ar+en); garbage URL → 404 ✓.
  - robots.txt comprehensive (blocks dashboards/auth/transactional, allows AI crawlers).
  - sitemap.xml: 394 `<loc>` entries with full hreflang ar/en/x-default.
  - i18n parity: 1944 keys both files, 0 diffs.
  - Bing verification meta present; AR hreflang variants extensive (ar-BH, ar-IQ, ar-SA, ar-AE, ar-KW).
- **CRITICAL DISCOVERY**: `kahramanat.com` is currently serving the OLD STATIC HTML SITE (see § 2.5). Middleware fix is correct and verified live on Vercel but inert at the public hostname until DNS/Cloudflare routing is restored. Cloudflare cache purge is NOT the issue — every response is `cf-cache-status: DYNAMIC`.

---

## 5. Architecture Decisions

### 5.1 Atomic Checkout RPC
- `rpc_create_order` — single PostgreSQL function, `SECURITY DEFINER`
- Handles: idempotency → coupon lock → loyalty deduction → order INSERT → items loop → points_transaction
- Extended across 6 migrations (062, 066, 083, 085, 086, 091)
- Migration 091: PRICE_MISMATCH check skips items with `selected_size` or `selected_variant`

### 5.2 KDS Station Architecture
- **Canonical stations**: `grill`, `fryer`, `cold`, `drinks`, `desserts`, `unassigned`
- **Single source of truth**: `src/constants/kds.ts → STATION_CONFIG`
- **DB**: trigger `on_order_item_created` routes by slug pattern → station
- **Unknown slugs**: fall to `unassigned` (not `main`) — fail closed
- **UNIQUE(item_id)**: one item → one station only
- **`branch_id` denormalized** on `order_item_station_status` for realtime filtering
- **Conflict-aware RPC**: `p_expected_status` + transition validation + row count check
- **Session 84**: cashier/kitchen removed from direct `orders` UPDATE RLS — all KDS mutations go through RPCs

### 5.3 Branch Isolation
- `HIDDEN_BRANCHES = ['badee']` constant in `src/constants/contact.ts`
- `isHiddenBranch(id)` helper — used in 20+ files
- DB data untouched — code-level only

### 5.4 RBAC Model
| Role | Rank | Key Access |
|---|---|---|
| owner | 10 | Everything |
| general_manager | 9 | Everything except owner actions |
| branch_manager | 7 | Branch-scoped |
| cashier | 5 | Orders, POS, shifts, waitlist |
| kitchen | 4 | KDS only |
| waiter | 3 | Waiter app, dine-in orders, waitlist |
| inventory_manager | 4 | Full inventory |
| inventory | 2 | Limited inventory |
| driver | 3 | Driver PWA only |
| marketing | 3 | Promotions, coupons |
| support | 2 | Limited |

### 5.5 Driver Security Model
- Driver mutations (`driverBumpOrder`, `markDriverArrived`, `reportDeliveryFailure`): `driver` role only
- `postDriverLocation`: verifies `assigned_driver_id = user.id`, `status = 'out_for_delivery'`, branch match
- All driver/delivery queries: `.eq('order_type', 'delivery')` enforced
- Cash amounts: `Number.isFinite` + `>= 0` + round to 3 decimal places

### 5.6 Customer Registration Architecture (session 87)
- Email confirmation OFF + service-role insert on success of `signUp`
- Bypasses the `auth.uid()` gate that the original `rpc_create_customer_profile` required (signUp doesn't create a session on email-confirmation flow)
- Self-heals partial registrations on retry (signUp obfuscates "user exists" and returns existing user.id; service-role insert fills missing profile)
- `Sentry.captureException` at both failure points so future regressions surface

### 5.7 Cookie Consent Gating Analytics (session 87)
- `src/components/layout/Analytics.tsx` (client) reads `cookie-consent` from localStorage
- Listens for `cookie-consent-updated` event from CookieBanner
- Only renders GA4 + Clarity `<Script>` tags after explicit accept
- SSR-safe (`useState(false)` initial → server renders null)
- Trade-off: short-term GA4/Clarity traffic dip after deploy until users re-consent (expected, not a bug)

---

## 6. Security Hardening Log

### Customer Journey (Migration 064)
| Fix | Description |
|---|---|
| C-1 | Phone spoofing for loyalty — RPC uses `auth.uid()` |
| C-2 | Customer UPDATE on points_balance locked |
| C-3 | Registration moved to `rpc_create_customer_profile` SECURITY DEFINER |
| C-4 | 50% cap on points redemption enforced in RPC |
| C-5 | RPC REVOKE anon, status forced from payment method |
| C-6 | Driver location IDOR → `rpc_get_driver_location` |
| C-7 | Rate limiting on login (Upstash Redis, 5/15min/IP) |

### Dashboard (Migration 065 + Sessions 67–88)
| Fix | Description |
|---|---|
| D-C1 | marketing coupon cap: 30% / 5 BHD |
| D-C2 | coupon_usages INSERT → SECURITY DEFINER RPC only |
| D-C3 | Driver NULL branch_id guard |
| D-C4 | reassignDriver: role/branch/active validation |
| D-C5 | Waste report self-approval blocked |
| D-C6 | confirmCashHandover: owner/GM only |
| D-C7 | KDS select('*') → explicit safe columns |
| Session 82–84 | Orders: requireDashboardSection + branch scope + transition validation + concurrency + refund-aware |
| Session 82–84 | Shifts: Zod schema + branch assertion + RLS WITH CHECK (092) |
| Session 82 | Promotions: branch ownership check in toggle/delete |
| Session 82 | Audit page: requireDashboardSection('audit') guard |
| Session 82–84 | KDS RLS: role whitelist (kitchen/manager/GM/owner only); cashier/kitchen removed from direct UPDATE (095) |
| Session 82 | Driver: driver-only mutations, GPS ownership validation |
| Session 87 | Sentry: `sendDefaultPii false`, `tracesSampleRate 0.1`, HTML meta-tag suppression |
| Session 87 | CSP middleware: Sentry endpoints + Turnstile script/frame-src |
| Session 87 | Cookie consent gates analytics (Analytics.tsx client component) |
| Session 87 | /privacy 301 → /privacy-policy (consolidated) |
| Session 87 | Cloudflare Turnstile on /contact (soft-launch fallback to honeypot) |
| Session 88 | SEC-08 service-role key bundle hygiene: loyalty/config split into types + server + barrel |

### Open Security Backlog (carried into next session)
- **BL-003 candidate** — 4 SECURITY DEFINER views (`order_source_summary`, `customer_segments_view`, `coupon_analytics_view`, `v_kds_station_items`). Fix: `ALTER VIEW <name> SET (security_invoker = on);` per view + UI test under RLS.
- **BL-004 candidate** — 8 `rls_policy_always_true` policies. Need enumeration + per-policy decision (intentional public-read vs missed scoping).
- 68 lower-priority advisor WARN entries (anon/auth SECURITY DEFINER fns, search_path mutable, matview-in-API, password-leak protection disabled, public bucket listing). Tidiness sweep, not launch-blocking.

---

## 7. Staff Seeding — Pending

Migration 090 + `scripts/seed-staff.ts` ready. **Still waiting for 13 emails (carry-over since session 82).**

Run order (once emails received):
1. Apply migration 090 via SQL Editor
2. `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts`
3. `npx tsc --noEmit`
4. Plug emails into `scripts/seed-staff.ts:54-79`
5. `npm run seed:staff:dry` → review
6. `npm run seed:staff` → invites sent

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

---

## 8. Key Engineering Rules

1. Apply migrations one at a time via SQL Editor — never `db push --include-all` on production
2. Always `npm run build` before `git push origin master` — `tsc --noEmit` clean is necessary but **not sufficient** (build runs ESLint with `no-explicit-any` as error; tsc doesn't)
3. Always use `git add <specific paths>` not `git add .` to avoid CoWork file contamination
4. Keep Phase 8 (AI) locked until real production data exists (6+ months)
5. **Never touch image, layout, animation, or CSS when goal is SEO/metadata only** — CLS risk
6. Always strip `<claude-code-hint>` after `supabase gen types`
7. Restart dev server (`Ctrl+C` + `npm run dev`) to fix Turbopack HMR hydration mismatches
8. `staff_basic.id` (not `user_id`) for RLS references
9. Promotion `use_count` has no decrement — refunds don't restore quota
10. `HIDDEN_BRANCHES` is code-level only — never delete DB data for Badee
11. POS/Waiter price initialization: `useState(() => resolveMenuItemPrice(item))` — lazy initializer, no mounted guards
12. Deployment order for enum migrations: ADD VALUE migration first (alone), then dependent migration
13. PostgREST direct UPDATE from cashier/kitchen now blocked by RLS (migration 095) — all mutations go through RPCs or server actions
14. **`'use server'` files only export async functions** — re-exporting constants crashes at runtime (DEFAULT_LOYALTY_CONFIG bug, session 84)
15. **Sentry wizard cannot run from a Bash subprocess under Claude Code** — needs a real TTY. Run manually in PowerShell via `!` prefix.
16. **Service-role key in client bundle**: literal `process.env.SUPABASE_SERVICE_ROLE_KEY` may appear in client chunks because Next.js does NOT inline non-`NEXT_PUBLIC_*` env vars on the client (the actual secret never leaks). But split server-only modules (`import 'server-only'`) anyway to keep bundle hygiene + clarify intent (session 88 SEC-08).
17. **Cloudflare cache purge is NOT a routing fix** — when response shows `cf-cache-status: DYNAMIC`, Cloudflare is proxying live and not caching. Reach for purge only when `HIT` and cached body is wrong.
18. **`PUBLIC_NO_PREFIX` shortcut breaks next-intl `as-needed`** (session 88) — don't bypass intl middleware on unprefixed public paths; the internal rewrite to default locale segment is required for the file-system route to match.
19. **`autoInstrumentAppDirectory: false`** in `withSentryConfig.webpack` removes the `<meta name="baggage">` and `<meta name="sentry-trace">` HTML injection. `sentryOptionsToSend` and `hideSourceMaps` are NOT real options in `@sentry/nextjs@10.52.0` — grep `node_modules/@sentry/nextjs/build/types/config/types.d.ts` before adding options.
20. **PostgREST returns NUMERIC as string** — always wrap with `Number()` before `.toFixed()` or comparisons.
21. **Auto-generated `Database` types lag enum migrations** — until `gen types` is rerun after `ALTER TYPE ADD VALUE`, supabase boundary calls need `as never` cast at the `.eq()`/`.upsert()`/`.insert()`/`.update()` site (with documenting comment).
22. **Email confirmation OFF + service-role insert** is the registration architecture (session 87) — works regardless of confirmation setting; the RPC `rpc_create_customer_profile` is effectively unused for the primary signup path now.

---

## 9. Dashboard Sections Reference

| Route | Roles | Description |
|---|---|---|
| `/dashboard` | all staff | Overview + quick actions |
| `/dashboard/orders` | cashier+ | Orders list + kanban |
| `/dashboard/orders/[id]` | cashier+ | Order detail (section guard enforced) |
| `/dashboard/kds` | kitchen+ | Kitchen Display System (5 stations) |
| `/dashboard/pos` | cashier+ | Manual POS |
| `/dashboard/delivery` | branch_manager+ | Delivery dispatch board |
| `/dashboard/waiter` | waiter, cashier+ | Waiter app |
| `/dashboard/tables` | cashier+ | Table management + QR |
| `/dashboard/waitlist` | cashier+, waiter | Waitlist management (real-time) |
| `/dashboard/staff` | GM, owner | Staff management |
| `/dashboard/loyalty` | cashier+ | Loyalty program |
| `/dashboard/promotions` | marketing+ | Promotion Engine (5 types) |
| `/dashboard/inventory/*` | inventory_manager+ | Full inventory system |
| `/dashboard/coupons` | marketing+ | Coupon management |
| `/dashboard/analytics/*` | GM, owner | Analytics (5 sub-pages + Labor Cost gauge + Menu Engineering Matrix) |
| `/dashboard/reports` | GM, owner | Financial reports |
| `/dashboard/payments` | manager, owner | Payments + cash handovers |
| `/dashboard/shifts` | cashier+ | End of shift closing |
| `/dashboard/audit` | GM, owner | Audit log (section guard enforced) |
| `/dashboard/schedule` | manager | Staff scheduling |
| `/dashboard/settings` | GM, owner | Branch settings + Loyalty config |

---

## 10. Customer & Staff Pages Reference

| Route | Description |
|---|---|
| `/[locale]` | Homepage (now with Kahramana Club loyalty section) |
| `/[locale]/menu` | Menu listing (DB-backed availability) |
| `/[locale]/menu/[slug]` | Category page |
| `/[locale]/menu/item/[slug]` | Item detail |
| `/[locale]/branches` | Branch listing |
| `/[locale]/branches/[branchId]` | Branch detail |
| `/[locale]/checkout` | Checkout with loyalty + promotion redemption + sign-in nudge for guests |
| `/[locale]/order/[id]` | Order tracking (Realtime) |
| `/[locale]/payment/[orderId]` | Tap payment page |
| `/[locale]/account` | Loyalty points + history |
| `/[locale]/account/login` | Login |
| `/[locale]/account/register` | Register (service-role insert pattern) |
| `/[locale]/catering` | Catering page |
| `/[locale]/contact` | Contact (Turnstile soft-launch — honeypot fallback until env vars provisioned) |
| `/[locale]/privacy-policy` | Privacy policy (canonical; `/privacy` 301 → here) |
| `/[locale]/terms` | Terms of service (in sitemap as of session 88) |
| `/[locale]/refund-policy` | Refund policy |
| `/[locale]/table/[branchId]/[tableNumber]` | QR Ordering (guest, no auth) |
| `/[locale]/waiter` | Waiter App — table grid |
| `/[locale]/waiter/table/[tableNumber]` | Waiter App — order builder |
| `/[locale]/waiter/orders` | Waiter App — active orders |
| `/[locale]/driver` | Driver PWA |
| `/api/health` | Real liveness probe (DB head:true count + 4s timeout) |

---

## 11. Production Smoke Test Checklist

- `/ar` and `/en` work
- `/ar/menu` and `/en/menu` work — out-of-stock items hidden
- `/api/health` returns 200 + `db.ok=true` + matching sha
- `/branches`, `/privacy-policy`, `/terms`, `/refund-policy` all return 200 (intl rewrite intact post-aafda83)
- Header shows customer account button (signed-in + signed-out states)
- Home renders Kahramana Club loyalty section
- Checkout shows "Sign in to earn points" card for guests
- Cookie consent banner appears; GA4/Clarity load only after accept
- Checkout works — COD orders appear as 'new' in dashboard
- Manual POS order appears in KDS immediately as 'accepted'
- POS layout renders without hydration error — prices show immediately (0 CLS)
- Realtime order tracking updates without refresh
- Loyalty points awarded on order `delivered` or `completed`
- Driver location visible to manager + customer when `out_for_delivery`
- Dashboard login works (PIN hashed in DB)
- KDS stations work: grill/fryer/cold/drinks/desserts — no cross-station leakage
- Waiter App: table grid → order builder → send → KDS receives as dine_in
- QR: scan → menu → order → KDS receives as dine_in
- Promotions: create bogo → place order → `promotion_discount_bhd` populated
- Waitlist: cashier/waiter can add party → status updates real-time → WhatsApp notify link generates
- `/dashboard/tables` QR download works
- Cash handover confirm restricted to owner/GM
- End of shift closing works (GMs see branch selector)- Audit log visible to owner/GM only
- Badee branch not visible anywhere in platform
- No horizontal scroll on mobile
- Mobile bottom nav visible on customer pages, hidden on dashboard/waiter/table
- Waiter orders with size+variant: price = size + variant (additive)
- Driver can only claim `order_type='delivery'` orders
- Sentry: no `<meta name="baggage">` or `<meta name="sentry-trace">` in HTML responses
- Customer registration succeeds even when email confirmation is off (service-role pattern)

---

## 12. Session History Summary

| Session | Date | Focus |
|---|---|---|
| 1–50 | 2026-04-27 → 05-01 | Foundation, phases 1–7, inventory, KDS, driver, loyalty, coupons |
| 54 | 2026-05-04 | Inventory audit, dashboard UI fixes, SEO, ESLint |
| 55–56 | 2026-05-04 | LCP deep-dive — 6 Lighthouse runs, root cause found |
| 57 | 2026-05-06 | Performance fixes, security hardening, realtime tracking, loyalty, driver GPS |
| 58 | 2026-05-06 | Loyalty redemption, ARCH-004, 14 security fixes, POS, KDS stations, menu editor |
| 59–63 | 2026-05-07 | Migration 067 loyalty trigger, menu availability (070), shift closing (071), KDS multi-station (072), POS RPC fix (073) |
| 64 | 2026-05-07 | Menu items enhanced (074) + RLS CRUD (075) |
| 65 | 2026-05-08 | Menu Management CRUD: full CRUD + RLS, station mapping, JSON sync fallback |
| 66 | 2026-05-08 | Null byte + EOF truncation cleanup (79 files) → TSC 0 errors |
| 67 | 2026-05-08 | Security: hash clock_pin (069), auth template route, subtotal fix, Upstash hardening |
| 68 | 2026-05-08 | Merge duplicate i18n blocks; POS layout via CSS Module |
| 69 | 2026-05-08 | POS hydration fix; KDS trigger slug fix (077); KDS station mapping (078); GM branch selector |
| 70 | 2026-05-09 | KDS audit → all P0+P1 fixes; seed menu_items_sync (168 items); station routing verified |
| 71 | 2026-05-09 | KDS station mapping root cause fixed; seed script; migration 080; build 533 pages |
| 72 | 2026-05-09 | Secure migrate-077 route, KDS realtime payload update, i18n labels, PII guard, GA4/Clarity |
| 73 | 2026-05-09 | Category Select box + auto slug + slugPrefix per category |
| 74 | 2026-05-09 | Stations single source, image_url XSS guard, Vercel env GA4/Clarity confirmed |
| 75 | 2026-05-09 | KDS audit prompt + all P0+P1 fixes applied |
| 76 | 2026-05-09 | 5 competitive gaps: image upload, offline POS, modifiers, ESC/POS receipt, loyalty config |
| 77 | 2026-05-09 | Waiter App PWA (085) + QR Ordering + Promotion Engine (086/087) — 540 pages |
| 78 | 2026-05-09 | DB-first menu architecture, modifier FK fix (088), waiter UI audit fixes |
| 79 | 2026-05-09 | KDS hardening sprint: branch RLS, modifiers, table number, realtime filter, SLA timer (089) |
| 80 | 2026-05-10 | types.ts regen, additive pricing fix (VariantPicker), migration 088 applied, QA checklist (197 items) |
| 81 | 2026-05-10 | PRICE_MISMATCH fix (091), waiter E2E PASS, POS hydration, waiter role (090), payment warning UI |
| 82 | 2026-05-10 | i18n audit, Badee hidden, reviews updated, orders/shifts/KDS/driver security hardening (092–095) |
| 83 | 2026-05-10 | Waiter dine-in E2E spec + playwright config wired (globalSetup/teardown), local + vercel.app PASS |
| 84 | 2026-05-10 | Comprehensive security sweep (orders/shifts/waiter/POS/promotions/driver/delivery), KDS taxonomy alignment in TS, UI payment-warning surface, i18n cleanup, 56 Gemini-introduced TSC errors fixed |
| 85 | 2026-05-10 | types.ts regen post-094/095, removed `as never` casts in kds + menu actions, E2E re-verification PASS |
| 86 | 2026-05-10 | All 8 phase gates re-run clean, CLAUDE.md gate 7 exempt list updated, post-launch backlog doc created (BL-001), Sentry SDK installed by Ahmed, /api/health upgraded to real probe (fc24590), middleware /api exclusion fix (362e121), menu image audit -2.2 MB |
| 87 | 2026-05-10 | Loyalty discoverability end-to-end (Header + home + checkout + SEO), customer registration fix (a0e60ac service-role pattern), migration 097 verification + repair sprint, 5 security/privacy audit fixes (Sentry sampling+PII, CSP, cookie consent gating analytics, /privacy → /privacy-policy, Turnstile soft-launch), Sentry HTML meta-tag suppression, 2h debug of build break (single ESLint any[]) |
| 88 | 2026-05-11 | Pre-launch QA cleanup (sentry-example deletion, raw-hex chart colors → tokens, sitemap /terms, middleware PUBLIC_NO_PREFIX rollback, amber/yellow → brand-gold, DriverHeader hydration suppress); Vercel verification healthy; pre-launch QA pass machine-verifiable subset (7/7 gates clean, 11/11 routes 200, 394 sitemap URLs, 1944/1944 i18n parity); CRITICAL discovery: kahramanat.com serves OLD STATIC site; Waitlist Management shipped (Gemini track, migration 099) |

---

## 13. Competitive Roadmap

| Priority | Feature | Status |
|---|---|---|
| 🔴 1 | Waiter App PWA | ✅ Shipped |
| 🔴 2 | QR Ordering | ✅ Shipped |
| 🔴 3 | Promotion Engine | ✅ Shipped |
| 🔴 4 | Waitlist Management | ✅ Shipped (session 88, Gemini) |
| 🟡 5 | Self-ordering Kiosk | Pending |
| 🟡 6 | AI Assistant (عربي) | Pending |
| 🟡 7 | Customer Display Screen | Pending |
| 🟡 8 | Dark Kitchen Module | Pending |
| 🟢 9 | Delivery Channel Manager | Pending |
| 🟢 10 | Mall GTO Reporting | Pending |
| 🟢 11 | Franchise/App Marketplace | Future |

---

## 14. SaaS Competitive Analysis

| Feature | Kahramana | Toast | Square | Foodics | Sapaad |
|---|---|---|---|---|---|
| Arabic RTL native | ✅ | ❌ | ❌ | ✅ | ✅ |
| Bahrain payments | ✅ | ❌ | ❌ | ✅ | ✅ |
| Driver PWA built-in | ✅ | ❌ ($add-on) | ❌ | ❌ | ✅ |
| KDS multi-station | ✅ | ✅ ($add-on) | ⚠️ | ✅ | ✅ |
| Inventory depth | ✅ | ✅ ($add-on) | ❌ | ✅ | ✅ |
| Waiter App | ✅ | ✅ | ❌ | ✅ | ✅ |
| QR ordering | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Promotion Engine | ✅ | ✅ ($add-on) | ⚠️ | ✅ | ✅ |
| Waitlist Management | ✅ | ✅ ($add-on) | ⚠️ | ✅ | ✅ |
| Loyalty program | ✅ | ✅ ($add-on) | ✅ | ✅ | ✅ |
| Cookie-consent gated analytics | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Real liveness probe | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Monthly cost | ~$45-90 | $200-2000+ | $60-165+ | $100-300+ | $80-200+ |
| Offline POS | ⚠️ (queue) | ✅ | ✅ | ✅ | ✅ |
| Available in Bahrain | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## 15. Immediate Next Steps (Session 88 close → Session 89)

**🔴 BLOCKING:**
1. **kahramanat.com hostname routing** — diagnose why DNS/Cloudflare serves the old static site instead of Vercel. Vercel dashboard → Domains; Cloudflare DNS records (should be `cname.vercel-dns.com`); Cloudflare Page Rules / Workers; capture the true Vercel production URL (preview hostname pattern: `kahramana-alrshedahmad31-designs-projects.vercel.app`). Once fixed, the 5 commits from session 88 take effect at the public hostname.

**🟡 NEXT-PRIORITY (when staff emails land):**
2. **13 staff emails** → run staff seed sequence (apply 090, regen types, tsc, plug emails, dry-run, real run, invitees consume magic links).

**🟡 OPERATIONAL:**
3. **Cloudflare Turnstile env vars** in Cloudflare + Vercel (BL-002).
4. **UptimeRobot 5-min monitor** on `/api/health` (depends on hostname routing fix).
5. **Bulk-clean 12 stale test orders** in non-terminal status from May 8-9.
6. **GA4 / Clarity short-term traffic dip** monitoring after consent gate ship (expected, not a bug).

**🟡 SECURITY BACKLOG (grade before launch):**
7. **BL-003 candidate** — flip 4 SECURITY DEFINER views to security_invoker.
8. **BL-004 candidate** — enumerate 8 `USING(true)` policies, decide intentional vs scoping miss.
9. 68 lower-priority advisor WARN entries — tidiness sweep.

**🟢 LOW PRIORITY:**
10. Menu image regeneration (4 Priority-A misleading + 4 Priority-B reused-image clusters).
11. Stale root `menu.json` deletion (verified no imports session 86).
12. **BL-001** loyalty helpers split — bundle hygiene only.
13. Refund modal for `code === 'refund_required'` (toast still in use).
14. Legacy `kds_queue` table — post-launch cleanup.
15. Pre-launch QA master checklist full re-run with real staff accounts (~150 items needing human / device / accounts).

**🟡 EXTERNAL DEPENDENCIES (no action this side):**
16. Tap merchant approval (Ahmed via CBB).
17. WhatsApp Business API verification (Ahmed via Meta).
18. Benefit Pay merchant approval (2-4 months CBB).
