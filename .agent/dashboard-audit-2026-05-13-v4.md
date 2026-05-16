# Dashboard Audit v4 — Kahramana Baghdad

| Field | Value |
|---|---|
| **Date** | 2026-05-13 |
| **Auditor** | Claude Opus 4.7 (1M ctx) — session 97 (solo, read-only) |
| **Worktree** | `claude/jovial-payne-960970` @ `8d8f7e9` (session 96 hand-off tip) |
| **Scope** | `src/middleware.ts`, `src/lib/auth/**`, `src/app/[locale]/dashboard/**`, `src/app/api/**`, `src/app/auth/callback/route.ts`, `src/lib/supabase/server.ts`, `src/lib/payments/tap-client.ts`, `sentry.*.config.ts`, `src/instrumentation*.ts`, `supabase/migrations/120-124` |
| **Out of scope** | Public marketing pages, Sanity (zero imports in dashboard), customer checkout, mobile RTL/i18n parity, Phase 7b/8 (locked) |
| **Methodology** | SCOPE → INGEST → HYPOTHESIZE → PROBE → CHAIN → REPORT |
| **Baseline (v2)** | `docs/audit/dashboard-audit-2026-05-10-v2.md` — 36 findings, 22 resolved in session 96 (8 commits) |
| **Sibling v3 work** | Branches `claude/audit-v3-critical` and `claude/audit-v3-high` contain in-progress fixes (`0c34619`, `e60ee48`) referencing a `docs/audit/dashboard-audit-2026-05-13-v3.md` file that does NOT exist on master or this worktree. Treat as parallel WIP. See METHODOLOGY notes. |
| **Build state** | `npx tsc --noEmit` exit 0 (clean). `npm audit --audit-level=moderate` 1 high (`fast-uri` GHSA-q3j6-qgpj-74h6 — transitive). Build not re-run; latest known-good is session 96's `NEXT_BUILD_WORKERS=1 npm run build` → 548 pages, 0 errors, 69 s. |

---

## Executive Summary

| Metric | Score |
|---|---|
| Security Score | **84 / 100** (down from v2's implied 90 because two CRITICAL fixes exist on sibling branches that haven't been merged) |
| Code Quality | **88 / 100** (TSC clean; remaining gaps are typed-as-any pockets + console.log noise) |
| Production Ready | **No — block deploy until AUD-V4-001 / AUD-V4-002 / AUD-V4-003 are merged** |

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 7 |
| 🔵 LOW | 6 |
| ⚫ INFO | 4 |

**Overall posture**: Auth surface (middleware + RBAC + dashboard guards + section gates) is well-engineered with consistent fail-closed patterns and the orders/actions reference implementation models the right shape (Zod + section guard + compare-and-swap + audit log). RLS hardening from migrations 120–122 closes the worst BL-004 gaps. Two critical regressions exist relative to fixes the team has already authored on sibling audit branches (`claude/audit-v3-*`) but never merged — these are the deploy blockers. Remaining HIGH-and-below findings are TOCTOU on staff, error swallowing in analytics, a missing `REVOKE FROM PUBLIC` on the newest atomic-PO RPC, and one inconsistent service-role construction pattern duplicated across five `page.tsx` files.

---

## Attack Surface Snapshot

| Layer | Surface | Status |
|---|---|---|
| Middleware | 1 file, 243 LOC — CSP nonce + RBAC role gate + driver-locale forcing | ✅ Solid |
| Auth modules | 8 files, 690 LOC — session/permissions/rbac/rbac-ui/dashboard-guards/order-access/customerSession/callback | ✅ Solid (1 LOW finding on `*` over-fetch) |
| Server actions | 31 files, ~7,500 LOC — orders/kds/shifts/delivery/promotions/staff/coupons/catering/inventory/reservations/waitlist | 🟡 Mixed: orders is gold-standard; staff TOCTOU still open; KDS console.log noise |
| API routes | 4 routes, 173 LOC — Tap webhook / health / inventory export / template | 🔴 Tap webhook regression (timing-safe lost) |
| Service-role | 71 call sites + 5 `page.tsx` inline constructions + 6 lib files | 🟡 Duplicated factory in 5 pages; central factory is clean |
| Migrations | 120–124 since v2 — BL-004 RLS close + 2 atomic RPCs | 🟠 124 missing REVOKE FROM PUBLIC |
| Sentry | 4 files — server/edge config + instrumentation hooks | 🟡 `enableLogs: true` + heavy console.log in actions ⇒ PII-adjacent breadcrumbs |
| Cryptography | bcrypt expected per memory; current worktree still on unsalted SHA-256 for PINs | 🔴 Sibling branches have the fix |

---

## 🔴 CRITICAL — Deploy Blockers

### AUD-V4-001 — PIN hashing uses unsalted SHA-256 for 4-digit PINs (10⁴ space)
- **Layer**: 5 (Cryptography) — **OWASP**: A02 Cryptographic Failures
- **Files**:
  - [src/app/clock/actions.ts:17](src/app/clock/actions.ts:17) — `hashPin()`
  - [src/app/clock/actions.ts:56](src/app/clock/actions.ts:56) — `assertStaffPin` filters by hash equality
  - [src/app/clock/actions.ts:75](src/app/clock/actions.ts:75) — `verifyPin` filters by hash equality
  - [src/app/[locale]/dashboard/staff/actions.ts:244](src/app/[locale]/dashboard/staff/actions.ts:244) — `createStaffFull` write
  - [src/app/[locale]/dashboard/staff/[id]/actions.ts:84](src/app/[locale]/dashboard/staff/%5Bid%5D/actions.ts:84) — `updateStaffProfile` write
