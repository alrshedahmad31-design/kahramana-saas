# LAST-SESSION.md — Kahramana Baghdad
> Session 146: Open-lane backlog sweep. 5 commits closing PUB-007,
> PUB-009, the menu-action CAS gap, the recipes atomic-replace gap,
> and BACKLOG.md hygiene. Two new migrations (174, 175). All TSC +
> build gates green after every code-bearing commit.
> Date: 2026-05-18
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 146 — SUMMARY

Open-lane execution — user supplied an ordered backlog (PUB-007 →
PUB-009 → dashboard RPC sweep → GHA Node 24 upgrade) with the
ground rule "one commit per item, propose migration SQL before
writing, TSC + build green after each commit." The dashboard sweep
turned into two commits after a site-by-site audit revealed the
listed 20-site count overstated the real CAS-needed work by ~14
(most listed sites were either already CAS-guarded or weren't
CAS-shaped at all). The Node 24 GHA item was already done in
pre-session commits — collapsed into a backlog-hygiene commit.

### Commits (in order)

| SHA | Item | Scope |
|-----|------|-------|
| `5a57f9a` | PUB-007 | Migration 174 — `rpc_create_reservation` SQLSTATE class KH (KH001–KH014). JS at `reserve/actions.ts:210` switches from `error.message.includes()` to `switch (error.code)`. |
| `02f8ae2` | PUB-009 | `OrderConfirmationRow` narrow type at `order/[id]/page.tsx`; `.returns<OrderConfirmationRow>()` replaces `as unknown as OrderWithItems` cast. `OrderTrackingStatus` prop narrowed to `TrackedOrder`. |
| `c0c7749` | Item 3a | CAS guards on 5 unguarded `menu/actions.ts` writes (`toggleMenuItemAvailability`, `updateMenuItem`, `deleteMenuOptionGroup`, `deleteMenuOption`, `deleteMenuItem`) via `.select('id').maybeSingle()` + not-found branch. |
| `f066d92` | Item 3b | Migration 175 — `rpc_replace_recipes(p_slug, p_rows, p_updated_by)` runs delete+insert atomically. `upsertRecipe` switches to the RPC. `types.ts` hand-augmented. |
| `ae006bd` | Item 4 + cleanup | BACKLOG.md removes the Node 24 GHA entry (closed by pre-session `b644a18` + `2999306`) plus PUB-007/009 entries closed this session. |

### Key technical decisions

1. **SQLSTATE class `KH`** introduced in migration 174 and reused in
   175. No Postgres-reserved class starts with K. Codes assigned:
   - KH001 = AUTH_REQUIRED, KH002 = FORBIDDEN_ROLE,
     KH003 = FORBIDDEN_BRANCH_SCOPE, KH004 = INVALID_GUEST_NAME,
     KH005 = INVALID_PHONE, KH006 = INVALID_PARTY_SIZE,
     KH007 = INVALID_DURATION, KH008 = INVALID_RESERVED_FOR,
     KH009 = INVALID_SOURCE, KH010 = INVALID_SEATING_TYPE,
     KH011 = TABLE_NOT_FOUND, KH012 = TABLE_BRANCH_MISMATCH,
     KH013 = TABLE_INACTIVE, KH014 = RESERVATION_CONFLICT,
     KH015 = INVALID_SLUG, KH016 = INVALID_ROWS.
   - Future RPC sentinel migrations should pick up at KH017.
2. **`.maybeSingle()` over `.single()` for CAS** — the existing
   coupons CAS pattern (`toggleCouponActive`, `toggleCouponPause`)
   uses `.single()` followed by `if (!updated)`, but PostgREST
   `.single()` returns `PGRST116` on 0 rows so the `!updated`
   branch is dead. Menu CAS in `c0c7749` uses `.maybeSingle()` so
   not-found lands cleanly in the `!updated` branch. Did NOT
   retrofit coupons in this session — out of scope.
3. **`OrderConfirmationRow` is page-local** — not added to
   `custom-types.ts`. Only `page.tsx` produces it; `TrackedOrder`
   in `OrderTrackingStatus.tsx` is structurally a subset, so the
   page→tracker handoff works via TS width-subtyping without a
   shared module.
4. **`rpc_replace_recipes` takes `p_updated_by UUID` from JS**
   (asked the user; they confirmed). Alternative would have been
   `auth.uid()` inside the SECURITY DEFINER body, but service-role
   calls collapse the operating user identity — JS-passed UUID
   preserves audit fidelity. Caller trust is fine since the server
   action has already permission-checked.
5. **`OrderWithItems` alias intentionally kept** in
   `custom-types.ts` after PUB-009 — nothing else uses it after
   this session, but removing it is a separate cleanup. Same
   narrow-commit discipline as PUB-007 leaving
   `rpc_update_reservation_status` alone.

### Item 3 audit detail (mismatch between user count and reality)

The user's prompt enumerated 20 sites across 6 files for the
"Dashboard RPC sweep" with migration required. Site-by-site audit:

| File | Listed | Real CAS-needed |
|------|--------|-----------------|
| `menu/actions.ts` | 8 | 5 (rest already CAS or not-CAS-shaped) |
| `staff/actions.ts` | 4 | 0 (`updateStaff` + `toggleStaffActive` already have full CAS pinning role/is_active/branch_id; `createStaff` / `createStaffFull` are auth+DB pairs with compensating deletes — not CAS-shaped; profile-update-after-insert has no race window) |
| `recipes/[slug]/actions.ts` | 4 | 0 — but **delete-then-insert atomicity bug** is the real issue, handled by migration 175 |
| `recipes/import/actions.ts` | 1 | 0 (bulk insert, audit insert already error-checked) |
| `coupons/actions.ts` | 2 | 0 (both toggles already CAS, modulo the `.single()` quirk above) |
| `pos/service/actions.ts` | 1 | 0 (audit insert already has `auditError` Sentry capture) |

Outcome: real work was 5 menu sites (commit 3a) + 1 atomic recipes
RPC (commit 3b). Backlog should not regrow these.

### Pending DB rollout

Two migrations need applying to the live DB before the related code
paths exercise them:
- **174** (`rpc_create_reservation` SQLSTATE codes) — public reserve
  flow will return `server_error` instead of `conflict` /
  `invalid_phone` / `invalid_party_size` until applied (code matches
  on `error.code === 'KHxxx'`, which the un-migrated RPC won't emit).
- **175** (`rpc_replace_recipes`) — `upsertRecipe` will fail with
  "function does not exist" until applied. Affects dashboard recipe
  editor only.

Rollout order doesn't matter (different surfaces).

### Verification

Phase gates 1 (TSC) + 9 (build) ran green after each code-bearing
commit. Did NOT run the full 9-gate suite this session — open-lane
work was small and surgical. Recommend running the full suite
before the next phase advance.

### What's next

- Apply migrations 174 + 175 in production.
- BACKLOG.md is now empty of closed items — only Session 111 entries
  remain. No live items.
- If the menu CAS pattern lands well, retrofit coupons toggles
  (`.single()` → `.maybeSingle()`) for consistency — 1-line cleanup,
  not currently in backlog.
- The "RPC-PENDING" comments in `staff/actions.ts` (createStaff,
  createStaffFull, profile update, toggleStaffActive) are still
  open — tracked there as P1-J follow-up. Requires
  `supabase.auth.admin` access from a SECURITY DEFINER body, not
  yet exposed. Not blocking.
