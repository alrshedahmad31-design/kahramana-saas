# Dashboard Audit v3 — Kahramana Baghdad

**Date:** 2026-05-13
**Auditor:** Claude (Cowork mode, sonnet)
**Scope:** Full dashboard surface — auth, RLS, server actions, RBAC, race conditions, validation, data integrity, error handling, dependency CVEs
**Methodology:** master-auditor skill, OWASP Top 10 mapping, code-grounded findings (no hypotheticals)
**Baseline:** audit v2 (2026-05-10, session 96 closed 22/36 findings — `docs/audit/dashboard-audit-2026-05-10-v2.md`)
**Build status at audit start:** TSC clean, build clean (548 pages), migrations LOCAL=124 REMOTE=124

---

## STATUS UPDATE — 2026-05-14 (Session 105 verification)

A code-grounded re-walk of every CRITICAL / HIGH / MEDIUM finding below shows that **the audit doc is comprehensively stale**. Most findings landed in commits during the 24 hours after the audit was written (sessions 99–101) and were never back-annotated into this file. Verified state as of `master @ 2999306`:

| ID | Original severity | Status | Closing reference |
|---|---|---|---|
| AUD-V3-001 | 🔴 CRITICAL | **CLOSED** (in progress) | `src/app/clock/actions.ts:25-57` — bcrypt with legacy SHA-256 upgrade-on-login. Operator finalization (force re-enroll once `clock_pin_hash LIKE '$2%'` ~100%) remains. |
| AUD-V3-002 | 🔴 CRITICAL | **OPEN** | `npm audit fix` — out of scope for this session (no package.json edits). Carry to next session. |
| AUD-V3-003 | 🟠 HIGH | **CLOSED** | commit `e60ee48` (2026-05-13 18:55) — `timingSafeEqual` at `src/lib/payments/tap-client.ts:142-146`. |
| AUD-V3-004 | 🟠 HIGH | **CLOSED** (all 7 sites) | `staff/actions.ts:195,446`, `staff/[id]/actions.ts:107,218`, `schedule/actions.ts:150,176,206` — every site carries `CAS:` comment + `concurrent_change_retry` return. |
| AUD-V3-005 | 🟠 HIGH | **CLOSED** | commit `35ce5c7` (CAS predicate) + `cbd34dc` (migration 138 atomic `rpc_refund_payment`). Tap API call now happens BEFORE any DB write. |
| AUD-V3-006 | 🟠 HIGH | **CLOSED** | `src/app/auth/callback/route.ts:10-16` — `safeRedirect()` pins all 5 redirects to `NEXT_PUBLIC_SITE_URL`. |
| AUD-V3-007 | 🟠 HIGH | **DEFERRED** | next-intl major bump — explicitly deferred per session 101 notes (separate PR + full i18n smoke test required). |
| AUD-V3-008 | 🟡 MEDIUM | **OPEN** | Error swallowing in `analytics/queries.ts` — 6 hr refactor; reserve for a dedicated session. |
| AUD-V3-009 | 🟡 MEDIUM | **CLOSED** | `reservations/actions.ts:254` + `inventory/purchases/actions.ts:154` — both have `.eq('status', currentStatus)` CAS predicate. |
| AUD-V3-010 | 🟡 MEDIUM | **CLOSED** | `clock/actions.ts:59-70` — x-real-ip/cf-connecting-ip primary + httpOnly device cookie + per-staff bucket (10/1h). |
| AUD-V3-011 | 🟡 MEDIUM | **CLOSED** | commit `f921e66` — all `as any` casts removed. |
| AUD-V3-012 | 🟡 MEDIUM | **OPEN** | Service-role for analytics reads — 3 hr; defense-in-depth, not exploitable today. |
| AUD-V3-013 | 🟡 MEDIUM | **CLOSED** | `webhooks/tap/route.ts:28-50,168` — `tapWebhookSchema` zod-validates body before RPC call. |
| AUD-V3-014 | 🟡 MEDIUM | **CLOSED** | commit `cbd34dc` (migration 138) + `c0f8826` — atomic refund RPC + real Tap API call + audit-log durability. |
| AUD-V3-015 | 🔵 LOW | **OPEN** | postcss dev-dep CVE — out of scope (package.json). |
| AUD-V3-016 | 🔵 LOW | **CLOSED** | Session 98 — `supabase gen types --linked` regenerated, all `as never` casts stripped. |
| AUD-V3-017 | 🔵 LOW | **OPEN** | `createServiceClient` sync/async inconsistency — 79 non-awaited + 69 awaited sites. Either direction is a ~70-file diff. Low value (await on non-promise is a no-op); leave until a natural refactor touches the supabase helpers. |
| AUD-V3-018 | 🔵 LOW | **ACCEPTED** | Author already noted "Not an XSS finding". |
| AUD-V3-019 | 🔵 LOW | **ACCEPTED** | Author already noted "Acceptable; no fix". |
| AUD-V3-020 → 023 | ⚫ INFO | unchanged | Design decisions, no fix required. |