- **Evidence**:
  ```ts
  // src/app/clock/actions.ts:16-18
  function hashPin(pin: string): string {
    return createHash('sha256').update(pin).digest('hex')
  }
  ```
- **Issue**: 4-digit PIN = 10,000 possibilities. Unsalted SHA-256 = the entire keyspace can be precomputed in milliseconds. If `staff_basic.clock_pin_hash` ever leaks (DB dump, RLS bypass, support snapshot, backup), every PIN is recoverable instantly. Worse: hash-equality lookup pattern (`assertStaffPin` filters by hash directly in SQL) means **a single rainbow-table hit lets an attacker authenticate as any staff member**, generating payroll records (`time_entries`) and gaining access to clock-in pages.
- **Sibling fix**: commit `0c34619 fix(security): bcrypt PIN hashes with dual-read SHA-256 fallback` exists on branch `claude/audit-v3-critical` (and `claude/audit-v3-high`). It introduces `bcrypt` (cost 10) for new writes plus `comparePinAndMaybeUpgrade` to rehash legacy rows on successful login. **This commit is NOT in master and NOT in this worktree.** Verify and merge.
- **Chain**: AUD-V4-001 enables impersonation that defeats the role-based action guards across the dashboard (every section guard ultimately trusts the session cookie from a clock-in surface). Any HIGH finding gated by `requireDashboardSection(...)` becomes accessible.
- **Fix** (when merging `claude/audit-v3-critical`):
  ```ts
  import bcrypt from 'bcrypt'
  const BCRYPT_COST = 10
  async function hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, BCRYPT_COST)
  }
  // For verify: pull active staff rows (~50) then bcrypt.compare app-side,
  // and rehash any row whose stored hash still LIKE 'no-$2 prefix' on hit.
  ```
- **Risk if ignored**: full staff impersonation + payroll fraud + clock-in audit log poisoning.
- **Effort**: M — fix already authored on sibling branch; needs merge + regression test (the diff also restructures `assertStaffPin` to pull-then-compare because bcrypt salt is per-row).

### AUD-V4-002 — Tap webhook HMAC uses string `===` (timing oracle on payment auth boundary)
- **Layer**: 3 (API/Webhooks) + 5 (Crypto) — **OWASP**: A02 Cryptographic Failures, A07 Identification & Authentication Failures
- **File**: [src/lib/payments/tap-client.ts:95](src/lib/payments/tap-client.ts:95)
- **Evidence**:
  ```ts
  const expected = createHmac('sha256', secret).update(toHash).digest('hex')
  return expected === hashstring
  ```
- **Issue**: String `===` on the HMAC short-circuits at the first byte mismatch, leaking a side-channel for byte-by-byte signature recovery. The webhook authenticates Tap → app for payment state changes (captures, refunds, idempotency); a forged signature lets an attacker call `process_tap_webhook` RPC with attacker-controlled `status`/`amount`/`order_reference`.
- **Sibling fix**: commit `e60ee48 fix(security): timing-safe Tap webhook signature comparison` on branch `claude/audit-v3-high` already imports `timingSafeEqual` and length-checks Buffers. The commit body explicitly references `docs/audit/dashboard-audit-2026-05-13-v3.md (AUD-V3-003 HIGH)` — confirming the v3 audit existed but never landed on master. **Not in this worktree.**
- **Chain**: AUD-V4-002 unlocks fraudulent payment events on `/api/webhooks/tap` → `process_tap_webhook` RPC mutates `payments.status`. The RPC's app-level idempotency on `gateway_id` does NOT protect against forged-signature replays with attacker-chosen IDs.
- **Fix** (merge `claude/audit-v3-high`):
  ```ts
  import { createHmac, timingSafeEqual } from 'crypto'
  // …
  const expected = createHmac('sha256', secret).update(toHash).digest('hex')
  const expectedBuf = Buffer.from(expected,   'hex')
  const actualBuf   = Buffer.from(hashstring, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
  ```
- **Risk if ignored**: forged payment captures / refund triggers / status flips on production orders.
- **Effort**: S — 5-line fix; the model already exists at [src/lib/auth/order-access.ts:48](src/lib/auth/order-access.ts:48).

### AUD-V4-003 — `rpc_create_purchase_order` (migration 124) missing `REVOKE EXECUTE FROM PUBLIC` — RPC reachable by any authenticated PostgREST client
- **Layer**: 4 (RLS / Service Role) — **OWASP**: A01 Broken Access Control, A04 Insecure Design
- **File**: [supabase/migrations/124_rpc_create_purchase_order.sql:56](supabase/migrations/124_rpc_create_purchase_order.sql:56)
- **Evidence** (full GRANT block — note absent REVOKE):
  ```sql
  CREATE OR REPLACE FUNCTION rpc_create_purchase_order(...)
    SECURITY DEFINER
    SET search_path = public, pg_catalog
  ...
  GRANT EXECUTE ON FUNCTION rpc_create_purchase_order(UUID, TEXT, UUID, JSONB, DATE, TEXT)
    TO service_role;
  ```
  Compare to sibling migration 123:
  ```sql
  -- supabase/migrations/123_rpc_record_opening_balance.sql:60-61
  REVOKE ALL ON FUNCTION rpc_record_opening_balance(...) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION rpc_record_opening_balance(...) TO service_role;
  ```
