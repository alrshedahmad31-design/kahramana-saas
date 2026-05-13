# LAST-SESSION.md — Kahramana Baghdad
> Session 95: dashboard security audit close-out (CRITICAL + HIGH + Batch 1
> + Batch 2), i18n gate 8 script, header dedup, Sentry tunnel removal,
> migration 123 (atomic stock RPC)
> Date: 2026-05-13
> Author: Claude Code (sole contributor; sibling Gemini agent inactive on
>         repo this session but applied 8 ad-hoc DB migrations via Studio
>         between 2026-05-12 16:46 and 2026-05-13 07:10 — see Open Issues)

## SUMMARY
Heavy security + data-integrity session. 11 commits pushed (`8f956ed` →
`aa25dd2`). Five threads:

1. **Dashboard audit close-out** — 9 findings actioned across CRITICAL
   (fail-closed branch scope, staff page guard), HIGH (delivery race
   condition, inventory Zod), Batch 1 security (exportToExcel guard,
   coupon scope, ingredient RBAC, refund audit log), Batch 2 data-
   integrity (allergen smart-diff, atomic stock RPC, dine_in mapping).
2. **i18n gate 8 — script + 13 key fixes** — `scripts/check-i18n.ts`
   built (parity + t() usage scan; handles t.raw against intermediate
   nodes, multi-scope translator aliasing). First run found 13 genuine
   missing-key bugs; all 13 added with reviewed AR/EN copy.
3. **Header dedup** — removed duplicate CSP from vercel.json (session
   94); this session removed duplicate Cache-Control + 4 duplicate
   security headers from vercel.json, fixed the /driver no-store
   override caused by the next.config.ts catch-all stomping on it.
4. **Migration 123** — `rpc_record_opening_balance` (atomic movement
   insert + stock upsert in one transaction). Applied to prod via
   `supabase db push` after drift investigation (see Open Issues).
   Stock action rewritten to call the RPC; the prior 30-line two-step
   pattern collapsed to a single typed call.
5. **Sentry tunnel route removed** — `/monitoring` route deleted from
   `next.config.ts`. Was a Fluid Active CPU drain (every error event
   = one function invocation). Free-tier alert at 75% prompted the
   change; CSP `connect-src` already allowed `*.ingest.sentry.io`.

## COMMITS THIS SESSION (in order)

- `8f956ed` fix(security): fail-closed branch scope + staff page guard
- `1273096` fix(actions): delivery race condition + inventory Zod
  validation
- `3619569` feat(i18n): add gate 8 check-i18n script — parity + t()
  usage scan
- `7925e1c` fix(i18n): add 13 missing keys — common, account.
  transactions, priceHistory.unspecified
- `97ad38d` chore(state): mark /dashboard/payments delivered — Tap
  refund API still merchant-blocked
- `481fcbb` fix(headers): resolve cache conflicts + remove duplicate
  vercel.json headers
- `e41c051` fix(security): exportToExcel guard + coupon scope +
  ingredient RBAC + refund audit log
- `44ddc38` fix(data-integrity): atomic allergen upsert + stock
  movement + dine_in order type
- `90e7c29` fix(data-integrity): stock opening balance via atomic RPC
  (migration 123)
- `aa25dd2` perf(sentry): remove tunnel route — send events direct to
  ingest

## SECURITY / DATA-INTEGRITY CHANGES — DETAIL

### Branch scope fail-closed — `8f956ed`
`pos/actions.ts:117-124` and `pos/service/actions.ts:88-93` had the
classic `caller.branch_id && caller.branch_id !== input.branch_id`
short-circuit bug: a `branch_manager`/`cashier`/`waiter` with NULL
`branch_id` (data integrity hole, role demotion artefact, seed-script
miss) would bypass the check entirely and submit orders to any branch.
Both files now use `!caller.branch_id || caller.branch_id !== input.branch_id`.

### Staff profile page guard — `8f956ed`
`dashboard/staff/[id]/page.tsx` only checked `if (!user)` then rendered
profile + shifts + timesheets + leave. Any authenticated staff member
could hit any other's profile by URL. Added `canViewStaff(user, staff)`
between fetch and render — owner/GM, self, or branch_manager-of-same-
branch. Rejects via `notFound()` (no existence leak).

