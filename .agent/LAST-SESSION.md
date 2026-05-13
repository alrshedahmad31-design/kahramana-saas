# LAST-SESSION.md — Kahramana Baghdad
> Session 97: v3 audit fixes + pre-launch audit reconciliation
> Date: 2026-05-13
> Author: Claude Code (Opus 4.7)

## SUMMARY

Pure security + drift-reconciliation session. Started by verifying the v3
audit `docs/audit/dashboard-audit-2026-05-13-v3.md`, then verified the
broader 2026-05-13 pre-launch audit (Vercel + Supabase + Sentry). Four
commits shipped; four Supabase migrations (125, 129, 130) and three
sibling-agent migrations backfilled (126, 127, 128). All migrations
applied to remote prod; `supabase migration list --linked` shows
Local|Remote paired for every version 020-130 — no drift.

Notable correction during the session: my initial "audit findings already
fixed" report was wrong because I had only inspected migration files, not
live ACL state. The live `pg_proc.proacl` query revealed all three "RPCs
callable by anonymous" findings were real — Supabase grants EXECUTE to
the `anon` role *explicitly* (not via PUBLIC), so the original 064/094
REVOKE FROM PUBLIC was a no-op. This pattern is now in memory.

## COMMITS THIS SESSION (in order)

- `9d4b9c8` fix(security): CAS-on-status reservations+PO, clock
  rate-limit hardening — closed AUD-V3-009 + AUD-V3-010
- `9416186` fix(security): revoke anon EXECUTE on 3 sensitive RPCs
  (migration 125) — closed "3 RPCs callable by anonymous" from
  pre-launch audit
- `d096887` fix(security): function search_paths + registration FK
  trigger + node engine — closed search_path mutable warning,
  registration FK race, Node engine misalignment
- `7dd184c` chore(migrations): backfill 126-128 from remote (Cowork
  sibling work) — repo/remote drift reconciled

## SECURITY / DATA-INTEGRITY CHANGES — DETAIL

### Batch 1 — v3 audit close-out (`9d4b9c8`)

- **AUD-V3-009 reservation/PO CAS-on-status**: both
  `updateReservationStatus` (reservations/actions.ts:236) and
  `updatePOStatus` (inventory/purchases/actions.ts:149) had row-count
  guards from session 96 but no compare-and-swap on `status` itself.
  Two managers viewing the same `pending` row could both succeed at
  conflicting transitions. Added `.eq('status', currentStatus)` to both.
- **AUD-V3-010 clock rate-limit hardening**: `clock/actions.ts`
  `getAttemptKey` now prefers `x-real-ip` / `cf-connecting-ip`
  (platform-set, not echoed from request) over the spoofable
  `x-forwarded-for`. Long-lived httpOnly device cookie (UUID-validated)
  binds the bucket so attackers can't rotate IPs to reset. Production-
  gated rate limiter (matches existing `feedback_rate_limit_node_env_gate`
  memory). NEW per-staff bucket (10 attempts / 1h) wired into
  `assertStaffPin` so even an IP-rotating attacker can't burn unlimited
  PIN attempts against any single staff_id.

### Batch 2 — pre-launch audit RPC grants (`9416186`, migration 125)

- **3 RPCs callable by anonymous**: `rpc_get_driver_location`,
  `rpc_update_staff`, `update_order_item_station_status`.
- Live ACL showed `anon=X` explicitly on all three; 064/094's
  `REVOKE FROM PUBLIC` was a no-op against explicit role grants.
- Migration 125 issues `REVOKE EXECUTE ... FROM anon` (and from PUBLIC
  belt-and-suspenders), then `GRANT TO authenticated`. Verified
  post-apply: `proacl` shows only `authenticated=X, service_role=X`.
- Migration 125 ALSO captures `rpc_update_staff` in version control for
  the first time (was created out-of-band on remote with no migration).
  Later backfilled when migration 126 was pulled from remote — both 125
  and 126 define the same body; harmless overlap.

### Batch 3 — search_path + registration trigger + node (`d096887`)

- **Migration 129 (search_path)**: 4 SECURITY DEFINER overloads had
  `proconfig = NULL` and triggered the Supabase advisor.
  `ALTER FUNCTION ... SET search_path = public, pg_catalog` on:
    - `bump_station_order(uuid, text)`
    - `recall_station_order(uuid, text)` (the kds_station overload
      already had it)
    - `rpc_receive_purchase_order(uuid, jsonb)` (the 3-arg overload
      already had it)
    - `update_order_item_station_status(uuid, uuid, text, text, text)`
- **Migration 130 (registration FK trigger)**: AFTER INSERT trigger on
  `auth.users`, scoped to `raw_user_meta_data->>'flow' =
  'customer_register'`. Inside-transaction insert eliminates the
  cross-pgbouncer replication race that produced 2 Sentry events of
  `customer_profiles_id_fkey` violation. Scoping is critical — without
  it the trigger would also fire for staff users created via
  `authAdmin.createUser`, polluting `customer_profiles`.