- **Issue**: PostgreSQL default for `CREATE FUNCTION` grants `EXECUTE` to `PUBLIC` (i.e., every role including `anon` and `authenticated`). Migration 124 only adds a redundant `GRANT … TO service_role` without revoking the default. Combined with `SECURITY DEFINER`, **any logged-in staff (cashier, waiter, marketing, driver) can POST to `/rest/v1/rpc/rpc_create_purchase_order` via PostgREST and create POs at any branch**, bypassing the app-level `assertInventoryWriteAccess(...)` check in [src/app/[locale]/dashboard/inventory/purchases/actions.ts:59](src/app/%5Blocale%5D/dashboard/inventory/purchases/actions.ts:59).
- **Verified pattern**: every other recent RPC migration explicitly revokes (`046`, `064`, `066`, `094`, `100`, `114`, `123`). 124 is the outlier.
- **Chain**: AUD-V4-003 enables PostgREST-direct privilege escalation across both role and branch boundaries; corrupts the purchase ledger and (transitively) inventory cost basis.
- **Fix** (new migration 125):
  ```sql
  -- 125_rpc_create_purchase_order_revoke_public.sql
  REVOKE ALL ON FUNCTION rpc_create_purchase_order(UUID, TEXT, UUID, JSONB, DATE, TEXT)
    FROM PUBLIC;
  -- service_role grant already in place from 124.
  ```
- **Risk if ignored**: any staff member with ANON_KEY + their JWT (everyone on dashboard) can fabricate purchase orders. Branch scoping defeated.
- **Effort**: XS — one-line follow-up migration. Production database needs the same SQL applied.

---

## 🟠 HIGH — Must Fix

### AUD-V4-004 — Staff TOCTOU still open (v2 #15/#16 carry-forward)
- **Layer**: 2 (Server Actions) — **OWASP**: A01 Broken Access Control
- **Files**:
  - [src/app/[locale]/dashboard/staff/[id]/actions.ts:52-91](src/app/%5Blocale%5D/dashboard/staff/%5Bid%5D/actions.ts:52)
  - [src/app/[locale]/dashboard/staff/actions.ts:116-158](src/app/%5Blocale%5D/dashboard/staff/actions.ts:116) (`updateStaff`)
- **Evidence** (the read–check–write window):
  ```ts
  const { data: target } = await service.from('staff_basic')
    .select('id, role, branch_id, is_active').eq('id', input.id).single()  // line 57: read
  if (!canManageStaff(caller, target)) return { … }                        // line 61: check
  // … no compare-and-swap …
  const { error } = await service.from('staff_basic').update(updates).eq('id', input.id) // line 87: write
  ```
- **Issue**: If admin A is mutating staff X while admin B simultaneously changes X's role or branch, A's permission check is stale. The write has no `.eq('role', target.role)` / `.eq('branch_id', target.branch_id)` and no `.select('id').single()` row-count guard. Memory + LAST-SESSION.md both flag this as open.
- **Fix**: introduce `rpc_update_staff(p_id, p_expected_role, p_expected_branch_id, …)` atomic compare-and-swap, then call it from both action files.
- **Chain**: enables role escalation under contention; minor but real.
- **Effort**: M (new migration + 2 action refactors).

### AUD-V4-005 — `approveShift` has no compare-and-swap on status, no row-count guard, no audit log
- **Layer**: 2 (Server Actions) — **OWASP**: A04 Insecure Design, A09 Logging Failures
- **File**: [src/app/[locale]/dashboard/shifts/actions.ts:124-158](src/app/%5Blocale%5D/dashboard/shifts/actions.ts:124)
- **Evidence**:
  ```ts
  const { error } = await supabase.from('shift_closings')
    .update({ status: 'approved', approved_by: user.id, approved_at: ... })
    .eq('id', idParsed.data)
  ```
  No `.eq('status', 'pending')`. No `.select('id').single()`. No `audit_logs.insert`. `approveShift` is a high-impact financial action (cash reconciliation).
- **Issue**: A concurrent flag-to-approved race silently overwrites. Approved-twice is a silent no-op. No durable record of who approved what shift.
- **Fix**:
  ```ts
  const { data: updated, error } = await supabase.from('shift_closings')
    .update({ status: 'approved', approved_by: user.id, approved_at: now })
    .eq('id', idParsed.data)
    .in('status', ['pending', 'flagged'])
    .select('id')
    .single()
  if (error || !updated) return { … 'conflict' … }
  await supabase.from('audit_logs').insert({ table_name: 'shift_closings', action: 'UPDATE', user_id: user.id, record_id: shiftId, changes: { status: 'approved' }, branch_id: null, actor_role: user.role })
  ```
