# LAST-SESSION.md — Kahramana Baghdad
> Session 101: pre-launch hardening sweep — session-99 + session-100 carry-forward landed, 5 new migrations, 1 race-window close, 1 new HIGH finding (VULN-RBAC-05) discovered + closed
> Date: 2026-05-14
> Author: Claude Code (Opus 4.7)

## SESSION 101 — SUMMARY

Sixteen commits pushed from session start `853ccff` → `cbd34dc`. Master pushed to origin. tsc clean at every gate. Build clean (after Windows retries on flaky `Collecting page data` step — see `feedback_windows_build_race`).

Items closed this session:
- **VULN-RBAC-01/02/04** — session-99 work was on-disk; committed and pushed (`1ccb487`).
- **VULN-104** — `rpc_create_order` CASE inversion (`013f859` = migration 134) + legacy 25-arg overload dropped (`684c193` = migration 135). 25-arg body inspection confirmed it still carried the source-first buggy CASE — would have been a live VULN-104 path if any caller reached it.
- **VULN-AUTH-04/06 + VULN-SEC-01 (Path A)** — session-100 auth trio committed (`c6c1b6a`). Path A then failed at runtime (see below).
- **VULN-SEC-01 (Path B)** — `app_config` table-driven gate (migration 136 → `e896cb5`). Live on prod. Verified `RAISE EXCEPTION 'gate active'` fires.
- **VULN-CRY-01/03** — webhook payload hardening (`c49d921`) and race-window short-circuit (`bef64f1`). 400 with audit log when `reference.order` present but `gateway_transaction_id` binding absent.
- **VULN-INJ-01/02** — inventory `.or()` escapeSearch + XLSX formula injection guard (`fda3db7`).
- **VULN-AUTH-01/02** — staff `requireDashboardSection` gate + unified denial string + per-target + per-caller invite rate-limit (`f59b9f6`).
- **VULN-1.07** — health endpoint sha + DB-error redaction (`9331158`). NOTE: status string flipped `'unhealthy'` → `'error'`; Better Stack assertion swap required.
- **KAH-2026-05-04 → VULN-RBAC-05** — see "Discovered finding" below (`64535e3` = migration 137).
- **KAH-2026-05-12** — null-branch bypass on 3 service-role-reading dashboard pages (`b20cfc2`).
- **KAH-2026-05-06 / AUD-V3-014** — atomic RPCs for refund/closeShift/POS finalize (`cbd34dc` = migration 138). closeShift previously had NO audit at all; rpc_close_shift now adds it inside the transaction.

## COMMITS THIS SESSION (in order)

| Hash | Subject |
|---|---|
| `1ccb487` | fix(rbac): null branch_id fail-closed, delivery completion restriction, approveShift CAS (VULN-RBAC-01/02/04) |
| `013f859` | fix(rpc): invert payment_method priority in rpc_create_order — breaks CHAIN-001 cash-skim (VULN-104) |
| `c6c1b6a` | fix(auth): forgot-password rate limit + Turnstile, set-password recovery gate, seed migration prod env-gate (VULN-AUTH-04/06, VULN-SEC-01) |
| `684c193` | fix(rpc): drop legacy 25-arg rpc_create_order overload — unreachable + carried VULN-104 buggy CASE |
| `c49d921` | fix(payments): HMAC amount normalization + order-ref binding + toSafeError (VULN-CRY-01/03) |
| `0f9ab6a` | test: add unit test suite + 11 Tap webhook tests (Gemini sibling) |
| `fda3db7` | fix(inventory): escapeSearch on .or() builders + sanitizeCell XLSX formula injection (VULN-INJ-01/02) |
| `f59b9f6` | fix(staff+orders): requireDashboardSection gate + error redaction + invite rate-limit (VULN-AUTH-01/02) |
| `4ceb6cc` | fix(checkout+clock): raw error.message redaction via toSafeError |
| `9331158` | fix(health): remove DB error + commit SHA from public response (VULN-1.07) |
| `bb8fb9c` | chore: update session notes (session-100 LAST-SESSION snapshot) |
| `bef64f1` | fix(webhook): short-circuit 400 when reference present but gateway_id binding absent — closes VULN-CRY-01 race window |
| `e896cb5` | fix(seed-guard): replace cluster-GUC env-gate with app_config table — Supabase managed blocks ALTER DATABASE SET (VULN-SEC-01 Path B) |
| `64535e3` | fix(kds): harden bump/recall_station_order text overloads + drop redundant kds_station — closes RBAC bypass (KAH-2026-05-04, VULN-RBAC-05) |
| `b20cfc2` | fix(rbac): fail-closed branch check on 3 service-role-reading dashboard pages — null branch_id no longer wildcard (KAH-2026-05-12) |
| `cbd34dc` | fix(audit): atomic RPCs for refundPayment, closeShift, POS finalize — audit failure now rolls back parent (KAH-2026-05-06, AUD-V3-014) |