### Delivery confirm race — `1273096`
`delivery/actions.ts:confirmDelivery` read `order.status` then wrote
`status='delivered'` unconditionally. Concurrent cancel/reassign could
flip the order between read and write. Now compare-and-swap:
`.update(...).eq('id', ...).eq('status', order.status).select('id')`
— 0-row response → returns "status changed — please refresh".

### Inventory Zod validation — `1273096`
`upsertIngredient` and `upsertPrepItem` previously took raw FormData
into the DB after only a name-required check. NaN, negatives, empty
trim, out-of-range percentages all sailed through. Both now use full
Zod schemas with enum validation against the CHECK-constrained sets;
`prepIngredientSchema` also added for `savePrepItemIngredients` rows.

### Coupon branch-scope — `e41c051`
`updateCoupon` allowed any `branch_manager` (passing `canManageCoupons`)
to edit ANY coupon. Now: after the role gate, branch_managers must
either be `created_by` of the coupon OR have their `branch_id` in
`applicable_branches`. Global coupons (`applicable_branches IS NULL`)
are owner/GM only unless the branch_manager created them.

### exportToExcel guard — `e41c051`
`inventory/reports/actions.ts:exportToExcel` was a public server action
with zero auth. Free server-side compute primitive (ExcelJS) callable
by anyone with cookies. Gated to
`[owner, general_manager, branch_manager, inventory_manager]` (matches
`rbac-ui.ts inventory_reports`).

### Refund audit log — `e41c051`
`payments/actions.ts:refundPayment` flipped DB state from completed →
refunded with no audit trail. For a financial event this is missing
basic compliance. Added best-effort `audit_logs` insert with
`operation: 'refund'`, prev/new status, amount, caller identity +
branch. Failure logging does NOT fail the refund (matches
coupons/delivery pattern).

### Ingredient RBAC alignment — `e41c051`
`upsertIngredient` blocked `inventory_manager`; `rbac-ui.ts` granted
them UI access. Added to allowed roles. `deleteIngredient` left
stricter (owner/GM only) — destructive ops kept tight.

### Allergen smart-diff — `44ddc38`
`ingredients/[id]/actions.ts:115-126` did `delete-all → insert-new`;
if the insert failed, ingredient ended up with ZERO allergens (food-
safety data). Reversed order: `upsert(new_set, ignoreDuplicates)` first,
then `delete WHERE allergen NOT IN (new_set)`. If step 2 fails, worst
case is EXTRA allergens (over-warning customers — safe) instead of
missing ones. Allergen values pre-validated against
`ALLOWED_ALLERGENS` constant so the IN-list is injection-safe.

### POS dine_in mapping — `44ddc38`
`pos/actions.ts:251` was still mapping `dine_in → 'pickup'` with stale
"orders table only supports pickup/delivery" comment. Migration 087
(applied 2026-05-09) added `dine_in` to the CHECK constraint. Now maps
`dine_in → 'dine_in'` so KDS/analytics/waiter views can distinguish
tablet-served dine-in from walk-in pickup.

### Atomic stock opening balance — `44ddc38` + `90e7c29`
**Migration 123** (`123_rpc_record_opening_balance.sql`) ships a
`SECURITY DEFINER` PL/pgSQL function that wraps the movement insert +
stock upsert in one transaction, with locked `search_path` and
service-role-only `GRANT EXECUTE`. Two-commit safe sequence:
- Commit 1 (`44ddc38`) — migration file + TODO comment, no behavior change
- User applied via `supabase db push` (drift had to be resolved first
  — see Open Issues)
- Commit 2 (`90e7c29`) — `stock/[branchId]/actions.ts` rewritten to
  call the RPC, 30-line two-step pattern collapsed. Uses
  `'rpc_record_opening_balance' as never` cast (codebase convention,
  see `src/lib/analytics/queries.ts:684`) until `supabase gen types
  --linked` is rerun.

## OTHER CHANGES — DETAIL

### Gate 8 i18n script — `3619569`
`scripts/check-i18n.ts` does two checks:
- **Parity** — every leaf key in ar.json must exist in en.json and
  vice versa. Leaf-only; intermediate nodes are structural.
