# LAST-SESSION.md — Kahramana Baghdad
> Session 97/98/99: dashboard audit v3 close-out — batches A–E + migration grant audit
> Date: 2026-05-13
> Author: Claude Code (sole contributor)

## SUMMARY

Pure security + data-integrity session, no new features. Executed five
user-defined batches targeting findings deferred from the v2 audit
(#15/#16 staff TOCTOU, v3 branch criticals/highs) plus the info-disclosure
surfaces identified in the audit follow-up (Sentry logs, API error bodies).
Then performed a migration grant audit (114–126) which found one gap: the
`reservations` table was missing a `service_role` GRANT.
Six commits on worktree branch `claude/musing-visvesvaraya-fa3bce`, three
migrations (125, 126, 127) applied to remote prod. TSC clean after every commit.

## COMMITS THIS SESSION (in order)

- `76ca29c` fix(security): merge v3 criticals + revoke PO RPC from public
- `3dd7cfc` fix(data-integrity): approveShift CAS + 4 row-count guards
- `ca7f6c0` fix(security): disable Sentry logs + scrub info-disclosure surfaces
- `5d28752` fix(security): staff TOCTOU via atomic RPC (migration 126)
- `8a78274` refactor: use createServiceClient in 5 dashboard pages
- `80faad2` fix(security): grant service_role on reservations table (migration 127)

Plus master was advanced by two FF merges from the Gemini-authored v3 branches:
- `0c34619` fix(security): bcrypt PIN hashes with dual-read SHA-256 fallback
- `87a8650` chore(deps): bump next to 15.5.18 (security), add bcrypt
- `35ce5c7` fix(concurrency): compare-and-swap on refund payment update
- `c53dd7c` fix(concurrency): compare-and-swap on 7 staff/schedule write sites
- `e60ee48` fix(security): timing-safe Tap webhook signature comparison
- `37467c5` fix(security): pin /auth/callback redirects to NEXT_PUBLIC_SITE_URL

## BATCH DETAIL

### Batch A — v3 merges + migration 125 (`76ca29c`)

Merged `claude/audit-v3-critical` and `claude/audit-v3-high` into master
via fast-forward (both were linear descendants of master HEAD `8d8f7e9`).
Pushed master. The v3-high branch includes:
- bcrypt PIN hashes + dual-read SHA-256 fallback (`src/app/clock/actions.ts`)
- Next.js 15.5.18 security bump, `bcrypt` package added
- Timing-safe webhook signature comparison (`src/lib/payments/tap-client.ts`)
- CAS on 7 staff/schedule write sites (`staff/[id]/actions.ts`,
  `staff/actions.ts`, `schedule/actions.ts`)
- CAS on refund payment update (`payments/actions.ts`)
- Auth-callback redirects pinned to `NEXT_PUBLIC_SITE_URL`

Migration 125 (`supabase/migrations/125_rpc_create_purchase_order_revoke_public.sql`):
REVOKE EXECUTE on `rpc_create_purchase_order(UUID, TEXT, UUID, JSONB, DATE, TEXT)`
FROM PUBLIC; re-GRANT to service_role. Applied via `supabase db push --include-all`.

### Batch B — CAS + row-count guards (`3dd7cfc`)

Five server actions hardened:

**`approveShift`** (`shifts/actions.ts`):
- Now uses `createServiceClient()` (was anon client — audit logs would have
  failed RLS).
- Pre-fetch: `select('id, status, branch_id').single()` before update.
- Returns `not_found` if row absent; `invalid_input` if already approved.
- CAS: `.eq('status', current.status)` on the UPDATE.
- Row-count guard: `.select('id').single()` + `conflict` code if race.
- Inline `audit_logs` insert with `branch_id` and `actor_role`.
- `ShiftErrorCode` union extended with `not_found` and `conflict`.

**`toggleStaffActive`** (`staff/actions.ts`):
- CAS: `.eq('is_active', !activate)` guards double-toggle.
- Row-count guard: `.select('id').single()`.

**`togglePromotion`** (`promotions/actions.ts`):
- CAS: `.eq('is_active', !isActive)`.
- Row-count guard: `.select('id').single()`.

**`deletePromotion`** (`promotions/actions.ts`):
- Row-count guard: `.delete().eq('id', id).select('id').single()`.
  Returns error if row already gone.

**`confirmCashHandover`** (`cash-reconciliation/actions.ts`):
- DB-level CAS: `.eq('manager_confirmed', false)` on the UPDATE (was JS-only
  pre-check — TOCTOU window between fetch and update).
- Row-count guard: `.select('id').single()`.
- Audit log fixed: added missing `branch_id: h.branch_id` field.
- Removed `as any` eslint suppression, replaced with `as never`.

### Batch C — Sentry + info-disclosure scrub (`ca7f6c0`)

- `sentry.server.config.ts`: `enableLogs: true` → `false`.
- `sentry.edge.config.ts`: `enableLogs: true` → `false`.
- `src/instrumentation-client.ts`: `enableLogs: true` → `false`.
- `src/app/api/webhooks/tap/route.ts`: line 60 — `error.message` in 500 body
  replaced with `'Payment processing failed'`.
- `src/app/api/health/route.ts`: both error branches replaced with
  `'Database check failed'`; unused `err` variable removed from catch.
- `src/app/auth/callback/route.ts`: `errorDesc ?? errorParam` forwarded to
  redirect query replaced with `'authentication_failed'`; `exchangeError.message`
  replaced with `'authentication_failed'`.

⚠️ **Merge conflict risk** — v3-high also changed `auth/callback/route.ts`
(pinned `origin` → `process.env.NEXT_PUBLIC_SITE_URL`). When the worktree
branch is PR'd against master, expect a conflict on that file. Resolution:
keep NEXT_PUBLIC_SITE_URL base URL, keep generic error tokens.

### Batch D — rpc_update_staff (`5d28752`)

Migration 126 (`supabase/migrations/126_rpc_update_staff.sql`):
`rpc_update_staff(p_id UUID, p_name TEXT, p_role staff_role, p_branch_id TEXT)`
— wraps the `UPDATE staff_basic SET name, role, branch_id WHERE id = p_id`
in a plpgsql transaction with ROW_COUNT guard (`staff_not_found` exception).
SECURITY DEFINER + locked `search_path` + REVOKE FROM PUBLIC / GRANT TO
service_role. Applied via `supabase db push --include-all`.

**Note**: the migration creates the function but `updateStaff()` in
`staff/actions.ts` has NOT been migrated to call the RPC yet (was out of
scope for this session). The #15/#16 TOCTOU is mitigated by Batch B's CAS
guards; the RPC is available for the call-site wiring in the next session.

### Batch E — createServiceClient refactor (`8a78274`)

Replaced 5-line inline blocks (raw `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` reads + `createSupabaseClient(...)`) with the
canonical `createServiceClient()` factory in `src/lib/supabase/server.ts`.

| File | Lines removed | Strategy |
|------|--------------|---------|
| `dashboard/pos/page.tsx` | 42–50 | `try { createServiceClient() } catch { return map }` |
| `dashboard/pos/service/page.tsx` | 40–47 | Same fail-open pattern |
| `dashboard/promotions/page.tsx` | 26–32 | Direct call (throw → 500) |
| `dashboard/tables/page.tsx` | 33–39 | Direct call (throw → 500) |
| `waiter/page.tsx` | 55–59 | Direct call; null-fallback removed |

Removed `import { createClient as createSupabaseClient } from '@supabase/supabase-js'`
from all 5 files. `waiter/page.tsx` existing `await createServiceClient()` on
the orders client normalised to sync call.

## OPEN ISSUES (carry to session 99)

### #6 / #7 / #8 — error swallowing (still deferred)

Analytics helpers (`src/lib/analytics/queries.ts`, ~15 sites) and
`src/lib/dashboard/stats.ts:131` return empty arrays / zeros on DB failure.
Needs typed error returns + error boundaries. High blast radius — defer.

### rpc_update_staff call-site wiring (follow-up from Batch D)

`updateStaff()` in `src/app/[locale]/dashboard/staff/actions.ts:143` still
does the two-step read+write. Wiring it to call `supabase.rpc('rpc_update_staff', ...)`
replaces the `service.from('staff_basic').update(...).eq('id', input.id)` call.
Straightforward one-commit change.

### Supabase types regen — THREE sites pending

`as never` casts at:
- `src/app/[locale]/dashboard/inventory/stock/[branchId]/actions.ts`
  (migration 123 — session 95)
- `src/app/[locale]/dashboard/inventory/purchases/actions.ts`
  (migration 124 — session 96)
- `src/app/[locale]/dashboard/staff/actions.ts` or wherever
  `supabase.rpc('rpc_update_staff', ...)` is wired (migration 126)

All stripped in one cleanup commit after:
```
npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts
```

### Sentry sourcemap pipeline — still unverified

Inspect latest build log for `Successfully uploaded N files` with release
matching `kahramana-master-{short-sha}` AND no `could not auto-detect
referenced sourcemap` warnings. Carried forward from session 95.

### Vercel CPU re-check post-tunnel-removal

Session 95 removed the `/monitoring` Sentry tunnel route. Re-check Vercel
dashboard ~24-48h after that deploy to confirm drop. Still carried forward.

### auth/callback merge conflict (Batch C × v3-high)

When `claude/musing-visvesvaraya-fa3bce` is PR'd to master, resolve the
`src/app/auth/callback/route.ts` conflict by combining both changes:
1. Use `process.env.NEXT_PUBLIC_SITE_URL ?? origin` as the base (v3-high)
2. Use generic `authentication_failed` token in query params (Batch C)

## DECISIONS LOGGED

- **Batch A migration strategy** — supabase is only linked in the main repo,
  not in the git worktree. Applied migrations by copying SQL to main repo,
  running `supabase db push --include-all`, then deleting the temp copy. The
  canonical file lives on the worktree branch.
- **approveShift switched to createServiceClient** — anon client cannot write
  to `audit_logs` (RLS blocks it); all audit-emitting actions must use service.
- **confirmCashHandover `as never` vs `as any`** — stripped the existing
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment;
  used `as never` consistent with the rest of the codebase.
- **rpc_update_staff scope = 3 fields only** — RPC parameters match exactly
  what `updateStaff()` currently mutates (`name`, `role`, `branch_id`). No
  speculative forward-compat params added.
- **Batch E fail-open preserved** — `pos/page.tsx` and `pos/service/page.tsx`
  return empty modifier map on missing env (fail-open) rather than throwing.
  This matches the original intent: a missing env in dev is not fatal; modifier
  validation will reject unknown modifiers at the RPC boundary anyway.

## STATUS

- **TSC**: clean after every commit (zero errors).
- **Build**: not run this session (worktree branch, not on master).
- **Migrations**: 125 + 126 + 127 applied to remote prod. Supabase remote is current.
- **Git worktree**: 6 commits ahead of the merge-point with master (`80faad2`).
- **master**: advanced to `37467c5` (v3-high tip), pushed.
- **Working tree**: clean at session end.

## SESSION 100 — DEFERRED CARRY-FORWARD

1. Wire `updateStaff()` to call `rpc_update_staff` RPC (1 commit)
2. **#6 / #7 / #8** error swallowing (analytics + dashboard stats)
3. **`supabase gen types --linked`** → strip `as never` casts (3 sites)
4. **Sentry sourcemap verification** — inspect latest build log
5. **Vercel Active CPU re-check** post-tunnel-removal (session 95)
6. **Resolve auth/callback merge conflict** when this worktree is PR'd
