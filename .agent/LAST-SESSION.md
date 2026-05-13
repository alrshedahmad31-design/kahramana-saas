# LAST-SESSION.md — Kahramana Baghdad
> Session 93: BL-004 RLS hardening, Owner Dashboard fixes, test-data
> cleanup, header redesign, Vercel build/sourcemap fixes
> Date: 2026-05-13
> Author: Claude Code (all work this session; Gemini active in
>         parallel on Shifts polish + recipe-poster cleanup)

## SUMMARY
Long, multi-thread session. 16 commits pushed (bd4a06e → 62112d6).
Three big buckets:

1. **Security audit follow-through** — BL-004 RLS findings closed in
   migrations 120-122; customers anon INSERT shape-guarded.
2. **Header + nav redesign** — Reserve CTA replaces Order Now,
   Branches link dropped, mobile header rebalanced.
3. **Vercel deploy unblock** — ESLint no-explicit-any errors fixed,
   Node 20.x pinned, Sentry sourcemap pipeline rebuilt three times.

Also: 20 test orders + 19 cash-COD payments hard-deleted; 35.6 MB of
orphaned recipe videos removed; 3 stale Playwright tests rewritten.

## COMMITS THIS SESSION (in order)
- `bd4a06e` chore(state): reconcile phase-state pointer + session 92
  bookkeeping
- `e9b2a81` fix(security): BL-004 — close high-severity open
  INSERT/SELECT policies (migration 120)
- `a0b351a` fix(owner): improve placeholder metrics — late orders,
  slowest items, acceptance hint
- `1fc4137` chore(dev): add hydration mismatch probe script
- `0401eb8` fix(security): add shape guard to customers anon INSERT
  policy (migration 121)
- `a657d2e` docs(agent): session 93 hand-off summary (interim)
- `c383235` feat(shifts): cinematic theme polish + P0 fixes (Gemini
  polish + Claude P0 fixes bundled)
- `e615b91` fix(security): BL-004 P2 — shape guards + staff scoping
  (migration 122)
- `ab7368f` fix(build): no-explicit-any ESLint errors — unblock
  Vercel deploy
- `4397ea6` chore(menu): mark dashboard menu route force-dynamic
- `ffef5bd` chore: remove orphaned recipe videos (-35.6 MB)
- `92ec1cc` chore: remove orphaned recipe posters (Gemini, parallel)
- `6a3ac93` feat(header): Reserve CTA replaces Order Now, Contact
  replaces Branches
- `e5a2caf` fix(header): remove duplicate reserve nav link
- `6da6fa7` fix(header): mobile — show reserve CTA, language
  switcher, contact nav
- `f90536d` fix(tests): update stale nav + WhatsApp assertions after
  header redesign
- `be897f1` fix(build): pin Node 20.x, Sentry sourcemaps, ESLint
  warnings cleanup
- `4547db6` fix(tests+header): contact phone assertion, mobile header
  overflow
- `d456a1f` fix(sentry): enable server sourcemaps for symbolicated
  traces
- `2f2c69f` fix(sentry): explicit authToken + sourcemaps config
- `62112d6` fix(sentry): explicit sourcemaps glob instead of
  experimental flag

## MIGRATIONS APPLIED TO PROD

### 120 — `rls_bl004_fix`
Closed 8 high-severity BL-004 findings:
- `orders` + `order_items` INSERT: anon + authenticated → service_role
  only. Legitimate path is `rpc_create_order` (SECURITY DEFINER →
  bypasses RLS).
- `inventory_lots` INSERT: authenticated → owner/general_manager/
  branch_manager/inventory_manager.
- `supplier_price_history` SELECT + INSERT: same staff set.
- `prep_items` + `prep_item_ingredients` SELECT: same staff set
  plus kitchen.

### 121 — `customers_insert_guard`
`customers_insert_anon` WITH CHECK (true) → predicate requiring
`name` 1-120 chars + Bahrain-style phone regex
(`^\+?[0-9\s\-()]{7,30}$`). NULL `name`/`phone` now also rejected.

### 122 — `rls_bl004_p2`
Closed the four remaining low-severity BL-004 findings:
- `contact_messages` anon INSERT: shape guard on name/message/email
  (column-level NOT NULL on email already enforced; predicate kept
  symmetric with form contract).