**Genuinely-open net of accept/defer:** AUD-V3-002 (package CVEs), AUD-V3-008 (analytics error refactor), AUD-V3-012 (analytics anon client), AUD-V3-015 (postcss dev CVE), AUD-V3-017 (await consistency).

**Implication:** Production Ready posture from this audit ("CAUTION — 4 must-fix items") is no longer accurate. The 2 critical and 4 high deploy-blockers are all closed except AUD-V3-002 (npm audit fix), which is a package-lockfile-only change pending a deps session. A v4 audit refresh would more accurately read: Security Score ~88 / 100, Production Ready: GREEN modulo `npm audit fix`.

The detailed findings below are preserved as-is for historical reference. Use this table as the authoritative status going forward.

---

```
╔══════════════════════════════════════════════════════════╗
║     MASTER AUDIT REPORT — Kahramana Baghdad Dashboard    ║
║     Stack: Next.js 15 / Supabase / Sanity                ║
║     Mode: FULL                                            ║
╚══════════════════════════════════════════════════════════╝

⚡ EXECUTIVE SUMMARY
  Security Score:      71 / 100
  Code Quality Score:  86 / 100
  Production Ready:    CAUTION (4 must-fix items before next deploy)

  🔴 CRITICAL:  2   (clock PIN hashing, dependency CVEs in next)
  🟠 HIGH:      4   (timing-safe sig, staff TOCTOU x4, refund race, fast-uri CVE)
  🟡 MEDIUM:    7   (error swallowing, status-pin races, type bypasses, IP spoof)
  🔵 LOW:       5   (postcss XSS dep, as never casts, await consistency, etc.)
  ⚫ INFO:      4

  Overall Posture: CAUTION — strong RBAC + RLS foundation, but 2 deploy-blockers.
```

---

## Attack Surface Snapshot

| Surface | Count | Notes |
|---|---|---|
| Dashboard pages (`src/app/[locale]/dashboard/**/page.tsx`) | 94 | All routed through middleware auth |
| Dashboard server actions (`**/actions.ts`) | 34 | All marked `'use server'` |
| API routes (`src/app/api/**/route.ts`) | 5 | health, inventory/template, inventory/export, webhooks/tap, auth/callback |
| Middleware files | 1 | `src/middleware.ts` — CSP nonce + Supabase session + RBAC |
| Auth library | 7 | session, permissions, rbac, rbac-ui, dashboard-guards, order-access, customerSession |
| Service-role usage sites | 26 | analytics (13), reports/validator (2), dashboard/stats, branches, inventory/export, health, webhooks/tap, plus dashboard actions |
| Migration files | 127 | RLS hardened across 78 tables; latest = 124 |

---

## 🔴 CRITICAL — DEPLOY BLOCKERS

### [AUD-V3-001] Unsalted SHA-256 hashing of 4-digit clock PINs

**Layer:** Security (S2 — cryptography) | **OWASP:** A02 Cryptographic Failures

**Files:**
- `src/app/clock/actions.ts:17` — `hashPin()` function
- `src/app/[locale]/dashboard/staff/actions.ts:244` — `createStaffFull`, line 244
- `src/app/[locale]/dashboard/staff/[id]/actions.ts:84` — `updateStaffProfile`, line 84

**Evidence:**
```ts
function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex')
}
```

**Issue.** PINs are 4 digits → 10,000 possible values. Unsalted SHA-256 of the entire keyspace fits in 320 KB. If `staff_basic.clock_pin_hash` ever leaks (database backup, RLS bug, SQL injection, malicious admin export, dev seed file), every staff PIN is recovered in milliseconds. Additionally, two staff who choose the same PIN hash to the same value (no per-row salt), so `verifyPin()` at `clock/actions.ts:72-77` returns the first match — collision impersonation is possible.

**Chain.** Enables → [AUD-V3-014]: a leaked hash plus knowledge of staff IDs (which are non-secret — visible in `/dashboard/staff` table to any branch_manager+) lets an attacker forge `clockIn(staffId, pin)`, accruing fake hours / overtime that flow into `get_labor_cost_metrics` and payroll.

**Fix.** Migrate to bcrypt (`@node-rs/bcrypt` or built-in `bcrypt` lib already implied) with `cost=10` and a per-row salt:

```ts
// New helper
import bcrypt from 'bcrypt'
async function hashPin(pin: string) { return bcrypt.hash(pin, 10) }
async function verifyPin(pin: string, hash: string) { return bcrypt.compare(pin, hash) }
```