- **Usage** — every static `t('x')`/`t.rich('x')`/`t.markup('x')`/
  `t.raw('x')` call in src/ resolves to a key in EITHER messages
  file. `t.raw()` may target intermediate object nodes (legitimate
  next-intl pattern, e.g. `t.raw('story.milestones.m1')` returning a
  `{year,title,desc}` subtree); plain `t()` must target leaves.

Handles same-identifier scope shadowing (e.g. `[locale]/page.tsx` has
one `t` for `seo` namespace in `generateMetadata` and a no-namespace
`t` in the page body — script tries both candidates, passes if any
resolves). Exits 0/1/2; `--json` flag for CI parsing. CLAUDE.md gate
8 command updated from non-installed `ts-node` to actually-installed
`tsx`.

### 13 i18n key fixes — `7925e1c`
First gate 8 run found 13 `t()` calls referencing nonexistent keys
(would render raw key string via next-intl `MISSING_MESSAGE` in
production). Added: `common.{ingredient,price,branch,noResults,
report,lastUpdated}`, `account.{noTransactions,transactions.
{earned,redeemed,bonus,expired}}`, `inventory.reports.priceHistory.
unspecified`. AR/EN values reviewed before write. Gate 8 now passes
2,223 keys / 2,223 keys, 593 source files, zero findings.

### Header dedup — `481fcbb`
Two real bugs + four redundancies fixed:
- `/driver(.*)` had `Cache-Control: no-store` in vercel.json but
  next.config.ts catch-all `(?!_next/static)` ALSO matched and added
  `public, s-maxage=86400`. Driver PWA HTML could go stale up to 24h.
- `/images/*` had two conflicting Cache-Control rules.
- 4 exact-duplicate Cache-Control entries + 4 duplicate security
  headers across both files.
Fix: next.config.ts catch-all → `(?!_next/static|driver|images)`;
vercel.json stripped to just `/driver(.*) no-store` and
`/images/(.*) 1d+7d-SWR`. From 59 lines → 26 lines.

### /dashboard/payments — `97ad38d`
Discovered during the queue review: page already shipped (738 LOC
across 8 files including PaymentStatsCards, PaymentFilters,
PaymentsTable, CashHandoversSection). Stale "deliverables_pending"
entry in phase-state.json from Phase 6. Moved to delivered. Tap
refund API call (vs. DB-only refund flip) IS still pending merchant
keys — noted as a separate pending item.

### Sentry tunnel route removal — `aa25dd2`
`tunnelRoute: "/monitoring"` removed from `next.config.ts`. Vercel
free-tier hit 75% Fluid Active CPU usage and triggered the alert
that prompted this. Every Sentry event was routing through a Next.js
function (≈1 function invocation per captured error). Browser SDK
now sends events directly to `*.ingest.sentry.io`; CSP
`connect-src` already allowed those origins
(`src/middleware.ts:62`). Trade-off: aggressive ad-blockers may
drop events. Acceptable — restaurant staff aren't running uBlock
in the dashboard.

## OPEN ISSUES (carry to session 96)

### **8 ad-hoc timestamp migrations on remote — UNRESOLVED**
Discovered during the migration-123 push attempt. Remote
`schema_migrations` has 8 versions with no local file:
```
20260512164612, 20260512174235, 20260512181529, 20260512182545,
20260512194842, 20260513062035, 20260513065509, 20260513071015
```

These were applied via Supabase Studio's SQL editor or MCP
`apply_migration` — outside `supabase db push`. The `.agent/
db_migration_state.md` standing rule was violated 8 times: "After
applying a migration outside `supabase db push`, register it
manually in `schema_migrations` so future `db push` doesn't re-run
it."

Most likely culprit: sibling Gemini agent (per memory
`project_cowork_sibling_agent.md`).

**To unblock future migrations**, run in Supabase SQL editor:
```sql
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260512164612','20260512174235','20260512181529','20260512182545',
  '20260512194842','20260513062035','20260513065509','20260513071015'
)
ORDER BY version;
```

Then for each: either backfill as a numbered local file (matching
the SQL the dashboard ran) or `supabase migration repair --status
applied <timestamp>` if the change was a one-time no-op.

