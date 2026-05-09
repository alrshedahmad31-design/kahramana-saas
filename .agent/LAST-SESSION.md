# LAST-SESSION.md — Kahramana Baghdad

> **Session**: 83 (Claude Code track)
> **Date**: 2026-05-09
> **Focus**: Waiter dine-in QA retest (steps 6–8) codified as Playwright spec; verified migration 091 unblocked PRICE_MISMATCH end-to-end.

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