DB migration: keep `clock_pin_hash` column but invalidate all current rows (`UPDATE staff_basic SET clock_pin_hash = NULL`); require all staff to re-set PIN on next clock-in. Update `verifyPin()` at `clock/actions.ts:65` to fetch ALL active staff and `bcrypt.compare` the input against each hash (acceptable for ~10–50 staff; for larger rosters require staff to enter their staff ID first, then verify).

**Risk if ignored.** Total PIN compromise on any leak. PIN attacks against clocking system → payroll fraud, attendance falsification.

**Effort.** 2–3 hours including migration + staff re-enrollment flow.

---

### [AUD-V3-002] High-severity CVEs in `next` package — middleware/SSRF bypass exploitable in production

**Layer:** Production Readiness | **OWASP:** A06 Vulnerable Components

**Evidence (`npm audit`):**

| Package | Severity | Issue |
|---|---|---|
| **next** `<15.5.16` | **HIGH** | 10+ CVEs: SSRF via WebSocket upgrade (CVSS 8.6); Middleware/Proxy bypass via dynamic route params (CVSS 8.1); RSC cache poisoning; beforeInteractive XSS; Image Optimization DoS; segment-prefetch middleware bypass; i18n middleware bypass; redirect cache poisoning |

**Issue.** Several of these directly attack the surfaces this audit covers. The middleware bypass via dynamic route params (CVSS 8.1) could allow `/dashboard/[anything]` to skip the auth check in `src/middleware.ts:178-227`. The i18n middleware bypass affects the `/ar` / `/en` prefix handling in `routing.ts`. The RSC cache poisoning enables session/state leak across users.

**Chain.** Middleware bypass + the audit's other findings (refund race, staff TOCTOU) → an unauthenticated attacker could hit those vulnerable endpoints without ever being checked.

**Fix.**

```bash
npm audit fix          # non-breaking; bumps next to 15.5.16+, fast-uri, postcss
```

For `next-intl` open redirect (moderate), plan a separate PR — it's a major-version bump (`4.9 → 4.12`) with breaking changes to public API. Audit `appRouter` config after the upgrade.

**Risk if ignored.** Public-facing CVEs are catalogued; automated scanners will find them.

**Effort.** 10 min for `npm audit fix` + build verification. 2–3 hours for `next-intl` major bump.

---

## 🟠 HIGH — MUST FIX

### [AUD-V3-003] Tap webhook signature comparison is not timing-safe

**Layer:** Security (S9 — CSRF/Auth) | **OWASP:** A07 Auth Failures

**File:** `src/lib/payments/tap-client.ts:94-95`

**Evidence:**
```ts
const expected = createHmac('sha256', secret).update(toHash).digest('hex')
return expected === hashstring
```

**Issue.** Plain `===` comparison on a secret-derived string is vulnerable to timing analysis. An attacker controlling network timing (or a benchmarking endpoint) can recover the expected signature byte-by-byte. The project already uses `crypto.timingSafeEqual` correctly at `src/lib/auth/order-access.ts:48` — apply the same pattern here.

**Chain.** A successful timing-side-channel attack lets an attacker forge `POST /api/webhooks/tap` events → fake `CAPTURED` status → orders flip to `paid` without real money flowing.

**Fix.**
```ts
const expectedBuf = Buffer.from(expected, 'hex')
const actualBuf   = Buffer.from(hashstring, 'hex')
if (expectedBuf.length !== actualBuf.length) return false
return crypto.timingSafeEqual(expectedBuf, actualBuf)
```

**Effort.** 5 min.

---

### [AUD-V3-004] Staff TOCTOU race — permission check defeated by concurrent role/branch flip

**Layer:** Architecture (race conditions) | **OWASP:** A01 Broken Access Control