- `ingredient_allergens` SELECT: authenticated → owner/GM/branch_mgr/
  inventory_mgr/kitchen/cashier/waiter.
- `restaurant_profile` SELECT: authenticated → owner/GM/branch_mgr.
- `unit_conversions` SELECT: authenticated → ops staff set.

**BL-004 status: fully closed.** The only remaining `qual='true'`/
`with_check='true'` policies in `public.*` are intentional
(`service_role`-only) or genuine public-read (branches, menu,
business_hours, loyalty_config, system_settings — audited safe).

## FEATURES SHIPPED

### Header / nav redesign — `6a3ac93`, `e5a2caf`, `6da6fa7`, `4547db6`
- Replaced wa.me CTA with `/reserve`. Added `nav.reserveTable` key
  ("Reserve a Table" / "احجز طاولة"); `nav.reserve` kept tight for
  the nav link.
- Dropped Branches from desktop nav + `MobileBottomNav` (Contact
  already existed in both).
- Mobile bar: account + cart + reserve (gold calendar icon) +
  hamburger. Language toggle kept in hamburger overlay only (the
  always-visible toggle was overflowing 375px viewport).

### Owner Dashboard placeholder fixes — `a0b351a`
- Late Orders KPI: confirmed `orders.accepted_at` does not exist.
  Kept the `longestMins > 30` heuristic but show "≥1 · 38m" instead
  of misleading "1+".
- Slowest items: `slice(2, 5)` instead of buggy `slice(-2)` so the
  card actually has 3 entries. Label updated in both locales.
- Acceptance Time: stays `--`, renamed to "Acceptance Time" /
  "وقت القبول" with hint "Not tracked yet" / "غير متوفر".

### Vercel build unblock — `ab7368f`, `4397ea6`, `be897f1`
- Fixed 9 `no-explicit-any` ESLint errors that were failing
  `next build` (ReservationsClient.tsx, DeliveryProofCapture.tsx,
  DriverPWAShell.tsx).
- `/[locale]/dashboard/menu` marked `export const dynamic =
  'force-dynamic'` to silence DYNAMIC_SERVER_USAGE stack on every
  deploy.
- 13 additional ESLint warnings cleared (10 unused identifiers,
  2 raw `<img>` → `next/image`, 1 hook deps).
- `package.json` engines pinned to `"node": "20.x"`.

### Test-data cleanup
- Cancelled the 4 stale active orders carried over from session 92
  with `[stale_test_cleanup 2026-05-13]` note tag.
- Hard-deleted 20 test orders / 19 cash-COD payments via a two-step
  CTE (`del_payments` → `del_orders`). CASCADE handled order_items
  + the standard chain; SET NULL on driver_locations +
  points_transactions. Saved as memory `feedback_orders_delete_fks`.

### Playwright test rewrites — `f90536d`, `4547db6`
- "Branches nav link" → "Contact nav link" (matches new NAV_LINKS).
- "WhatsApp link on /contact" → `+973` text assertion. The contact
  page renders phones as plain text inside Phone-iconned cards, not
  as tel: anchors; the historical wa.me match was passing only via
  the Header CTA that we replaced.

### Orphan asset cleanup
- `ffef5bd` removed 3 unreferenced recipe `.mp4` files (35.6 MB
  total). Sibling `.webp` posters were removed by Gemini in
  `92ec1cc`.

## SENTRY SOURCEMAP JOURNEY (status: pending verification)

Three Vercel deploys had spam of "could not auto-detect referenced
sourcemap" warnings for UUID-named server chunks
(`.next/server/chunks/<uuid>.js`). The fix chain:

1. **`be897f1`**: `productionBrowserSourceMaps: false` → `true` in
   `next.config.ts`. Enables CLIENT sourcemaps. Confirmed first-half
   fix.
2. **`d456a1f`**: added `experimental.serverSourceMaps: true` to
   try to enable SERVER sourcemaps. **Did not produce `.map` files
   for the UUID-named chunks in Next 15.5** — warnings persisted.