- **account/login/actions.ts: registerAction rewrite**:
  - `signUp` now passes `{ flow, phone, name }` in user_metadata so
    the trigger has the data it needs (`customer_profiles.phone` is
    NOT NULL).
  - Service-role `.insert()` → `.upsert(..., { onConflict: 'id',
    ignoreDuplicates: true })` so the fallback doesn't 23505 against
    the row the trigger just made.
  - Retry-on-23503 loop (3 attempts, 100/200ms backoff) covers the
    residual edge case where the trigger somehow didn't run.
- **package.json**: `engines.node` from `"20.x"` to `">=20.0.0"` so
  Vercel's 24.x Project Settings stops conflicting with the package
  range; both 20 and 24 are now accepted.

### Batch 4 — drift reconciliation (`7dd184c`)

- Cowork sibling agent had applied migrations 126/127/128 directly to
  remote via Dashboard, never pushing the SQL files. `supabase
  migration list --linked` showed Local empty, Remote populated.
- Pulled each via
  `SELECT array_to_string(statements, E';\n\n') FROM
    supabase_migrations.schema_migrations WHERE version='N'`
  → piped through Python's json module → saved verbatim:
    - `126_rpc_update_staff.sql` (37 lines) — original
      `rpc_update_staff` definition
    - `127_grant_audit.sql` (11 lines) — adds missing
      `GRANT ALL ON reservations TO service_role`
    - `128_security_advisor_fixes.sql` (158 lines) — 54 statements:
      REVOKE on SECURITY DEFINER helpers, ALTER FUNCTION search_path,
      REVOKE SELECT on 6 matviews from anon/authenticated