**Carry-over from audit v2 (#15/#16), now confirmed across more sites.**

**Files & lines:**
- `src/app/[locale]/dashboard/staff/actions.ts:143` (`updateStaff`)
- `src/app/[locale]/dashboard/staff/actions.ts:350` (`toggleStaffActive`)
- `src/app/[locale]/dashboard/staff/[id]/actions.ts:57-87` (`updateStaffProfile`)
- `src/app/[locale]/dashboard/staff/[id]/actions.ts:186` (`approveTimeEntry`)
- `src/app/[locale]/dashboard/schedule/actions.ts:142` (`updateShiftStatus`)
- `src/app/[locale]/dashboard/schedule/actions.ts:159` (`deleteShift`)
- `src/app/[locale]/dashboard/schedule/actions.ts:180` (`reviewLeaveRequest`)

**Evidence (updateStaff):**
```ts
const { data: current } = await supabase.from('staff_basic')
  .select('id, role, branch_id, is_active').eq('id', input.id).single()
// ... canManageStaff(caller, target) check ...
const { error } = await service.from('staff_basic')
  .update({ name, role, branch_id }).eq('id', input.id)
// No row-count guard, no compare-and-swap on role/branch_id
```

**Issue.** Pattern is `read → check permission against read result → blind update by id`. Between read and update, a parallel request can flip `role` (e.g. owner promotes target to general_manager), but the original caller still completes their update — bypassing the freshly-elevated target's protections.

A branch_manager could (in collusion with a slow network) update a peer's row in the moment they're being moved to another branch.

**Chain.** Combined with [AUD-V3-001] PIN attack: forged clock-ins by a deactivated employee — the deactivation flips `is_active=false` but a concurrent `clockIn` request reads the still-active row.

**Fix.** Compare-and-swap predicate + row-count guard:

```ts
// Pattern A — pin to read state:
const { data: updated } = await service.from('staff_basic')
  .update({ name, role, branch_id })
  .eq('id', input.id)
  .eq('role', current.role)
  .eq('branch_id', current.branch_id)
  .eq('is_active', current.is_active)
  .select('id')
  .single()
if (!updated) return { success: false, error: 'concurrent_change_retry' }

// Pattern B — migrate to atomic RPC `rpc_update_staff` (recommended for staff —
// audit_logs insert lives inside the transaction too)
```

Apply Pattern A to all 7 sites. The `orders/actions.ts:152-166` (`updateOrderStatus`) is the gold-standard reference — it does exactly this.

**Effort.** 30 min per site = ~3.5 hours.

---

### [AUD-V3-005] Refund payment double-execution race

**Layer:** Architecture (race conditions) | **OWASP:** A04 Insecure Design

**File:** `src/app/[locale]/dashboard/payments/actions.ts:23-42`

**Evidence:**
```ts
const { data: payment } = await supabase.from('payments')
  .select('id, status, amount_bhd').eq('id', paymentId).single()
if (payment.status !== 'completed') return { error: 'not_refundable' }

const { error } = await supabase.from('payments')
  .update({ status: 'refunded', refunded_at, refund_amount_bhd })
  .eq('id', paymentId)  // ← no .eq('status','completed'), no row-count guard
```

**Issue.** Two owners clicking "Refund" simultaneously both pass the `status === 'completed'` check (read), both run the update (write). DB has two audit log entries claiming refund + only one `refund_amount_bhd` recorded. When the Tap refund API integration ships (currently deferred per audit v2 — `phase-state.json:460`), this becomes a real double-refund: customer's card is credited twice.

**Chain.** When `TAP_SECRET_KEY` is finally set and the action is upgraded to call Tap, the race becomes financial.

**Fix.**
```ts
const { data: updated, error } = await supabase.from('payments')
  .update({ status: 'refunded', refunded_at, refund_amount_bhd: payment.amount_bhd })
  .eq('id', paymentId)
  .eq('status', 'completed')  // ← compare-and-swap on status
  .select('id')
  .single()
if (!updated) return { error: 'refund_already_processed_or_status_changed' }
```

**Effort.** 10 min.

---

### [AUD-V3-006] Open redirect risk via Host header in `/auth/callback`

**Layer:** Security (S4 — open redirect) | **OWASP:** A01 Broken Access Control

**File:** `src/app/auth/callback/route.ts:5-7, 15-18, 67-74`

**Evidence:**
```ts
const { searchParams, origin } = new URL(request.url)
// ...
return NextResponse.redirect(`${origin}/login?error=...`)
return NextResponse.redirect(`${origin}/dashboard`)
```

**Issue.** `origin` is derived from `request.url`, which Next.js builds from the `Host` header. On Vercel + the configured CSP this is hardened, but if a CDN, reverse proxy, or `--hostname` flag misroutes the Host header, an attacker-crafted Supabase password-reset link could redirect post-auth to an attacker domain — and the user, who just typed their password, lands on a clone site for credential harvesting.

**Note.** Severity is HIGH not CRITICAL because exploitation requires both a misconfigured proxy AND a phishing pretext.

**Fix.** Pin redirect target to an absolute, env-derived URL:

```ts
const SITE = process.env.NEXT_PUBLIC_SITE_URL!  // already in production env
return NextResponse.redirect(new URL('/dashboard', SITE))
```

Apply to all 4 `NextResponse.redirect` calls in this file.

**Effort.** 5 min.

---

### [AUD-V3-007] `next-intl` open redirect + prototype pollution (CVE)

**Layer:** Production Readiness | **OWASP:** A06 Vulnerable Components

Already covered in [AUD-V3-002] but separated for triage clarity:
- GHSA-8f24-v5vv-gm5j — open redirect
- GHSA-4c35-wcg5-mm9h — prototype pollution via attacker-controlled translation catalog keys

`messages/ar.json` and `messages/en.json` are repo-controlled — but the prototype pollution vector becomes real if any user-controlled string ever flows into `t()` keys. Sweep for that pattern before relying on review.

**Fix.** `npm audit fix --force` → `next-intl@4.12.0` (major bump, breaking). Plan separate PR with full i18n smoke test.

**Effort.** 2–3 hours.

---

## 🟡 MEDIUM — SHOULD FIX

### [AUD-V3-008] Error swallowing in analytics queries (carry-over #6/#7/#8)

**Layer:** Code Quality / Production Readiness

**Files:**
- `src/lib/analytics/queries.ts` — 15+ sites pattern: `if (error || !data) return []` (lines 197, 247, and 13 more)
- `src/lib/dashboard/stats.ts:131-135` — destructures `{ data }` only, no error surface

**Issue.** When a Supabase query fails (RPC missing, RLS denial, network timeout), the helper silently returns `[]` / `0`. The dashboard renders "zero orders today" instead of a clear error. For an operational dashboard this is dangerous — managers make decisions on the assumption that empty = no orders, not query failure.

**Fix.** Adopt `Result<T, E>` type. Helpers return `{ ok: true, data } | { ok: false, error }`. Pages render an error boundary on `ok: false`. This is the audit v2 deferred fix; carrying it forward unchanged.

**Effort.** ~6 hours (15 call sites + 5 pages + new error UI).

---

### [AUD-V3-009] Reservation + PO status update missing optimistic concurrency

**Layer:** Architecture (race conditions)

**Files:**
- `src/app/[locale]/dashboard/reservations/actions.ts:236-241` (`updateReservationStatus`)
- `src/app/[locale]/dashboard/inventory/purchases/actions.ts:149-154` (`updatePOStatus`)

**Evidence (reservations):**
```ts
const allowed = ALLOWED_RESERVATION_TRANSITIONS[currentStatus]
if (!allowed.includes(parsedStatus.data)) throw ...
// ↓ NO .eq('status', currentStatus) on update
const { data: updated } = await supabase.from('reservations')
  .update(patch).eq('id', parsedId.data).select('id').single()
```

**Issue.** Has row-count guard (good — added in session 96) but no compare-and-swap on `status`. Two managers viewing the same `pending` reservation can both successfully transition — A to `confirmed`, B to `cancelled` — and the last writer wins. Both audit log entries record success.

`orders/actions.ts` already does this correctly (`.eq('status', order.status)`). Apply the same pattern.

**Fix.** Add `.eq('status', currentStatus)` to both update calls.

**Effort.** 15 min.

---

### [AUD-V3-010] Rate-limit key spoofable via `x-forwarded-for`

**Layer:** Security (S4 — rate limiting)

**File:** `src/app/clock/actions.ts:36-38`

**Evidence:**
```ts
async function getAttemptKey(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
```

**Issue.** Two problems:
1. **Spoof.** An attacker can set `x-forwarded-for: <random-ip>` on every request, getting a fresh 5-attempt bucket each time → effectively unlimited PIN attempts against unsalted 4-digit hashes ([AUD-V3-001]).
2. **Shared bucket fallback.** When the header is absent, ALL anonymous attackers share the `'unknown'` key — one attacker exhausts the legitimate staff's quota.

**Fix.** Vercel exposes the real client IP via `x-real-ip` (set internally, not echoed from the request). Combine with cookie-bound device ID for defense-in-depth:

```ts
const ip = h.get('x-real-ip') || h.get('cf-connecting-ip') || 'unknown'
const deviceId = cookieStore.get('clock_device')?.value ?? randomUUID()
return `${ip}::${deviceId}`
```

Critically, also add a **per-staff-id** rate limit (e.g., 10 attempts / 1h per staff_id) so attackers can't bypass IP-based limits with proxies.

**Effort.** 30 min.

---

### [AUD-V3-011] `as any` casts on Supabase results bypass type safety

**Layer:** Code Quality / TypeScript

**Files (14 occurrences):**
- `src/lib/analytics/queries.ts` — lines 473, 545, 621, 688, 699, 751
- `src/lib/promotions/evaluator.ts` — lines 129–133 (5 sites)
- `src/lib/reports/validator.ts` — lines 149, 164

**Issue.** Each `(sb as any)` discards the auto-generated `Database` type. If the underlying view/RPC schema drifts (e.g. column renamed), TypeScript won't catch it — runtime returns `undefined` for the missing column, which then flows into [AUD-V3-008] (silent empty).

In `analytics/queries.ts` the casts are necessary because the RPCs aren't in the generated types — but they should be **localized** to the RPC name only, not the entire query result.

**Fix.**

```ts
// Bad — entire client untyped
const { data, error } = await (sb as any).rpc('rpc_x', ...)

// Better — only the unknown RPC name is cast
const { data, error } = await sb.rpc('rpc_x' as never, p as never)
type ExpectedRow = { id: string; ... }
const rows = (data ?? []) as ExpectedRow[]
```

Or: regenerate types now (`supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts`) and remove all `as never` AND `as any` in one cleanup commit. This was deferred in audit v2 too.

**Effort.** 30 min (types regen) + 1 hour (cleanup commit).

---

### [AUD-V3-012] Service-role used for read-only analytics — RLS scope enforced by code only

**Layer:** Architecture (defense in depth)

**Files:** All 13 `createServiceClient()` calls in `src/lib/analytics/queries.ts`, plus `src/lib/dashboard/stats.ts:86`.

**Issue.** Every analytics read uses the service-role client, which BYPASSES RLS. Branch-scope is enforced only by `branchId?` parameter discipline (session 96's fix). If any new helper forgets to add the parameter, OR a future contributor calls a helper from a non-global page without passing branchId, branch data leaks across managers.

**Fix.** Switch read-only analytics to the cookie-bound anon client (`createClient()`). Supabase RLS then enforces scope as a backstop. Service-role is only required for writes that need to ignore RLS (e.g. `audit_logs.insert` from cross-branch admin actions).

For matview reads that need to bypass RLS for performance, keep service-role but wrap each helper with an explicit `branchId` requirement (not optional):

```ts
// Today
export async function getMetrics(from, to, prevFrom, prevTo, branchId?: string)

// Better
export async function getMetrics(args: { from, to, prevFrom, prevTo, branchId: string | 'all' })
```

The `'all'` literal forces callers to consciously opt into all-branch scope; an accidental omission is a compile error.

**Effort.** ~3 hours (helper signature change + 6 call sites updated).

---

### [AUD-V3-013] `as unknown as Json` cast bypasses type safety in webhook payload

**Layer:** Code Quality

**File:** `src/app/api/webhooks/tap/route.ts:52`

**Evidence:**
```ts
const { data, error } = await supabase.rpc('process_tap_webhook', {
  p_payload: body as unknown as Json,
  // ...
})
```

**Issue.** `body` is already validated as `Record<string, unknown>` by line 30-32 but cast directly to `Json` without zod-validating fields used in the payload. The downstream RPC `process_tap_webhook` is SECURITY DEFINER (per migrations) — a malformed payload could exercise edge cases there. The size limit (64 KiB) and JSON parse + signature check provide partial defense.

**Fix.** Add a zod schema for the expected Tap event shape (`{ id, object, status, reference: { order }, amount, currency, hashstring }`), validate before calling the RPC.

**Effort.** 30 min.

---

### [AUD-V3-014] Refund without audit-log durability + no Tap API call

**Layer:** Architecture / Compliance

**File:** `src/app/[locale]/dashboard/payments/actions.ts:46-59`

**Issue.** Refund is recorded as a "best-effort audit log" — if the `audit_logs.insert` fails (DB full, transient issue), the refund is committed but there's no durable record of who issued it. For a financial event, this is reversed from the right ordering. Combined with the (still pending) Tap API integration deferred in audit v2: today's "refund" is purely DB state, customer's card is not credited.

**Fix.** Wrap refund + audit in a single RPC (similar to migration 124 for PO creation):

```sql
CREATE OR REPLACE FUNCTION rpc_refund_payment(
  p_payment_id uuid, p_actor_id uuid, p_actor_role text, p_branch_id text
) RETURNS uuid SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. UPDATE payment with compare-and-swap on status='completed'
  -- 2. INSERT audit_log
  -- All atomic in one transaction
END $$;
```

Then the action becomes a single RPC call; either both succeed or both roll back.

Once Tap merchant approval lands, the actual API call goes in a separate "outbox" pattern (DB transactional + async worker).

**Effort.** 1 hour for RPC + migration + action rewrite.

---

## 🔵 LOW — POLISH

### [AUD-V3-015] `postcss` XSS in dev dependency chain

**Layer:** Production Readiness

Already covered by `npm audit fix`. Affects build-time CSS minification only — not a runtime risk. Fix when bumping `next`.

---

### [AUD-V3-016] `as never` casts at 2 RPC boundaries (carry-over)

**Files:**
- `src/app/[locale]/dashboard/inventory/stock/[branchId]/actions.ts:37,42`
- `src/app/[locale]/dashboard/inventory/purchases/actions.ts:94,102`

Both for RPCs added in migrations 123/124, not yet in generated types. Fix: `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts` then strip both casts in one cleanup commit. Deferred from session 96.

---

### [AUD-V3-017] Inconsistent `await createServiceClient()` style

**Issue.** `createServiceClient()` in `src/lib/supabase/server.ts:31` is **synchronous** (no async), but is `await`ed in some places (`webhooks/tap/route.ts:42`, `staff/actions.ts:60, 207, 290`) and not in others (`analytics/queries.ts:180`, `dashboard/stats.ts:86`). The await on a non-promise is harmless but inconsistent.

**Fix.** Either make `createServiceClient` async (mirrors `createClient`) or remove the `await` from the 4 sites. Recommend making it async for symmetry with the anon factory.

**Effort.** 15 min.

---

### [AUD-V3-018] `document.write` in receipt-printer fallback

**File:** `src/lib/hardware/receipt-printer.ts:357-360`

`document.write` is legacy, but ALL user-controlled fields ARE properly `htmlEscape`'d (line 263–270) including `customerName`, `customerPhone`, `notes`, modifiers. **Not an XSS finding.** Just legacy pattern; could migrate to `iframe.srcdoc` for cleaner CSP.

---

### [AUD-V3-019] `console.log` in `src/lib/toast.ts` server-side fallback

Toast module exports `console.log`/`error` as server-side no-op fallbacks. Only triggers when a server component would otherwise call client-toast. Acceptable; no fix.

---

## ⚫ INFO — OBSERVATIONS

### [AUD-V3-020] Empty PO creation allowed by RPC
Migration 124 design decision — a draft PO can be created with zero items and edited later. Documented in audit v2; carried as INFO.

### [AUD-V3-021] HIDDEN_BRANCHES filter in analytics
Global admin queries exclude `HIDDEN_BRANCHES` to keep test-branch noise out of reports. Branch-scoped queries skip the filter (the scoped user can't be on a hidden branch). Working as designed.

### [AUD-V3-022] CSP nonce-strict + strict-dynamic in prod
Middleware builds a strong CSP. Good posture. Note that `'unsafe-inline'` is included as a legacy-browser fallback — modern browsers ignore it when a nonce is present, so no real weakening. Document this decision in `CLAUDE.md` so a future audit doesn't flag it.

### [AUD-V3-023] No CSRF tokens on server actions
Next.js Server Actions handle CSRF protection at the framework level (encrypted Action ID). No custom CSRF token needed. `/api/webhooks/tap` is HMAC-protected; `/api/inventory/{template,export}` use session auth. ✅

---

## ✅ WHAT'S SOLID

Specific reinforcements observed during the audit — DO NOT regress:

1. **`orders/actions.ts` is the gold-standard reference.** Section guard + UUID validation + branch scope + transition matrix + refund-aware paid-payment check + compare-and-swap update + audit log. All other lifecycle actions should mirror this pattern (see [AUD-V3-009]).
2. **`pos/actions.ts` (`createManualOrder`)** — full zod schema, fail-closed branch check, server-side price resolution against DB, modifier price validation against `menu_options`, idempotency key support. Tampering resistant.
3. **`webhooks/tap/route.ts`** body-size guard, JSON parse with try/catch, signature verification, UUID validation on order reference, atomic RPC dispatch. Solid except for [AUD-V3-003] string comparison.
4. **Migration 028, 064, 089, 095, 119, 120, 122** — systematic RLS hardening across 78 tables. All SECURITY DEFINER functions have locked `search_path`. Views flipped to `security_invoker=on`. No anon-facing INSERT/UPDATE/DELETE on orders, payments, or staff_basic.
5. **`requireDashboardSection` + `assertBranchScope`** — centralised RBAC. Every dashboard action consistently uses these guards; no inline role checks.
6. **CSP with per-request nonce** and `strict-dynamic` in production. `frame-ancestors 'none'` + `object-src 'none'` blocks clickjacking and Flash relics.
7. **No `dangerouslySetInnerHTML`, no `eval`, no `innerHTML =`** in dashboard code (one `document.write` in receipt printer is properly escaped — [AUD-V3-018]).
8. **TypeScript strict, 0 `tsc` errors, 0 RTL violations, 0 hex colors, 0 hardcoded phones** — all phase-gate checks pass.

---

## 🎯 PRIORITY ACTION LIST

| # | Finding | Effort | Severity | Why now |
|---|---|---|---|---|
| 1 | [AUD-V3-002] `npm audit fix` (next + fast-uri + postcss) | 10 min | 🔴 | Public CVE catalog; automated scanners |
| 2 | [AUD-V3-003] `timingSafeEqual` for Tap webhook | 5 min | 🟠 | One-line fix, hardens payment auth |
| 3 | [AUD-V3-005] Refund double-execution `.eq('status','completed')` | 10 min | 🟠 | Becomes financial when Tap API ships |
| 4 | [AUD-V3-006] Pin redirect to `NEXT_PUBLIC_SITE_URL` (4 sites) | 5 min | 🟠 | Removes phishing surface |
| 5 | [AUD-V3-009] Add `.eq('status', x)` to reservation + PO updates | 15 min | 🟡 | Same pattern as gold-standard orders/actions.ts |
| 6 | [AUD-V3-001] Bcrypt migration for clock PIN | 2–3 hr | 🔴 | Schedule for next sprint; coordinate with staff |
| 7 | [AUD-V3-004] Compare-and-swap on 7 staff/schedule sites | 3.5 hr | 🟠 | Follow `orders/actions.ts` pattern exactly |
| 8 | [AUD-V3-010] Switch rate-limit key to `x-real-ip` + cookie | 30 min | 🟡 | Multiplies PIN-attack difficulty by 1000× |
| 9 | [AUD-V3-016] `supabase gen types --linked` + strip `as never` | 1 hr | 🔵 | Cleanup; also covers audit v2 deferral |
| 10 | [AUD-V3-007] `next-intl@4.12` major bump | 2–3 hr | 🟠 | Separate PR; full i18n smoke test |
| 11 | [AUD-V3-008] Error swallowing — `Result<T,E>` adoption | 6 hr | 🟡 | Carry-over from v2; needs UI work too |
| 12 | [AUD-V3-012] Anon client for analytics reads | 3 hr | 🟡 | Defense in depth |
| 13 | [AUD-V3-014] `rpc_refund_payment` atomic | 1 hr | 🟡 | Pre-requisite for real Tap refund API |

**Quick wins (under 1 hour total):** items 1–5, ~45 minutes of work, closes 4 of 5 must-fixes.

**Critical path before next deploy:** items 1, 2, 3, 4 + verify items 5, 8.

---

## OWASP TOP 10 COVERAGE

| Code | Category | Status | Notes |
|------|----------|--------|-------|
| A01 | Broken Access Control | 🟠 PARTIAL | Strong RBAC; [AUD-V3-004] TOCTOU + [AUD-V3-006] redirect |
| A02 | Cryptographic Failures | 🔴 FAIL | [AUD-V3-001] unsalted SHA-256 PIN |
| A03 | Injection | ✅ PASS | No raw SQL, no `eval`, parameters via Supabase client |
| A04 | Insecure Design | 🟡 CAUTION | [AUD-V3-005] refund race, [AUD-V3-014] non-atomic financial event |
| A05 | Security Misconfiguration | ✅ PASS | CSP strict, security headers in middleware, no CORS `*` |
| A06 | Vulnerable Components | 🔴 FAIL | [AUD-V3-002] next CVEs; [AUD-V3-007] next-intl |
| A07 | Auth Failures | 🟠 PARTIAL | [AUD-V3-003] timing attack, [AUD-V3-010] rate-limit spoof |
| A08 | Software Integrity | ✅ PASS | Server Actions CSRF-protected by framework |
| A09 | Logging Failures | 🟡 CAUTION | [AUD-V3-008] swallowed errors, [AUD-V3-014] best-effort audit |
| A10 | SSRF | 🟡 CAUTION | [AUD-V3-002] next SSRF CVE; Nominatim fetch in `pos/actions.ts` is allowlisted |

---

## DEFERRED FROM PREVIOUS AUDITS — STATUS

| Item | v2 Finding | v3 Status |
|---|---|---|
| Error swallowing in analytics | #6 / #7 / #8 | Still open → [AUD-V3-008] |
| Staff TOCTOU | #15 / #16 | Still open, scope expanded → [AUD-V3-004] (7 sites) |
| Sentry sourcemap verification | — | Not re-checked this audit (requires build log inspection) |
| Vercel CPU re-check post-tunnel | — | Not re-checked (24-48h post-deploy needed) |
| Supabase types regen | — | Confirmed pending → [AUD-V3-016] |
| POS UX polish (#29-#32) | — | Out of security scope; backlog |

---

## METHODOLOGY NOTES

This audit ran the full master-auditor loop (SCOPE → INGEST → HYPOTHESIZE → PROBE → CHAIN → REPORT) restricted to dashboard surfaces. 16 files read in full + targeted grep across 9 patterns + automated TSC/audit run. RLS migration cross-reference performed for migrations 028, 035, 064, 089, 095, 119, 120, 122. Customer-facing surfaces (checkout, menu, order tracking) NOT re-audited — they were covered in earlier sessions and have their own audit trail.

**Findings ground rules followed:**
- Every finding has a file:line citation
- Every finding has a concrete fix snippet
- No hypotheticals — only patterns actually observed in code
- Chains documented where one finding enables another
- INFO-level observations included only when they document a non-obvious design decision

**Not findings (false-positive checks performed):**
- `dangerouslySetInnerHTML` / `eval` / `innerHTML` — none in dashboard code
- Receipt printer `document.write` — confirmed escaped, NOT XSS
- Service-role usage in webhook — confirmed appropriate (no user session at webhook time)
- `as unknown as { admin: AuthAdmin }` in staff actions — required type bridge for `@supabase/ssr`, NOT security issue
- Empty PO RPC — intentional design (audit v2 decision logged)
- `console.log/warn/error` — confirmed only in error paths or dev fallbacks