3. **`2f2c69f`**: added explicit `authToken: process.env.SENTRY_AUTH_
   TOKEN` and `sourcemaps: { disable: false }` to fail loud if the
   env var is missing.
4. **`62112d6`**: REPLACED `experimental.serverSourceMaps` with
   `unstable_sentryWebpackPluginOptions.sourcemaps.assets:
   ['.next/**/*.js', '.next/**/*.js.map']`. **Effectiveness pending
   the next Vercel deploy log.**

**Memory saved**: `feedback_sentry_sourcemaps_nextjs15` — captures
the pattern so the next session doesn't redo the same investigation.

## OPEN ISSUES (carry to next session)

### Sentry sourcemap pipeline — needs verification on Vercel
After `62112d6` lands, scan the build log:
- ✅ Success → `Successfully uploaded N files` + no "could not
  auto-detect" lines.
- ❌ "no auth token configured" → set `SENTRY_AUTH_TOKEN` in Vercel
  production env: `vercel env add SENTRY_AUTH_TOKEN production`.
- ❌ Warnings persist → glob captured the files but they lack the
  `//# sourceMappingURL=` reference; would need to change the
  `devtool` setting via the plugin's webpack hook.

### Sentry SDK init inconsistencies (P2, separate from sourcemaps)
- `sentry.edge.config.ts` has `tracesSampleRate: 1` (vs server +
  client at 0.1) — burning Sentry quota.
- `sendDefaultPii: true` on edge + client contradicts server's
  explicit `false`. Pick one stance.
- DSN is hardcoded inline in all 3 init files; the
  `NEXT_PUBLIC_SENTRY_DSN` env-var placeholder in `.env.example` is
  unused.

### Vercel project-level warnings
- "Node.js Version Override" tag in the deploy UI — confirm
  Project Settings → General → Node.js Version is set to 20.x to
  match `package.json` engines.
- "3 Recommendations" — at least 2 are Speed Insights + Web
  Analytics ("Not Enabled" in the dashboard). Third unidentified.

### Gemini sibling agent
At session end the working tree is clean (no uncommitted Shifts
work). Gemini's last edit was `92ec1cc` (recipe-poster cleanup).
Sibling-agent migration-number collision watch still applies for
the next session.

## DECISIONS LOGGED
- **`force-dynamic` on `/dashboard/menu`** instead of try/catching
  the DYNAMIC_SERVER_USAGE error in `getMenuData()`. Cleaner intent
  signal.
- **Hard DELETE on test orders** (not cancel) per Ahmed's call,
  after verifying the 19 payment rows had no gateway IDs or
  refunds.
- **Mobile header design**: Reserve CTA stays as a brand-gold icon
  button (44×44) on the always-visible bar. Language toggle stays
  inside the hamburger overlay; putting it inline overflowed 375px.
- **`unstable_sentryWebpackPluginOptions.sourcemaps.assets` over
  `experimental.serverSourceMaps`** — Next 15.5 didn't honor the
  experimental flag for the Server Component module chunks. The
  Sentry-side explicit glob is more direct.
- **Bundled Gemini polish + my P0 fixes** into commit `c383235`
  because the P0 hunks were inside Gemini's diffed lines and
  couldn't be split.

## MEMORY UPDATES
- New: `feedback_orders_delete_fks` — `DELETE FROM orders` is
  blocked by `payments` (RESTRICT), `driver_earnings`, and
  `inventory_movements` (no-action). Inventory child tables before
  any bulk delete.
- New: `feedback_sentry_sourcemaps_nextjs15` — Next 15.5 +
  `@sentry/nextjs` v10 sourcemap pipeline; `experimental.
  serverSourceMaps` is not sufficient, use
  `unstable_sentryWebpackPluginOptions.sourcemaps.assets` instead.
- Indexed in `MEMORY.md`.

## STATUS
- **TSC**: clean (every commit).
- **Local `npm run build`**: 0 warnings, 0 errors, 548/548 static
  pages (verified after `be897f1`).
- **Playwright on `be897f1`**: 133 passed, 2 failed (contact phone
  AR + EN); fixed in `4547db6` (pending CI verification).
- **Git**: local `master` == `origin/master` (last push:
  `62112d6`).
- **Migrations**: local 120 + 121 + 122 match prod.
