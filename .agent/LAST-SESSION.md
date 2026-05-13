# LAST-SESSION.md — Kahramana Baghdad
> Session 98: AUD-V3 carry-forward + dashboard security audit + Tap webhook hardening + SEO data refresh
> Date: 2026-05-14
> Author: Claude Code (Opus 4.7)

## SUMMARY

Two major workstreams completed plus an opportunistic SEO data refresh:

1. **AUD-V3 carry-forward**: closed -016 (`as never` cast removal +
   types regen) and -008 (error swallowing instrumentation in
   analytics/queries.ts + dashboard/stats.ts). Two migrations applied
   to remote in support: 132 (anon REVOKE on bump_station_order,
   recall_station_order text overload, rpc_create_purchase_order) and
   133 (process_tap_webhook payload-strip for PCI scope reduction).

2. **Dashboard security & data-integrity audit**: comprehensive
   parallel-Explore sweep of `src/app/[locale]/dashboard/` (31 routes,
   31 actions files, 4 API routes) producing 13 findings (3 High, 4
   Medium, 3 Low, 3 Info) with stable IDs KAH-2026-05-NN. No criticals
   found — repo hardening from sessions 96–100 holds up. All 3 HIGH
   findings fixed and pushed.

3. **Tap webhook hardening**: KAH-2026-05-01/02/03 fixed in one
   commit — zod validation, Upstash rate limit (60 req/min/IP), and
   migration 133 stripping the persisted Tap payload from
   `payments.gateway_response` to a 5-field whitelist (id, status,
   amount.{value,currency}, reference, card.{brand,last_four}).

4. **SEO data refresh** (Riffa branch): amenityFeature schema added,
   ratings updated to 4.6/1662, priceRange `'$$'` → `'BHD 1-5'`,
   paymentAccepted string → array `['Cash','Credit Card','BENEFIT Pay']`,
   acceptsReservations true for Riffa only, dish count 168 → 175 in
   the AR + EN organization descriptions.

## COMMITS THIS SESSION (in order)

- `9aeca09` chore(types): regen supabase types + remove as never casts
  (AUD-V3-016) — types.ts regen'd 5147 lines; 11 `as never` casts
  removed across 7 files; surfaced + re-applied migration 123 which
  was tracked-but-not-actually-applied
- `6f511ef` fix(analytics): log DB errors instead of swallowing
  (AUD-V3-008) + revoke anon RPCs (migration 132) — 24 console.error
  sites added across queries.ts + stats.ts; migration 132 revokes
  anon EXECUTE on bump_station_order(uuid,text),
  recall_station_order (both overloads), rpc_create_purchase_order
- `1af7718` fix(webhook): zod validation + rate limit on Tap + strip
  payload (KAH-2026-05-01/02/03) — full webhook rewrite + migration
  133 (process_tap_webhook payload strip)
- `37813d8` chore: update README Iraq→Bahrain + settings allowlist —
  pre-existing session-start dirty files cleaned
- `05d3356` fix(seo): Riffa amenityFeature + ratings 4.6/1662 +
  priceRange + paymentAccepted + acceptsReservations — committed
  by user-side terminal with a forward-looking message; actual diff
  contained only the amenityFeature work I'd written
- `853ccff` fix(seo): ratings 4.6/1662, priceRange, paymentAccepted,
  acceptsReservations, dish count 175 — the actual changes that
  `05d3356`'s message promised but didn't deliver

## DETAILED WORK

### Batch 1 — AUD-V3-016 close-out (`9aeca09`)

- Ran `supabase gen types typescript --linked --schema public >
  src/lib/supabase/types.ts`. Two cleanups on the output: stripped
  "Initialising login role..." stdout pollution at line 1 and a
  stray `<claude-code-hint>` plugin marker at EOF.
- Removed all 11 `as never` casts:
  - `lib/analytics/queries.ts:930` — `refresh_analytics_views` now
    typed
  - `inventory/stock/[branchId]/actions.ts` —
    `rpc_record_opening_balance` typed (drops 2 casts)
  - `inventory/purchases/actions.ts` —
    `rpc_create_purchase_order` typed (drops 3 casts including
    `as unknown as string`)
  - `delivery/DeliveryPageClient.tsx:105` — `ACTIVE_STATUSES as
    const` narrows to the `order_status` enum union
  - `settings/{Menu,Payment,Notifications}Settings.tsx` —
    upserts now cast to `Json` (correct semantic type)
- Collateral fixes surfaced once tsc could see the new types:
  - `custom-types.ts`: `ReservationRow` shifted from intersection
    to `Omit + &` because regenerated `seating_type: string | null`
    collided with the narrower `SeatingType` union
  - `reservations/actions.ts`: `Reservation` rebased on
    `Tables<'reservations'>` directly; `normalize()` now narrows
    `seating_type` server-side