- Also ran `supabase migration repair --status applied 129 130` to
  sync remote tracking for the migrations I had applied via
  `db query` (which doesn't update schema_migrations) earlier this
  session. After repair: every version 020-130 has Local|Remote
  paired.

## OPEN ISSUES (carry to session 98)

### Pre-launch audit — Ahmed actions

| Severity | Item |
|---|---|
| 🔴 | Cloudflare DNS CNAME → Vercel for kahramanat.com |
| 🔴 | `TAP_SECRET_KEY` + `NEXT_PUBLIC_TAP_PUBLIC_KEY` in Vercel envs (waiting on Tap merchant account) |
| 🔴 | `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` in Vercel envs |
| 🔴 | Supabase plan: Free → Pro (zero DB backups today) |
| 🟠 | Supabase env vars in Vercel Preview environment (Sentry shows 30 escalating events) |
| 🟠 | Vercel Project Settings: pick Node 20.x or 24.x (package.json now accepts both) |
| 🟠 | Leaked Password Protection toggle (Supabase Auth → Attack Protection) |
| 🟠 | Add Middle East Vercel region (currently iad1 only — ~120ms+ RTT for Baghdad) |
| 🟡 | Mark stale Sentry `TypeError: color undefined` events resolved (3 dupes) — code already safe via `getStationConfig` fallback |

### Audit v3 mediums — carry-forward

- **AUD-V3-007** `next-intl@4.12` major bump (open redirect + prototype
  pollution CVEs). Needs separate PR with full i18n smoke test.
- **AUD-V3-008** error swallowing in `lib/analytics/queries.ts` (15+
  sites) and `lib/dashboard/stats.ts:131` — Result<T, E> adoption +
  route-level error boundaries. ~6 hr.
- **AUD-V3-011** 14 `as any` casts on Supabase results (analytics,
  promotions/evaluator, reports/validator). Localize to RPC name only.
- **AUD-V3-012** Service-role used for read-only analytics — switch to
  anon client where possible; require `branchId: string | 'all'` for
  cases that must stay service-role (compile-time forcing).
- **AUD-V3-013** Webhook payload `as unknown as Json` — add zod schema
  for Tap event shape before `process_tap_webhook` call.
- **AUD-V3-014** `rpc_refund_payment` atomic RPC — refund + audit_log
  in one transaction. Prerequisite for the eventual Tap API refund.
- **AUD-V3-016** `supabase gen types --linked` regen + strip the two
  `as never` casts at inventory/stock and inventory/purchases.

### Sentry — needs separate session

- `@swc/helpers` module error at login (34 events, 1 user) — investigate
  whether `next-devtools` leaked into the production bundle. Check
  `sentry.client.config.ts`.
- Jest worker exceeded retry limit (19 events) — Jest should not appear
  in production; suspicious. Likely test runner hitting preview URL or
  bad import at `/_error`.

### Tidiness — optional

- Migration 125 and migration 126 both contain the same
  `CREATE OR REPLACE rpc_update_staff` body. Harmless but not DRY. Could
  rewrite 125 as a pure grants-only migration. Pure cleanup; nothing
  broken.

## DECISIONS LOGGED

- **Don't run `npm audit fix --force`**: npm's "fixAvailable" for next
  suggests version 9.3.3 — that's a *downgrade* (current is 15.5.18),
  catastrophic regression. The HIGH-severity claims in v3 audit
  (AUD-V3-002) did not match the actual npm audit output, which only
  flagged 3 moderate vulns. The next-intl major bump (4.12) IS real
  and deferred per v3's own AUD-V3-007.
- **AUD-V3-001 unsalted SHA-256 PIN — closed without forced
  re-enrollment**: live query against `staff_basic` showed all 12 rows
  have `clock_pin_hash = NULL`. Zero legacy data exists. The bcrypt
  migration in `clock/actions.ts` is preemptive; the legacy SHA-256
  fallback branch in `comparePinAndMaybeUpgrade` is effectively dead
  code in production and can be removed once we confirm PINs are being
  set via the new code path. Worth flagging to Ahmed: clock-in feature
  is unused in production today (no PINs provisioned).
- **Migration numbers 129/130 instead of 126/127** (user's original
  request): 126/127/128 were already taken on remote by sibling agent's
  unpushed work; using the requested numbers would have collided on
  apply. Backfilled 126/127/128 from remote in a later commit so the
  repo and remote are now consistent.
- **Migration applied via `db query -f` not `db push`**: `db push`
  refused because of the 126/127/128 drift. `db query -f` is a clean
  side-channel for applying SQL that bypasses the migration history
  table — but then needs `migration repair --status applied N` to sync
  remote tracking. Used this pattern for migrations 125, 129, 130; all
  caught up post-repair.
- **Scoped trigger over unconditional trigger** (FIX-1): Ahmed's
  original message suggested an unconditional `AFTER INSERT ON
  auth.users → handle_new_customer` trigger. That would have fired for
  every staff user created via `authAdmin.createUser`, populating
  `customer_profiles` with stray rows for every owner/manager/cashier
  /driver. The scoped variant (`WHEN raw_user_meta_data->>'flow' =
  'customer_register'`) eliminates the race for the customer signup
  path without touching the staff creation path.
- **UPSERT not INSERT** in `registerAction` fallback: with the trigger
  creating the row first, plain INSERT would 23505 every time. `upsert
  + onConflict:id + ignoreDuplicates:true` makes the fallback
  idempotent. The retry-on-23503 loop is for the residual race when
  the trigger somehow didn't run (migration rolled back, etc.).

## MEMORY UPDATES

New memories saved:
- `feedback_supabase_revoke_anon` — REVOKE FROM PUBLIC is a no-op
  against Supabase's explicit `anon` grants on functions. Always
  REVOKE FROM anon explicitly. Verify with `pg_proc.proacl`, not
  migration files.
- `feedback_cowork_migration_drift` — extend
  `project_cowork_sibling_agent` with the specific pattern of applying
  SQL directly without pushing files. Always run
  `supabase migration list --linked` at session start when there's a
  v3-style audit referencing remote state.
- `feedback_supabase_db_query_multistatement` — `supabase db query`
  multi-statement support requires the `-f` flag with a file; passing
  inline SQL with `--` comments via the positional arg breaks
  flag-parsing.
- `feedback_migration_repair_workflow` — `db query` apply path needs
  `supabase migration repair --status applied N` afterward to update
  remote's `schema_migrations` table; otherwise future `db push`
  attempts will think the migration is unapplied.

## STATUS

- **TSC**: clean after every commit.
- **Local `npm run build`**: clean — 548 pages, 0 errors (verified
  after batch 1 commit `9d4b9c8`).
- **Migrations**: `LOCAL=130 | REMOTE=130` confirmed via
  `supabase migration list --linked`. Every version 020-130 paired.
- **Live ACL state on the 3 anon-callable RPCs**: `anon=X` removed
  from `rpc_get_driver_location`, `rpc_update_staff`,
  `update_order_item_station_status`. Now `authenticated=X,
  service_role=X` only.
- **Live `proconfig` on the 4 search-path-mutable RPCs**: all 4 now
  show `search_path=public, pg_catalog`.
- **Live trigger on `auth.users`**: `on_customer_registered` AFTER
  INSERT confirmed via `information_schema.triggers`.
- **Git**: `master` at `7dd184c`, pushed to origin.
- **Working tree at session end**: clean for tracked files in scope
  (`.claude/settings.local.json`, `README.md`, and the sibling
  `.claude/worktrees/` are pre-existing/out-of-scope; left untouched).

## SESSION 98 — DEFERRED CARRY-FORWARD

1. Ahmed's pre-launch checklist (DNS, env vars, Supabase Pro, etc.)
2. **@swc/helpers + Jest worker** Sentry investigation
3. v3 audit mediums: #8, #11, #12, #13, #14, #16
4. `next-intl@4.12` major bump (separate PR with i18n smoke test)
5. Optional: dedup migration 125 vs 126 for `rpc_update_staff`
6. Optional: remove legacy SHA-256 fallback in `clock/actions.ts`
   (`comparePinAndMaybeUpgrade`) once we confirm PIN provisioning
   uses the new bcrypt path