## VULN-SEC-01 — PATH A → B PIVOT

Path A (cluster GUC): `ALTER DATABASE postgres SET app.environment = 'production'` returned `42501 permission denied` in BOTH the CLI session (postgres @ is_superuser=off) AND Studio SQL Editor. Supabase managed strips superuser from `postgres`; only `supabase_admin` retains it and is unreachable. Confirmed via `SELECT current_user, current_setting('is_superuser')` → `postgres, off`.

Path B (table-driven): migration 136 creates `public.app_config` with staff-only RLS read + owner-writable INSERT (Studio runs as `postgres`, the table owner, so it can write without superuser). Migration 006's env-gate rewritten to `SELECT value FROM app_config WHERE key='environment'` with `EXCEPTION WHEN undefined_table THEN NULL` for fresh envs (006 runs before 136 in fresh-clone migrate-up). Operator INSERTed the production flag via Studio. Verified gate fires by dry-running 006's DO block — returned `ERROR: P0001: gate active` as expected.

Generalizable lesson: any future runtime config flags that need to be set against Supabase managed will hit the same superuser wall. Standardize on `app_config` rows rather than GUCs.

## VULN-RBAC-05 — DISCOVERED IN ITEM 1 (KAH-2026-05-04)

Carry-forward framing was "DROP text overloads if unreachable". Investigation showed text overloads are the LIVE JS-call path — supabase-js sends the station param as JSON text, so PostgreSQL resolves to `(uuid, text)` not `(uuid, kds_station)`. The `kds_station` overload of `recall_station_order` carried full role + branch + 60s + bumped_at checks; the text overload (live) only had a NULL-bypass-prone branch check.

Impact: ANY authenticated session (driver, marketing, support, cashier, waiter) calling `recall_station_order` directly via supabase-js could revert any completed order at any age. JS wrapper (`recallStationOrder` in `kds/actions.ts:201`) enforces role + branch — but bypassing the wrapper (direct rpc call from a hijacked session, server-action smuggling, future code that forgets the wrapper) lands in the unprotected RPC. `bump_station_order` had the same shape with no kds_station sibling at all.

Migration 137: CREATE OR REPLACE both text overloads with full hardening mirroring the kds_station body. DROP `recall_station_order(uuid, kds_station)` — now redundant; eliminates drift risk where future migrations diverge the two paths again. Verified `KDSStationBoard.tsx:140-143` already drops recall entries client-side after 60s, so the legitimate kitchen UI flow is unaffected.

## KAH-2026-05-12 — DASHBOARD BRANCH-FILTER AUDIT

Surveyed all 11 `createServiceClient`-using page.tsx files:

| Page | Status |
|---|---|
| `owner/page.tsx` | PASS — section gate restricts to global roles only |
| `reports/page.tsx` | PASS — `canAccessReports` = `isGlobalAdmin` only |
| `kds/page.tsx` | PASS — explicit fail-closed redirect for non-global with null branch (L53) |
| `inventory/budget/page.tsx` | PASS — early return when activeBranchId null |
| `inventory/catering/page.tsx` | PASS — ternary handles each case explicitly |
| `inventory/catering/new/page.tsx` | PASS — redirect when branchId null |
| `inventory/catering/packages/page.tsx` | PASS — `?? ''` fallback creates impossible-match |
| `inventory/catering/packages/new/page.tsx` | PASS — redirect when branchId null |
| `orders/[id]/page.tsx` | **FIXED** — `user.branch_id &&` short-circuit at L60 was active VULN-RBAC-01 |
| `inventory/catering/[id]/page.tsx` | **FIXED** — defensive gap on `order.branch_id` null bypass |
| `inventory/catering/packages/[id]/page.tsx` | **FIXED** — defensive gap on `pkg.branch_id` null bypass |

Plus: bonus fix at `shifts/actions.ts:91` (closeShift branch-scope check had the same null-bypass shape; folded into Item 3's RPC migration).

## KAH-2026-05-06 — ATOMIC AUDIT (Migration 138)

Three new SECURITY DEFINER PL/pgSQL functions; failure of the audit insert now rolls back the parent operation:

1. **`rpc_refund_payment(p_payment_id, p_actor_id, p_actor_role, p_actor_branch_id)`**: CAS update on `payments.status` from 'completed' → 'refunded' + audit_logs INSERT. Returns JSONB `{success, code?}` for domain errors (PAYMENT_NOT_FOUND, NOT_REFUNDABLE, CONCURRENT_CHANGE).
2. **`rpc_close_shift(...11 args)`**: shift_closings INSERT + audit_logs INSERT. Previously closeShift had NO audit at all — this both atomizes and ADDS the missing trail.
3. **`rpc_pos_finalize_order(p_order_id, p_amount_bhd, p_method, p_payment_status, p_audit_changes, p_actor_id, p_actor_role, p_actor_branch_id)`**: payments INSERT + audit_logs INSERT atomically after rpc_create_order. Decision: the order itself stays in rpc_create_order (already atomic + idempotent + is the financial source of truth). Bundling all three into one mega-RPC would have required adding optional audit params to rpc_create_order, churning a heavily-used function for marginal benefit. Net effect: every POS order either has BOTH payment + audit, or NEITHER — no more orphan orders with missing audit.

ACL: REVOKE FROM anon, GRANT TO authenticated + service_role. Internal role check inside each function further restricts.

Schema sanity-checks done before apply: confirmed `audit_logs.record_id` is text (cast uuid→text in INSERTs), `audit_logs.actor_role` is `staff_role` enum (cast text→enum in INSERTs), `payments.method` is `payment_method` enum, `payments.status` is `payment_status` enum.

## OPEN CARRY-FORWARD

### Operator actions (Ahmed)
- 🔴 **Better Stack monitor** — change assertion from `'unhealthy'` to `body.status === 'ok'` (or HTTP 200/503). Alerts are silently passing since `9331158`.
- 🔴 **Cowork branch merge** — `claude/wonderful-euler-85228a` commit `26c059e` still unpushed. Migration 131 is live on prod DB but the file is untracked in master. Merge to align repo with remote.
- 🟠 Cloudflare DNS CNAME → Vercel for kahramanat.com
- 🟠 TAP merchant keys in Vercel env (`TAP_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`)
- 🟠 Turnstile keys in Vercel env (forgot-password captcha in soft-launch fallthrough)
- 🟠 Supabase Free → Pro (Leaked Password Protection toggle returns 402 on Free)
- 🟠 Vercel Node 20.x vs 24.x decision (package.json accepts both)
- 🟠 ME region (dxb1) decision — in Cowork's unpushed config

### Dev actions (next session)
- **KAH-2026-05-05 / AUD-V3-011** — 15+ `as any` casts (4 new this session via the new RPCs in `payments`/`shifts`/`pos` actions). Types regen would clear most.
- **KAH-2026-05-07** — Tap webhook IP allowlist + quarterly secret rotation policy.
- **AUD-V3-007** — next-intl@4.12 major bump.
- Audit migrations 125, 129, 130 for the `migration repair --status applied` desync pattern that hit 123.
- Delete dead client files: `forgot-password/ForgotPasswordClient.tsx`, `set-password/SetPasswordClient.tsx` (unused duplicates of the live forms).
- KAH-2026-05-11 — Clock PIN bcrypt dead code (no PINs provisioned).

### Long-blocked (external)
- Meta verification → Sprint 6B (WhatsApp API). Months-long.
- CBB merchant approval → Sprint 6C (Benefit Pay native). 2-4 months.
- Deliverect contract + Bahrain availability + POS API docs → Phase 7b.

## DECISIONS LOGGED

- **POS atomicity scope** (Item 3): `rpc_pos_finalize_order` atomizes (payments INSERT + audit INSERT) AFTER `rpc_create_order` rather than bundling all three into one mega-RPC. Order itself is the financial source of truth and `rpc_create_order` stays single-purpose + idempotent. If finalize fails, the order persists with a paymentWarning surfaced to the cashier for manual resolution. Trade-off: closes 2/3 of the audit gap with minimal blast radius vs. modifying `rpc_create_order` to take audit params (would force re-deploy of a heavily-used function and impact 5 callers).
- **VULN-RBAC-05 fix shape**: rewrite text overloads in place + drop kds_station sibling. One function per name, no overload-resolution ambiguity, supabase-js hits hardened body unconditionally. Confirmed kitchen UI flow doesn't depend on missing checks (KDSStationBoard drops recall entries client-side after 60s already).
- **Path A→B pivot on VULN-SEC-01**: Supabase managed superuser restriction is permanent. Future runtime flags should default to `app_config` table rows, not GUCs. Pattern is now established.
- **Race-window short-circuit on Tap webhook** (`bef64f1`): chose 400 (Tap retries) over silent acceptance. Genuine race recovery is now an operator job — `webhook_errors` rows surface orphans for manual reconciliation via staff payments dashboard. Acceptable trade for closing a free-orders attack vector.
- **Pre-commit hook auto-staging** (`cbd34dc`): 5 unrelated files (reserve/page.tsx, LoginForm.tsx, Footer.tsx, ReserveForm.tsx, SectionHeader.tsx) snuck into the Item-3 commit despite explicit-path `git add`. Hook is auto-staging beyond what's passed. All 5 were clean Gemini-sibling UX/a11y changes — no security impact — but worth knowing for future commits. New memory saved.

## STATUS AT SESSION END

- **TSC**: clean (`npx tsc --noEmit` = 0 errors)
- **Migrations**: LOCAL=138 | REMOTE=138 confirmed. Plus migration 131 (Cowork's, unpushed in `claude/wonderful-euler-85228a`) is live on remote but file is untracked in master.
- **Git**: master at `cbd34dc`, pushed to origin
- **Working tree**: clean except for untracked Cowork items:
  - `.claude/worktrees/`
  - `supabase/migrations/131_revoke_public_execute.sql`

## SESSION 102 — DEFERRED CARRY-FORWARD

1. Better Stack assertion swap (operator, ~30s)
2. Cowork branch merge — bring migration 131 + Vercel config into master under their authorship
3. KAH-2026-05-05 / AUD-V3-011 — regen Supabase types + clear `as any` casts (4 new from this session's RPCs)
4. KAH-2026-05-07 — Tap webhook IP allowlist + secret rotation policy
5. Audit migrations 125/129/130 for `migration repair` desync pattern
6. Delete dead `forgot-password/ForgotPasswordClient.tsx` + `set-password/SetPasswordClient.tsx`
7. AUD-V3-007 — next-intl@4.12 bump (low urgency)

---

## SESSION 100 — (previous)
> Session 100: auth vuln fixes — VULN-AUTH-04, VULN-AUTH-06, VULN-SEC-01
> Date: 2026-05-14
> Author: Claude Code (Opus 4.7)

## SESSION 100 — SUMMARY

Three auth/seed vulnerabilities closed. **Not committed** — changes
left in working tree alongside session-99 RBAC work (also uncommitted).
`npx tsc --noEmit` → exit 0.

### 1. VULN-AUTH-04 — forgot-password had no rate limit
Hoisted the flow off the direct client `supabase.auth.resetPasswordForEmail`
call and behind a new server action that enforces 3 req / 15 min per
IP via Upstash sliding-window (production-only, matching the existing
contact/reserve gate per [[feedback_rate_limit_node_env_gate]]).
Optional Cloudflare Turnstile wired in — soft-launch: verifies when
`TURNSTILE_SECRET_KEY` is set, falls through otherwise.

NEW: `src/app/[locale]/forgot-password/actions.ts`
MOD: `src/components/auth/ForgotPasswordForm.tsx` — calls server
action; renders Turnstile widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
is set.

### 2. VULN-AUTH-06 — set-password accepted any active session
ANY logged-in session could rotate the password, so a hijacked
normal-login session was equivalent to a reset link. Fix:
`/auth/callback` now sets a one-shot httpOnly `kah_recovery_flow`
cookie (10-min TTL) when `type=recovery`. The new set-password
server action treats that cookie as the only trusted recovery
marker — non-recovery sessions must supply `currentPassword` which
is re-verified via `signInWithPassword` before `updateUser` runs.
Cookie cleared on success; client signs out + bounces to /login.

Picked the cookie approach over JWT-amr decoding because
supabase-js doesn't expose `amr` on the User object, and decoding
the access token by hand would be fragile across SDK versions.
The cookie's trust boundary is in our own callback route — easy to
audit.

NEW: `src/app/[locale]/set-password/actions.ts` —
  `setPasswordAction` + `getRecoveryFlowState` helper.
MOD: `src/app/auth/callback/route.ts` — sets cookie on recovery.
MOD: `src/app/[locale]/set-password/page.tsx` — reads recovery
  state server-side; passes `isRecovery` to form.
MOD: `src/components/auth/SetPasswordForm.tsx` — accepts
  `isRecovery`, shows Current Password field when false, calls
  server action, signs out on success.

### 3. VULN-SEC-01 — clear-text dev passwords in seed migration
`supabase/migrations/006_seed_test_staff.sql` ships
`owner123`/`manager123`/`kitchen123`/`driver123`. Added a prominent
warning banner + a `DO $$ ... RAISE EXCEPTION` env-gate that aborts
the migration if `app.environment = 'production'`. File version is
unchanged (`006_`), so supabase-cli migration tracking is
unaffected for environments where it already ran.

### Translation keys added (en.json + ar.json)
- `auth.captchaRequired`
- `auth.currentPassword`
- `auth.currentPasswordPlaceholder`
- `auth.reauthFailed`

## FILES TOUCHED (Session 100)

NEW:
- `src/app/[locale]/forgot-password/actions.ts`
- `src/app/[locale]/set-password/actions.ts`

MODIFIED:
- `src/app/auth/callback/route.ts`
- `src/app/[locale]/set-password/page.tsx`
- `src/components/auth/ForgotPasswordForm.tsx`
- `src/components/auth/SetPasswordForm.tsx`
- `supabase/migrations/006_seed_test_staff.sql`
- `messages/en.json` + `messages/ar.json`

DEAD CODE LEFT ALONE (intentional):
- `src/app/[locale]/forgot-password/ForgotPasswordClient.tsx`
- `src/app/[locale]/set-password/SetPasswordClient.tsx`
Neither is imported anywhere. The live page.tsx files use the
`@/components/auth/{Forgot,Set}PasswordForm` variants. Worth
deleting in a future cleanup.

## NEXT ACTIONS

1. Review session-100 diffs and commit (separate from session-99
   RBAC + migration 134 work, which is also still uncommitted).
2. Add `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   to Vercel env so the forgot-password widget activates.
3. On production DB run:
   `ALTER DATABASE postgres SET app.environment = 'production';`
   so the 006 seed migration's new env-gate has the setting it
   checks. Without this, the gate is silent.
4. QA happy path: forgot-password → recovery link → callback sets
   cookie → set-password accepts new password without
   current-password prompt → signOut → login with new password.
5. QA non-recovery path: logged-in user visits /set-password,
   sees Current Password field, wrong password returns
   "Current password is incorrect", right password rotates and
   signs them out.
6. Consider deleting the two dead client files (above) — they
   duplicate the live forms and could mislead future auditors.

---

## SESSION 99 — SUMMARY

Four security fixes applied this session. **Not committed** — left in
working tree for review. tsc clean after each batch.

### 1. VULN-RBAC-01 — driver.branch_id null is invalid, not a wildcard
File: `src/app/[locale]/dashboard/delivery/actions.ts`
Both `assignDriverToOrder` (~L57) and `reassignDriver` (~L292) had:
```
if (driver.branch_id !== null && driver.branch_id !== order.branch_id) reject
```
A driver row with NULL branch_id slipped past the check and could be
assigned to any branch. Fixed by adding an explicit
`driver.branch_id === null` rejection ahead of the equality check.

### 2. VULN-RBAC-02 — branch_manager cannot complete another driver's delivery
File: `src/app/[locale]/driver/actions.ts:72-76`
`driverBumpOrder` bypassed the "assigned driver" check with
`!isManagerPlus(user.role)`, which let `branch_manager` close out a
delivery (collecting tip/cash) for an order assigned to someone else —
segregation-of-duties violation. Narrowed bypass to `!isGlobalAdmin`
(owner/general_manager only). branch_manager still has visibility from
the delivery dashboard but cannot complete other drivers' deliveries.

### 3. VULN-RBAC-04 — approveShift status-CAS
File: `src/app/[locale]/dashboard/shifts/actions.ts:approveShift`
Approve was a blind UPDATE with no status precondition. A double-click
or concurrent approval could overwrite an already-approved shift's
`approved_by` / `approved_at`. Added the same CAS pattern used in
`confirmDelivery` / `unassignDriver`: pre-fetch status, reject unless
`pending`, then UPDATE with `.eq('status','pending').select('id')` and
verify a row was returned.

### 4. VULN-104 — rpc_create_order payment_method priority inversion
File: `supabase/migrations/134_rpc_create_order_payment_method_priority.sql` (NEW)
The CASE in `rpc_create_order` checked `p_source='manual'` first, so a
manual+tap order jumped straight to `accepted` with no `expires_at`
and no `pending_payment` window — the Tap webhook reconciler had no
row to settle. New migration inverts the priority:

```
1. payment_method = 'tap'                              -> pending_payment
2. payment_method = 'cash' + source IN(manual/waiter/qr) -> accepted
3. source IN(manual,waiter,qr)                         -> accepted  (existing)
4. payment_method IN(benefit_pay, online)              -> pending_payment
5. else                                                -> new
```

Function body otherwise byte-identical to migration 091 (the latest
complete signature including promotion_id/table_number/modifiers).
No GRANT statements emitted — CREATE OR REPLACE preserves the ACL set
by migrations 091/131/132. Migration not yet applied to remote.

## FILES TOUCHED (Session 99)

- `src/app/[locale]/dashboard/delivery/actions.ts` (modified)
- `src/app/[locale]/driver/actions.ts` (modified)
- `src/app/[locale]/dashboard/shifts/actions.ts` (modified)
- `supabase/migrations/134_rpc_create_order_payment_method_priority.sql` (new)

## NEXT ACTIONS

1. Review the four diffs, then commit as a single security batch (or
   split RBAC vs migration into two commits).
2. Apply migration 134 to remote:
   `supabase db query -f supabase/migrations/134_rpc_create_order_payment_method_priority.sql`
   then `supabase migration repair --status applied 134`. Verify the
   new CASE is live by SELECTing `pg_get_functiondef('rpc_create_order'::regproc)`.
3. The working tree carried in a lot of Gemini-sibling work
   (messages/, several dashboard pages, auth flows, etc.) that is NOT
   part of session 99 — review separately before committing.

---

## SESSION 98 — (previous)

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