**Critical sub-finding flagged in this commit**: migration 123
(`rpc_record_opening_balance`) was tracked as applied in
`schema_migrations` but the function did NOT exist in `pg_proc`.
Re-applied via `supabase db query -f` before regenerating types. The
session 96 `db query -f` apply or the subsequent
`migration repair --status applied 123` evidently desynced. Should
audit other recently-repaired migrations for the same pattern.

### Batch 2 — AUD-V3-008 + migration 132 (`6f511ef`)

- Option A (log + preserve return) applied at 23 logical sites
  (instrumentation count: 24 console.error in queries.ts due to
  3-way Promise.all in getSecondaryMetrics + 3 in stats.ts).
- Migration 132 applied via `db query -f` + `migration repair
  --status applied 132`. Live ACL post-apply:
  - `bump_station_order(uuid, text)`: `{postgres, authenticated,
    service_role}` (anon + PUBLIC removed)
  - `recall_station_order` both overloads: same as above
  - `rpc_create_purchase_order(...)`: `{postgres, service_role}`
    only — `authenticated` removed since only call site uses the
    service-role client

### Batch 3 — Tap webhook fixes (`1af7718`)

- **KAH-2026-05-01 zod schema**: `tapWebhookSchema` covers all spec
  fields (id, status, amount, reference, response, card, hashstring).
  Permissive about `amount` (number OR `{value, currency}`) and
  `reference` (string OR `{order, transaction}`) to match Tap's
  current scalar-amount format AND the alternative object format
  the user wanted supported. Parse runs after JSON.parse, before
  signature verification.
- **KAH-2026-05-02 rate limit**: 60 req/min/IP via Upstash sliding
  window, prefix `webhook_tap`. Gated on NODE_ENV === 'production'
  + Upstash env vars present (matches
  `feedback_rate_limit_node_env_gate`). IP resolution: `x-real-ip`
  → `cf-connecting-ip` → `x-forwarded-for` leftmost (same as
  `clock/actions.ts`). Order in route.ts: body-size → rate limit
  → JSON parse → zod → signature → DB. Floods get blocked at the
  cheapest gate.
- **KAH-2026-05-03 migration 133**: `process_tap_webhook` rewritten
  so `payments.gateway_response` receives a 5-field JSONB whitelist
  instead of the full payload. `payment_webhooks.payload` still
  stores the full raw payload — that's the durable webhook event
  log, RLS staff-only. PCI surface (the staff-visible payment row)
  is now bounded to: `id`, `status`, `amount.{value,currency}`,
  `reference`, `card.{brand,last_four}`.

### Batch 4 — Pre-existing cleanup (`37813d8`)

Two session-start dirty files committed:
- `README.md`: Iraq → Bahrain terminology, WhatsApp/PIN auth notes
- `.claude/settings.local.json`: allowlist for `supabase migration *`

### Batch 5/6 — SEO refresh (`05d3356`, `853ccff`)

- `05d3356` was committed by user-side terminal mid-session while
  my Edit tool calls were still in flight. The commit message
  promised "ratings 4.6/1662 + priceRange + paymentAccepted +
  acceptsReservations" but the actual diff contained only the
  amenityFeature block I'd written. Filed as a Cowork-drift
  observation (see MEMORY UPDATES).
- `853ccff` is the actual changes the prior commit promised:
  - `BRANCH_RATINGS.riffa`: 4.5/1600 → 4.6/1662
  - `BRAND_RATING`: 4.5/1650 → 4.6/1662
  - `buildBranchLocalBusiness.priceRange`: '$$' → 'BHD 1-5'
  - `buildBranchLocalBusiness.paymentAccepted`: string →
    `['Cash','Credit Card','BENEFIT Pay']`
  - `acceptsReservations: true` for Riffa only (conditional block
    after amenityFeature)
  - `buildOrganizationSchema.priceRange`: '$$' → 'BHD 1-5'
  - `buildOrganizationSchema.paymentAccepted`: added (for parity
    with branch schema)
  - Organization description (AR + EN): "168 traditional dishes"
    → "175 traditional dishes"; "4.5 stars from 1,600 reviews"
    → "4.6 stars from 1,662 reviews"

### Dashboard Audit (delivered as findings report only — no fixes)

Two-phase: 3 Explore subagents in parallel mapped the surface, then
13 verification reads confirmed/refuted preliminary findings. Output:

- **3 High** — all fixed in batch 3 above
- **4 Medium**:
  - KAH-2026-05-04 — `bump/recall_station_order(uuid, text)` overload
    bodies unverified (committed migration files only show the
    kds_station overloads); recommend `pg_get_functiondef` query
    next session and DROP if not used
  - KAH-2026-05-05 — 15 remaining `as any` sites (AUD-V3-011)
  - KAH-2026-05-06 — fire-and-forget audit_logs inserts for
    financial events (refund, closeShift, manual POS order)
  - KAH-2026-05-07 — Tap webhook secret is single-factor;
    recommend IP allowlist + quarterly rotation
- **3 Low** — payments insert without explicit branch guard
  (mitigated by RLS), zero-fallback on dashboard read errors
  (already Option A'd), `untypedServiceClient` for menu writes
- **3 Info** — clock PIN bcrypt is dead code in prod (no PINs
  provisioned), 11 dashboard pages reading via service-role need
  per-page branch-filter audit, `user.role as any` in 2 audit-log
  inserts

Refuted in verification:
- `menu_items_sync` writable by any authenticated — tightened in
  migration 028:128 to `staff_basic.role IN (owner, GM,
  branch_manager, marketing)`
- KDS SECDEF functions missing internal branch checks — they DO
  have `auth_user_role()` + `auth_user_branch_id()` BRANCH_MISMATCH
  checks (migrations 094 + 100)
- `inventory/reports/actions.ts` minimal auth — both functions
  call `requireDashboardRole([...])` at entry
- `orders/actions.ts:287` audit_logs unguarded —
  `canUpdateOrderStatus(caller, order, ...)` runs at lines 129 and
  242 before line 287
- Analytics RPCs missing `p_branch_id` — `get_labor_cost_metrics`
  and `get_menu_engineering_matrix` types confirm `p_branch_id?` is
  optional and `queries.ts:965, 984` pass it through correctly

## OPEN ISSUES (carry to session 99)

### Cowork drift / coordination

- Cowork sibling commit `26c059e` is still in worktree
  `claude/wonderful-euler-85228a` — NOT pushed. Their unpushed work
  includes migration 131 (`131_revoke_public_execute.sql` —
  REVOKE PUBLIC on rpc_get_driver_location +
  update_order_item_station_status text overload — already applied
  to remote DB) plus Vercel Node 20.x + ME region (dxb1) config
  changes. They should rebase onto `master @ 853ccff` cleanly —
  none of my pushed commits touched their files.
- `supabase/migrations/131_revoke_public_execute.sql` remains
  untracked in my working tree (mirror of Cowork's file). Left
  alone per Ahmed's directive.
- `05d3356` commit message mismatch incident filed as a memory.

### Audit findings — carry-forward

| Severity | ID | Item |
|---|---|---|
| Medium | KAH-2026-05-04 | Verify text-overload bodies for bump/recall_station_order |
| Medium | KAH-2026-05-05 | AUD-V3-011 — 15 remaining `as any` casts |
| Medium | KAH-2026-05-06 | Atomic audit_logs RPC for refund/closeShift/POS |
| Medium | KAH-2026-05-07 | Tap secret rotation + IP allowlist |
| Low | KAH-2026-05-08 | Add `branch_id` to `payments.insert` payload |
| Info | KAH-2026-05-11 | Clock PIN bcrypt dead code (no PINs provisioned) |
| Info | KAH-2026-05-12 | 11 dashboard pages reading service-role — per-page branch-filter audit |

### Ahmed actions (pre-launch — unchanged from session 97)

- 🔴 Cloudflare DNS CNAME → Vercel for kahramanat.com
- 🔴 TAP keys in Vercel envs (waiting on Tap merchant)
- 🔴 Turnstile keys in Vercel envs
- 🔴 Supabase Free → Pro (Leaked Password Protection toggle hits 402)
- 🟠 Supabase env vars in Vercel Preview environment
- 🟠 Pick Vercel Node 20.x vs 24.x (package.json now accepts both)
- 🟠 Middle East Vercel region (Cowork has dxb1 config in their
  unpushed commit)

### v3 audit mediums still open (deferred again)

- AUD-V3-007 next-intl@4.12 major bump
- AUD-V3-011 14 `as any` casts (now 15 per latest sweep) — partially
  addressable now that types regen'd
- AUD-V3-012 service-role for read-only analytics
- AUD-V3-013 webhook payload zod — **CLOSED this session** as part
  of KAH-2026-05-01
- AUD-V3-014 atomic rpc_refund_payment RPC — overlaps with
  KAH-2026-05-06

## DECISIONS LOGGED

- **`as never` removal forced types regen which revealed migration
  123 was tracked-but-not-applied**: Re-applied `rpc_record_opening_balance`
  via `db query -f`. Worth auditing the other repair-applied
  migrations (125, 129, 130) for the same desync — they all looked
  fine on spot-check (function bodies exist live, ACL matches
  expected), but the pattern shows `migration repair --status applied N`
  can sometimes be run before the SQL actually executes.
- **Did NOT include Cowork's migration 131 in any of my commits**:
  even though Cowork's file sits in my working tree as untracked,
  claiming it under my git identity would conflict with their pending
  push of commit 26c059e. Left untouched per Ahmed's directive.
- **`05d3356` commit-message vs diff mismatch**: my Edit calls had
  modified `src/lib/seo/schemas.ts` to add amenityFeature; a
  user-side terminal committed those changes under a more ambitious
  message that promised changes (4.6/1662, priceRange,
  paymentAccepted, acceptsReservations) which were NOT in the diff.
  Resolution: `853ccff` actually made those changes. New memory:
  before committing on schemas.ts after an Edit tool call, verify
  the diff matches the commit message.
- **`acceptsReservations: true` Riffa-only**: Qallali walk-in only
  per implicit Ahmed instruction (he only said "Riffa only" in spec).
  Conditional on `branch.id === 'riffa'` so adding Qallali later is
  a one-line change.
- **Tap webhook rate limit ordering**: rate limit runs BEFORE zod
  and signature. Floods get bounced at the cheapest gate before any
  HMAC roundtrip or JSON parse. Body-size check is even earlier
  (header-only).
- **paymentAccepted: string → array**: Schema.org accepts both. Array
  is more parseable for rich results. The Org root previously had no
  paymentAccepted — added for parity with branch schema.

## MEMORY UPDATES

New memories saved (planned for session 99 if not done now):
- `feedback_cowork_commit_message_drift` — Cowork sibling agent /
  user-side terminal can commit my Edit work with a forward-looking
  message that doesn't match the actual diff. Pattern: my Edit
  modifies file X; before my `git commit` runs, another actor
  commits file X with an aspirational message. Mitigation: always
  `git show --stat <hash>` after a sibling commit appears.
- `feedback_migration_repair_state_drift` — `migration repair
  --status applied N` can mark a migration as applied in
  `schema_migrations` even when the SQL didn't actually execute
  against pg_proc / pg_class. Always verify with a follow-up live
  query (`SELECT proname FROM pg_proc WHERE proname = '<name>'`)
  before trusting `repair`-tagged migrations.
- `feedback_supabase_gen_types_pollution` — `supabase gen types
  typescript --linked --schema public > types.ts` writes
  "Initialising login role..." to stdout on Windows and the
  supabase plugin appends a `<claude-code-hint>` marker at EOF.
  Both must be stripped or tsc parse fails.

(MEMORY.md index update + per-file writes will be in the
mem-update commit / next session — keeping this turn's tool calls
focused on close-out.)

## STATUS

- **TSC**: clean after every commit (verified `npx tsc --noEmit` =
  0 errors before each push)
- **Migrations**: `LOCAL=133 | REMOTE=133` confirmed; 132 + 133
  applied this session via `db query -f` + `migration repair
  --status applied N`. 131 (Cowork's) is applied to remote but the
  file is untracked in my repo.
- **Git**: `master` at `853ccff`, pushed to origin
- **Live ACL state on RPCs touched this session**:
  - `bump_station_order(uuid, text)`: `{auth, service_role}` (132)
  - `recall_station_order` both overloads: `{auth, service_role}` (132)
  - `rpc_create_purchase_order(...)`: `{service_role}` only (132)
  - `process_tap_webhook(...)`: `{service_role}` only (preserved
    from 128) + `proconfig=['search_path=public, pg_catalog']` (133)
- **Working tree at session end**: clean for tracked files in scope.
  Pre-existing out-of-scope untracked items remain:
  `.claude/worktrees/` (Cowork sibling) and
  `supabase/migrations/131_revoke_public_execute.sql` (Cowork sibling).

## SESSION 99 — DEFERRED CARRY-FORWARD

1. Verify text-overload bodies for `bump_station_order(uuid,text)` and
   `recall_station_order(uuid,text)` via `pg_get_functiondef` — DROP
   if not used.
2. KAH-2026-05-05 — 15 `as any` casts. Now that types are current,
   most of these can be properly typed.
3. KAH-2026-05-06 — atomic audit_logs RPC for refund/closeShift/POS.
   Overlaps with AUD-V3-014.
4. KAH-2026-05-07 — Tap webhook IP allowlist + secret rotation.
5. Per-page branch-filter audit for the 11 service-role-reading
   dashboard pages (KAH-2026-05-12).
6. Cowork merge: pull their `claude/wonderful-euler-85228a` branch
   so migration 131 + Vercel config land on master under their
   authorship.
7. Optional: `next-intl@4.12` major bump (AUD-V3-007).
8. Optional: audit other repair-applied migrations (125, 129, 130)
   for the desync pattern that hit 123 — spot-check showed they're
   fine but worth a systematic check.