- **Chain**: no chain — direct.
- **Effort**: S.

### AUD-V4-006 — Service-role client constructed inline in 5 `page.tsx` server components (bypasses central factory)
- **Layer**: 4 (Service Role) — **OWASP**: A04 Insecure Design
- **Files**:
  - [src/app/[locale]/dashboard/pos/page.tsx:42-49](src/app/%5Blocale%5D/dashboard/pos/page.tsx:42)
  - [src/app/[locale]/dashboard/pos/service/page.tsx:40-](src/app/%5Blocale%5D/dashboard/pos/service/page.tsx:40)
  - [src/app/[locale]/dashboard/promotions/page.tsx:26-32](src/app/%5Blocale%5D/dashboard/promotions/page.tsx:26)
  - [src/app/[locale]/dashboard/tables/page.tsx:33-39](src/app/%5Blocale%5D/dashboard/tables/page.tsx:33)
  - [src/app/[locale]/waiter/table/[tableNumber]/page.tsx:41,118](src/app/%5Blocale%5D/waiter/table/%5BtableNumber%5D/page.tsx:41)
- **Evidence** (representative — dashboard/pos/service/page.tsx pattern):
  ```ts
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return map
  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  ```
- **Issue**: Functionally correct (each call site is preceded by `requireDashboardSection(...)`), but bypasses `createServiceClient()` in [src/lib/supabase/server.ts:31](src/lib/supabase/server.ts:31). Future hardening (e.g., logging service-role usage, redacting on demand, switching to a regional/keyed client) won't reach these. Five different fallback strings, five duplicate `auth: { persistSession: false }` blocks.
- **Fix**: replace each with `const supabase = createServiceClient()` (already async-tolerant — `await createServiceClient()` works because `createServiceClient` returns a client synchronously and `await x` on a non-Promise is a no-op).
- **Chain**: no chain — pure defense-in-depth.
- **Effort**: S — mechanical refactor of 5 files.

### AUD-V4-007 — Sentry `enableLogs: true` + heavy `console.log` in KDS server actions ships order/branch IDs to Sentry breadcrumbs
- **Layer**: 8 (Error Handling / Info Disclosure) — **OWASP**: A09 Logging Failures
- **Files**:
  - [sentry.server.config.ts:19](sentry.server.config.ts:19) — `enableLogs: true`
  - [src/instrumentation-client.ts:25](src/instrumentation-client.ts:25) — same
  - [src/app/[locale]/dashboard/kds/actions.ts:151,170,177,181,186,195](src/app/%5Blocale%5D/dashboard/kds/actions.ts:151) — multiple `console.log` / `console.error` with branch IDs + order IDs
  - [src/app/[locale]/dashboard/orders/actions.ts:299](src/app/%5Blocale%5D/dashboard/orders/actions.ts:299) — `console.error('[orders] audit_logs insert failed for cancel/return', v.orderId, auditError)`
  - [src/app/[locale]/dashboard/shifts/actions.ts:41,49,115,151](src/app/%5Blocale%5D/dashboard/shifts/actions.ts:41) — `console.error('[shifts] …', error)`
- **Issue**: `enableLogs: true` captures console output into Sentry as breadcrumbs/events. Combined with the action-level `console.log`s, every dispatch / bump / KDS station change / error case ships order ID + branch ID to Sentry. While Sentry `sendDefaultPii: false` is set (good — strips IPs/cookies), application-level logged data (order IDs in particular) flows through unfiltered.
- **Risk**: PII-adjacent (order IDs are stable, can be cross-referenced with customer_phone via DB if Sentry is breached); compliance friction; Sentry quota burn from KDS being chatty.
- **Fix**: either drop `enableLogs` (preferred — explicit `Sentry.captureException(err, { extra: { … } })` at the few sites that actually need it), or strip console calls outside `if (process.env.NODE_ENV !== 'production')`.
- **Chain**: no chain.
- **Effort**: S — flip flag + grep `console\.\(log\|error\|warn\)` in `src/app/[locale]/dashboard/` and gate by NODE_ENV (the inventory/import/staff files already have this pattern, e.g., [staff/actions.ts:264](src/app/%5Blocale%5D/dashboard/staff/actions.ts:264)).