(For migration 123, the user applied via path that bypassed the
drift block — recorded as "Migration 123 applied" in the
conversation. The drift remains.)

### Supabase types regen pending
`stock/[branchId]/actions.ts:30,35` uses `'rpc_record_opening_
balance' as never` and `as never` on the args object. Both will
silently keep "working" forever — they don't auto-fail when types
catch up. Run when convenient:
```
npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts
```
Then strip the casts in a 2-line cleanup commit.

### Sentry sourcemap pipeline — still unverified
Build logs for sessions 94 + 95 commits (`a3bfba8`, `4707f7f`,
`aa25dd2`) not yet inspected. Scan for `Successfully uploaded N
files` with release matching `kahramana-master-{short-sha}` AND
no `could not auto-detect referenced sourcemap` lines on
`.next/server/**` or `.next/static/**`.

### Vercel env vars — verify before next deploy
- `NEXT_PUBLIC_SENTRY_DSN` must exist for Preview + Production
  (DSN no longer inlined since session 94 commit `a3bfba8`).
- `SENTRY_AUTH_TOKEN` confirmed Production; Preview never
  explicitly verified.

### Deferred from dashboard audit (session 96+ candidates)
- #5 reservations: actions throw `Error` instead of returning
  `{ success, error }` — refactor needed (low risk, isolated).
- #7 POS full transaction: order + payment + audit are separate
  calls; failure leaves orphan order rows. Needs an RPC like the
  inventory work. Complex.
- #16 slug resolution — flagged "read first, report before
  touching" in audit. Untouched this session.
- #11–#15 audit findings — backlog.

### Free-tier CPU
Tunnel removal should produce a meaningful drop. Re-check Vercel
dashboard after 24h. If still climbing, options on the table:
- Reconsider `force-dynamic` on dashboard pages (some can revalidate)
- Set Sentry `tracesSampleRate: 0` in production (currently 0.1)
- Upgrade to Pro plan (~$20/mo/seat, 100 CPU-hrs/mo + on-demand)

## DECISIONS LOGGED

- **F-08 (route structure in Sentry transactions)** verified-low,
  no change — comment added in next.config.ts. Routes are already
  public in `_buildManifest.js`; sanitizing transactions would
  destroy Sentry debugging utility for zero real attack-surface
  reduction.
- **Allergen fix: insert-first then delete-stale** chosen over a
  new RPC migration. The failure mode improvement (over-warning
  vs under-warning) is what matters for food safety; full
  atomicity wasn't required.
- **Stock fix: full RPC migration** chosen over compensating-
  delete fallback. Different tables, can't be done in one
  Supabase JS call; financial-trail data warrants real
  atomicity.
- **Two-commit migration sequence for #8** instead of single
  commit with fallback code — avoids a window where prod runs
  against a non-existent RPC.
- **Sentry tunnel: remove vs keep** — removed. Restaurant staff
  use case doesn't include ad-blockers; CPU savings outweigh.
- **vercel.json CSP removed (session 94), now Cache-Control +
  security headers also removed (session 95)** — middleware +
  next.config.ts is now the single source of truth for headers.
- **deleteIngredient kept stricter than upsertIngredient** —
  `inventory_manager` can upsert but only owner/GM can delete.
  Destructive ops kept tight; not scope creep on this fix.

## MEMORY UPDATES

None new this session. Existing memories
(`feedback_supabase_types_lag_enum`,
`project_cowork_sibling_agent`, `db_migration_state`) remain
relevant; the 8 timestamp-migration drift is a fresh instance of
the documented sibling-agent risk.

## STATUS

- **TSC**: clean after every commit.
- **Local `npm run build`**: clean after every commit. Only
  warning remains the pre-existing `@sentry/nextjs` deprecation
  notice for `unstable_sentryWebpackPluginOptions` (deferred from
  session 93, unrelated).
- **Gate 8 (i18n)**: PASS — 2,223 keys / 2,223 keys, 593 files,
  zero findings.
- **Git**: local `master` == `origin/master` (last push:
  `aa25dd2`).
- **Migrations**: 123 latest on prod. Drift of 8 unknown timestamp
  entries on remote — must be resolved before next `db push`.
- **Working tree**: clean at end of session.