### AUD-V4-008 — Tap webhook returns DB `error.message` directly to caller
- **Layer**: 3 (API Routes) + 8 (Info Disclosure) — **OWASP**: A09 Security Logging & Monitoring Failures
- **File**: [src/app/api/webhooks/tap/route.ts:60](src/app/api/webhooks/tap/route.ts:60)
- **Evidence**:
  ```ts
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  ```
- **Issue**: Postgres errors expose internal details (table/column names, constraint identifiers, occasionally query fragments) to whoever can POST to the webhook (in practice Tap's servers, but any caller that gets past the HMAC check). After fixing AUD-V4-002 the HMAC is real but defense-in-depth still applies.
- **Fix**: log internally, return generic 500 body:
  ```ts
  if (error) {
    console.error('[tap webhook] rpc failed:', error)   // gated by NODE_ENV per AUD-V4-007
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  ```
- **Chain**: amplifies AUD-V4-002 if `===` is still in place.
- **Effort**: XS.

### AUD-V4-009 — `npm audit` reports HIGH `fast-uri` advisory (GHSA-q3j6-qgpj-74h6)
- **Layer**: 9 (Dependencies) — **OWASP**: A06 Vulnerable Components
- **Detail**: `fast-uri` transitive vulnerability, "path traversal via percent-encoded dot segments", CVSS 7.5, CWE-22.
- **Issue**: Path traversal in a URI parser typically lands in a request-handling chain. Need to identify which dependency pulls it in.
- **Fix**: `npm ls fast-uri` to find the parent (likely `@supabase/realtime-js` or `fastify`-adjacent), then upgrade. Or `npm audit fix` if the patch is non-major.
- **Chain**: unknown until parent identified.
- **Effort**: S — investigate + bump.

---

## 🟡 MEDIUM — Should Fix

### AUD-V4-010 — Error swallowing in dashboard + analytics queries (v2 #6/#7/#8 still open)
- **Files**:
  - [src/lib/dashboard/stats.ts:131-135](src/lib/dashboard/stats.ts:131) — `Promise.all` destructures only `data`, drops `error`
  - [src/lib/analytics/queries.ts:196-197](src/lib/analytics/queries.ts:196) — `if (error || !data) return { totalRevenue: 0, … }`
- **Issue**: DB failures present as zero-value dashboards. No alert, no error boundary, no toast. Operators can't tell "no sales today" from "DB failover broke the read replica."
- **Fix**: at minimum, `console.error` (gated by NODE_ENV) + return a tagged error result so the page can render an error banner. Long-term: a typed `Result<T, E>` helper.
- **Effort**: M.

### AUD-V4-011 — `audit_logs.insert` in delivery actions is fire-and-forget (no error inspection)
- **Files**: [src/app/[locale]/dashboard/delivery/actions.ts:85,198,248,317](src/app/%5Blocale%5D/dashboard/delivery/actions.ts:85)
- **Evidence**: `await service.from('audit_logs').insert({...})` followed by `revalidatePath(...)` — no `if (auditError)` check.
- **Issue**: If audit_logs is full/locked/RLS-rejects, the action still reports success. The orders.ts reference at [orders/actions.ts:287-300](src/app/%5Blocale%5D/dashboard/orders/actions.ts:287) shows the correct pattern (`console.error` on auditError so monitoring can flag).
- **Fix**: copy the orders.ts pattern.
- **Effort**: XS per site (4 sites).

### AUD-V4-012 — `toggleStaffActive` has no row-count check on update
- **File**: [src/app/[locale]/dashboard/staff/actions.ts:350-353](src/app/%5Blocale%5D/dashboard/staff/actions.ts:350)
- **Evidence**:
  ```ts
  const { error } = await service.from('staff_basic')
    .update({ is_active: activate }).eq('id', id)
  ```
- **Issue**: same pattern v2 fixed for coupons (toggle row-count guard) but staff was not converted.
- **Fix**: `.select('id').single()` + `if (!updated) return { success: false, error: 'Staff member not found' }`.
- **Effort**: XS.

### AUD-V4-013 — `confirmCashHandover` lacks row-count guard
- **File**: [src/app/[locale]/dashboard/delivery/cash-reconciliation/actions.ts:183-191](src/app/%5Blocale%5D/dashboard/delivery/cash-reconciliation/actions.ts:183)
- **Evidence**: pre-check on `manager_confirmed` at line 175, but the subsequent update at 184 has no `.eq('manager_confirmed', false).select('id').single()`. A concurrent confirmation silently overwrites.
- **Fix**: `.eq('manager_confirmed', false).select('id').single()` + return conflict on empty rows.
- **Effort**: XS.

### AUD-V4-014 — `togglePromotion` and `deletePromotion` have no row-count guard
- **File**: [src/app/[locale]/dashboard/promotions/actions.ts:161-168, 181-187](src/app/%5Blocale%5D/dashboard/promotions/actions.ts:161)
- **Issue**: same pattern. Toggle a deleted promotion = silent no-op.
- **Fix**: `.select('id').single()` + return-not-found.
- **Effort**: XS.

### AUD-V4-015 — KDS read-then-RPC TOCTOU on branch_id check
- **File**: [src/app/[locale]/dashboard/kds/actions.ts:122-148](src/app/%5Blocale%5D/dashboard/kds/actions.ts:122)
- **Evidence**: `service.from('orders').select('branch_id').eq('id', orderId).single()` at 124-128, then `userClient.rpc('update_order_item_station_status', ...)` at 142. Branch reassignment in the micro-window passes the app check.
- **Mitigation**: the RPC itself re-validates per migration 094 (the RPC checks role + branch_id + transition graph). Defense-in-depth is sufficient.
- **Severity**: MEDIUM (would be LOW except this exact pattern repeats in 4 KDS actions).
- **Fix**: rely on the RPC and drop the app-level pre-check, OR add `p_expected_branch_id` to the RPC contract.
- **Effort**: S.

### AUD-V4-016 — Dispatch `assignDriverToOrder` reads driver with anon client (RLS may filter), then writes with service-role
- **File**: [src/app/[locale]/dashboard/delivery/actions.ts:23,43-59,61-75](src/app/%5Blocale%5D/dashboard/delivery/actions.ts:23)
- **Evidence**:
  ```ts
  const supabase = await createClient()                                  // line 23: anon + cookie
  const { data: driver } = await supabase.from('staff_basic')
    .select('id, role, is_active, branch_id').eq('id', driverId).single()  // 43-47
  // …
  const service = await createServiceClient()                            // 61: service-role
  const { data: updated } = await service.from('orders')...              // 64-75
  ```
- **Issue**: if RLS on `staff_basic` filters rows visible to the caller, a manager-with-branch might fail to find a same-branch driver because RLS could mask the row. Currently appears not to be the case (staff_basic RLS likely permits same-branch SELECT), but the inconsistent client choice for read-then-write is a smell. Could mask a future RLS tightening.
- **Fix**: use `service` for both reads + writes within a single action OR document the contract.
- **Effort**: XS.

---

## 🔵 LOW — Polish

### AUD-V4-017 — Auth callback leaks Supabase error in URL query string
- **File**: [src/app/auth/callback/route.ts:44-47](src/app/auth/callback/route.ts:44)
- **Evidence**: `?error=${encodeURIComponent(exchangeError.message)}` — internal auth error reflected back into the URL.
- **Fix**: redirect with a coded error (`?error=exchange_failed`) and look up the user-facing string on the login page.
- **Effort**: XS.

### AUD-V4-018 — `customerSession.ts` uses `select('*')` — over-fetches every column
- **File**: [src/lib/auth/customerSession.ts:14](src/lib/auth/customerSession.ts:14)
- **Fix**: select only the columns the callers actually consume.
- **Effort**: XS (after identifying callers).

### AUD-V4-019 — `(userClient.rpc as any)` cast in 4 KDS RPC sites
- **File**: [src/app/[locale]/dashboard/kds/actions.ts:142,189,227,251](src/app/%5Blocale%5D/dashboard/kds/actions.ts:142)
- **Issue**: bypasses TypeScript checks. Same root cause as the `as never` casts at the inventory RPC sites — auto-generated Database types lag the migrations. Memory notes that this is a known carry-forward.
- **Fix**: `supabase gen types --linked` after migrations 094, 100–113 are confirmed deployed; then remove casts.
- **Effort**: S (gated on type regen).

### AUD-V4-020 — `dispatch.reassignDriver` does not check that new driver differs from current
- **File**: [src/app/[locale]/dashboard/delivery/actions.ts:265-330](src/app/%5Blocale%5D/dashboard/delivery/actions.ts:265)
- **Issue**: cosmetic — caller can re-assign to the same driver; audit_log records no-op reassignment.
- **Fix**: short-circuit if `driverId === order.assigned_driver_id`.
- **Effort**: XS.

### AUD-V4-021 — Health endpoint returns DB error.message in JSON body
- **File**: [src/app/api/health/route.ts:50,32-33](src/app/api/health/route.ts:50)
- **Issue**: less critical than Tap (this endpoint is meant to be public for uptime probes), but the error string itself leaks Postgres internals.
- **Fix**: return `{ ok: false, latencyMs, error: 'unhealthy' }` and log the real error.
- **Effort**: XS.

### AUD-V4-022 — Audit page (`/dashboard/audit`) silently renders empty on query error
- **File**: [src/app/[locale]/dashboard/audit/page.tsx:43-53](src/app/%5Blocale%5D/dashboard/audit/page.tsx:43)
- **Evidence**: `if (error) console.error(...)` then `const logs = (logsData as unknown as AuditLogData[]) ?? []`. Owner sees an empty audit table instead of an alert.
- **Fix**: surface an error UI when `error` is set.
- **Effort**: XS.

---

## ⚫ INFO

### AUD-V4-023 — 5 `page.tsx` files read `SUPABASE_SERVICE_ROLE_KEY` at module top (server-only by Next.js convention, safe)
- Pages (POS, POS service, Promotions, Tables, Waiter table) are Server Components and the env var is never bundled to the client unless `NEXT_PUBLIC_` prefixed. Safe but non-canonical — see AUD-V4-006 for the refactor.

### AUD-V4-024 — CSP includes `'unsafe-inline'` in production scriptSrc as legacy-browser fallback
- [src/middleware.ts:50](src/middleware.ts:50). Documented design choice: nonce + `'strict-dynamic'` overrides `'unsafe-inline'` in modern browsers per CSP3. Verified intentional. No action.

### AUD-V4-025 — `dangerouslySetInnerHTML` + `JSON.stringify` pattern across 14 schema/JSON-LD blocks
- Pattern: `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />` appears 21 times across schema-org embed sites.
- Data sources are all server-derived (constants, builders, or DB rows that are not user-controlled). `JSON.stringify` is JS-spec safe but **HTML-context unsafe**: a literal `</script>` substring inside the data would terminate the script tag.
- Only [src/app/[locale]/order/[id]/page.tsx:106](src/app/%5Blocale%5D/order/%5Bid%5D/page.tsx:106) embeds order-derived data (`schemaOrg` from order fields). All others use constants. Verify the order schema builder strips/escapes any field that could contain `</`.
- Severity: INFO unless customer fields flow unsanitized → flag for follow-up verification.

### AUD-V4-026 — Sibling worktree branches contain in-progress v3 audit fixes
- Branches `claude/audit-v3-critical` and `claude/audit-v3-high` (verified via `git branch --contains`) hold commits `0c34619` and `e60ee48` that reference a `docs/audit/dashboard-audit-2026-05-13-v3.md` file not present on master.
- Implication: someone (likely a parallel Claude Code or Gemini cowork session) authored v3 fixes today (2026-05-13) but never merged them.
- Action: locate the v3 audit doc (probably on one of those branches) and decide whether to (a) merge the branches, (b) cherry-pick the two commits into a `fix/audit-v3-merge` branch, or (c) restart the fix work from this audit.
- This is the highest-leverage action item — it closes AUD-V4-001 and AUD-V4-002 simultaneously.

---

## ✅ What's Solid

Worth preserving — these patterns should be the template for future code:

1. **Section guards everywhere**. `requireDashboardSection('orders' | 'kds' | 'shifts' | …)` is consistently the first call in every server action audited. No action skips this. The error-handling shape (`isDashboardGuardError(e)` + structured return) is uniform.
2. **Orders reference implementation** ([src/app/[locale]/dashboard/orders/actions.ts](src/app/%5Blocale%5D/dashboard/orders/actions.ts)) — section guard, UUID regex pre-check, RBAC transition check, refund-aware terminal gate, compare-and-swap with row-count guard, audit_logs with surfaced error logging, typed error codes. This is the gold standard; copy it.
3. **Status transition matrices** for reservations / waitlist / catering / PO / orders. Defence-in-depth against UI-driven bad state changes; pair with DB-level RPC re-validation where possible.
4. **Atomic RPCs** (123, 124) replace risky two-step client patterns. Migration 123 is fully correct (REVOKE+GRANT pair); 124 needs the REVOKE backfill per AUD-V4-003.
5. **RLS hardening 120–122** closes the BL-004 USING(true)/WITH CHECK(true) bucket with a documented allow-list pattern (`auth_user_role()::text IN (…)`). Skip list is justified per-table.
6. **HMAC ordering tokens** in [src/lib/auth/order-access.ts](src/lib/auth/order-access.ts) — already use `timingSafeEqual` with length check. This is the model Tap webhook should adopt (AUD-V4-002).
7. **CSP nonce + strict-dynamic** in middleware with environment-aware fallback. Per-request nonce via `crypto.randomUUID()`.
8. **Fail-closed null branch guard** at [dashboard/page.tsx:39](src/app/%5Blocale%5D/dashboard/page.tsx:39): a scoped role with NULL branch_id now throws rather than silently inheriting global view.
9. **Sentry PII discipline** — `sendDefaultPii: false` on both client + server configs; release names use 7-char SHA only. The remaining issue is logged data via `enableLogs: true` (AUD-V4-007), not the SDK config itself.

---

## 🎯 Priority Action List

| # | Finding | Severity | Effort | Why now |
|---|---|---|---|---|
| 1 | AUD-V4-001 — bcrypt PINs (merge `claude/audit-v3-critical`) | 🔴 | M | Deploy blocker; fix already authored |
| 2 | AUD-V4-002 — timing-safe Tap webhook (merge `claude/audit-v3-high`) | 🔴 | S | Deploy blocker; fix already authored |
| 3 | AUD-V4-003 — `REVOKE FROM PUBLIC` on rpc_create_purchase_order (mig 125) | 🔴 | XS | Deploy blocker; one-line follow-up |
| 4 | AUD-V4-009 — `fast-uri` HIGH advisory bump | 🟠 | S | Path traversal in URI parser |
| 5 | AUD-V4-008 — Tap webhook generic 500 body | 🟠 | XS | Pairs with #2 in same PR |
| 6 | AUD-V4-004 — staff TOCTOU rpc_update_staff | 🟠 | M | Carry-forward from session 96 |
| 7 | AUD-V4-005 — approveShift CAS + row-count + audit log | 🟠 | S | High-impact financial action |
| 8 | AUD-V4-007 — Sentry enableLogs + console scrub | 🟠 | S | Compliance + cost |
| 9 | AUD-V4-006 — service-role factory refactor (5 pages) | 🟠 | S | Defense-in-depth + maintenance |
| 10 | AUD-V4-010 — error swallowing in stats + analytics | 🟡 | M | Carry-forward from session 96 |
| 11 | AUD-V4-011/012/013/014 — row-count guards (4 sites) | 🟡 | XS each | Bundle into one CAS PR |
| 12 | AUD-V4-015/016 — KDS/dispatch read-write client consistency | 🟡 | S | Bundle with #11 |
| 13 | AUD-V4-017/021 — error-message exposure in URLs/JSON | 🔵 | XS | Bundle into a "redact" PR |
| 14 | AUD-V4-018/020/022 — polish | 🔵 | XS each | Backlog |
| 15 | AUD-V4-019 — types regen + drop `as any`/`as never` casts | 🔵 | S | After 094/100-113 confirmed deployed |
| 16 | AUD-V4-025 — verify order-schema sanitizes `</script>` | ⚫ | XS | One spot-check |
| 17 | AUD-V4-026 — locate v3 audit doc + cherry-pick fixes | INFO | S | Unblocks #1 + #2 |

---

## OWASP TOP 10 Coverage

| Code | Category | Findings |
|---|---|---|
| **A01** | Broken Access Control | AUD-V4-003 (RPC FROM PUBLIC), AUD-V4-004 (staff TOCTOU) |
| **A02** | Cryptographic Failures | AUD-V4-001 (PIN hashing), AUD-V4-002 (timing-safe) |
| **A03** | Injection | No findings — Supabase client params everywhere; no raw SQL. `dangerouslySetInnerHTML` reviewed (AUD-V4-025) |
| **A04** | Insecure Design | AUD-V4-005 (approveShift), AUD-V4-006 (factory bypass), AUD-V4-015/016 (mixed client patterns) |
| **A05** | Security Misconfiguration | No new findings — CSP solid; Sentry config solid except enableLogs (AUD-V4-007) |
| **A06** | Vulnerable Components | AUD-V4-009 (fast-uri) |
| **A07** | ID & Authn Failures | AUD-V4-002 (HMAC), AUD-V4-001 (PIN — also A07) |
| **A08** | Software & Data Integrity | No findings on dashboard surface |
| **A09** | Logging Failures | AUD-V4-007 (Sentry breadcrumbs), AUD-V4-008 (Tap body), AUD-V4-010 (error swallow), AUD-V4-011 (audit log fire-and-forget), AUD-V4-017/021/022 (error exposure) |
| **A10** | SSRF | No findings — no user-controlled `fetch(url)` patterns in dashboard scope |

---

## Deferred from Previous Audits — Status

| v2 ID / session 96 carry-forward | Current state |
|---|---|
| v2 #6/#7/#8 — error swallowing | **OPEN** → AUD-V4-010 |
| v2 #15/#16 — staff TOCTOU | **OPEN** → AUD-V4-004 |
| v2 #18 — staff leave date bounds | **RESOLVED** — Zod + bounds at [staff/[id]/actions.ts:113-136](src/app/%5Blocale%5D/dashboard/staff/%5Bid%5D/actions.ts:113) (30-day past, 365-day future, 90-day max duration) |
| v2 #25 — coupon toggle row-count | **RESOLVED** — `.select('id').single()` at [coupons/actions.ts:318-319, 358-360](src/app/%5Blocale%5D/dashboard/coupons/actions.ts:318) |
| v2 #27/#28 — reservation/waitlist row-count | **RESOLVED** — `.select('id').single()` at [reservations/actions.ts:241](src/app/%5Blocale%5D/dashboard/reservations/actions.ts:241) and [waitlist/actions.ts:131](src/app/%5Blocale%5D/dashboard/waitlist/actions.ts:131) |
| v2 #29/#30/#31 — route error boundaries | **NOT VERIFIED** in this audit pass — needs separate UX audit |
| v2 #32 — canonical `/pos` route | **NOT VERIFIED** — Glob shows `/pos` exists only under `/dashboard/pos`; top-level redirect deferred |
| Session 96 — types regen pending | **OPEN** → AUD-V4-019 |
| Session 96 — Sentry sourcemap verification | **NOT VERIFIED** in this audit pass — needs build log inspection |
| Session 96 — Vercel CPU re-check | **NOT VERIFIED** — operational, not code |

---

## Methodology Notes

**Rules followed**:
- Every claim cites file:line from current worktree state at audit time.
- `git status` was clean at start; not re-verified at end (no edits were made).
- TSC clean (exit 0) before audit; `npm audit --audit-level=moderate` ran in parallel.
- For each CRITICAL/HIGH I confirmed the negative case (e.g., grepped for `timingSafeEqual` across `src/` before reporting AUD-V4-002; verified `REVOKE` pattern across all migrations before reporting AUD-V4-003).
- Sibling-worktree collision check: `git branch --contains <commit>` confirmed two parallel audit branches hold v3 fixes — see AUD-V4-026.

**False-positive checks performed**:
- v2 #25 (coupon toggle row-count) was on the explore agent's "still open" list. Direct read of `coupons/actions.ts` showed `.select('id').single()` already in place since commit `c778f44`. Documented as **RESOLVED**, not as a new finding.
- v2 #27/#28 similarly **RESOLVED** in current code despite the explore agent flagging as "still open."
- Service-role inline construction in 5 `page.tsx` files initially looked like a CRITICAL leak (raw env var read in a page). Verified Next.js Server Component semantics → not client-bundled → downgraded to HIGH defense-in-depth (AUD-V4-006).

**Verification gaps (out of scope this pass)**:
- RLS deep-dive on system_settings, contact_messages SELECT, and customer_profiles SELECT — the SQL audit is consistent and migrations 120–122 cover the worst cases, but `pg_tables WHERE rowsecurity=false` was not executed (no DB access from this session).
- Build was not re-run (read-only audit). Last known-good run is session 96's clean build.
- Error boundary presence (v2 #29-31) was not verified by reading `error.tsx` / `loading.tsx` placements.

**Behavioral discipline**:
- No edits, no migrations, no commits this session.
- Sibling agent collision: confirmed two audit-v3 branches exist with fix commits not on master — AUD-V4-026 captures this with merge guidance.
