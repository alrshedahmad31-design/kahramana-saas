# LAST-SESSION.md — Kahramana Baghdad
> Sessions 148 + 149 (one Claude Code conversation, two close-outs).
> 148 = PUB-007 extension on `rpc_create_order` + supabase_migrations
> registry backfill for 174/175. 149 = single hygiene lane bundling
> three items (BHD display drift, PUB-009 leftover, full types regen).
> All 9 gates green at HEAD. Bridge body upstream still references
> session 145 — Claude.ai owes a refresh.
> Date: 2026-05-18
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 148 — SUMMARY

User asked for "PUB-007: add proper SQLSTATE codes to all RPC error
returns." PUB-007 itself (rpc_create_reservation) had already shipped
in session 146 commit `5a57f9a` + migration 174. Scope question
surfaced before going wide: 437 `RAISE EXCEPTION` sites across 55
migration files vs. only 5 JS sites discriminating by
`message.includes()` — all in `checkout/actions.ts:723-735` for
rpc_create_order. User picked "Checkout RPC only (recommended)".

### Commits

| SHA | Item | Scope |
|-----|------|-------|
| `8f01b2f` | PUB-007 extension | Migration 179 + checkout/actions.ts |
| `814866b` | Session 148 close-out | Bridge timestamp + master pointer refresh |

### Key technical decisions

1. **One SQLSTATE per logical error class.** Migration 174 set the
   precedent of pinning every sentinel in the function, not just the
   caller-discriminated subset. Migration 179 follows: KH001 reused
   for AUTH_REQUIRED (so the code maps to the same caller meaning
   across RPCs), then KH015–KH021 for PRICE_MISMATCH / INVALID_TOTAL /
   COUPON_INVALID (5 internal branches) / PROMOTION_INVALID (8) /
   INSUFFICIENT_POINTS (4) / POINTS_OVER_CAP / INVALID_PAYMENT_MODE.
   Message text preserved verbatim so Sentry/log lines stay readable.

2. **Registry backfill via MCP execute_sql, not re-apply.**
   `list_migrations` revealed 174 + 175 were missing from
   `supabase_migrations.schema_migrations` despite being applied
   live (they had been run via direct SQL during session 146 without
   the registry insert). Backfilled both rows with the verbatim
   function bodies as `statements[0]` so fresh clones replay
   correctly. Functions themselves were not touched —
   `ON CONFLICT (version) DO NOTHING` for safety. Used version='174'
   / '175' to match the 001-171 numeric series convention.

3. **JS caller switched from include-chain to switch(error.code).**
   Five `rpcError.message.includes('...')` branches in
   `checkout/actions.ts:723-735` collapsed into a single
   `switch (rpcError.code)` block. Same error-string outputs
   downstream — `localizeCheckoutError` in CheckoutForm still
   discriminates by the lowercase code.

### Verification

All 9 gates green at HEAD (`814866b`). Gate 5 carried 14
pre-existing display-label hits unrelated to this commit — flagged
in the close-out summary as the source of session 149's lane.

---

## SESSION 149 — SUMMARY

Single hygiene lane, three bundled items, one commit.

### Commits

| SHA | Item | Scope |
|-----|------|-------|
| `5848f24` | Hygiene lane | 14 BHD display fixes + OrderWithItems alias removal + full types regen |
| `5152434` | Session 149 close-out | BACKLOG.md tooling entry + close-out marker |

### Item 1 — Gate 5 BHD drift (14 hits across 12 files)

Adopted the established `const bhd = isAr ? 'د.ب' : 'BHD'` pattern
(already in use by QRTableClient, WaiterOrdersClient, etc.):

- `MenuEngineeringMatrix.tsx` (in-ternary extraction)
- `inventory/stock/page.tsx` (server, bare BHD label)
- `shifts/page.tsx` + `CloseShiftDialog.tsx` (Translations interface
  gains `currency_symbol`; parent computes once, dialog consumes 3×)
- `menu/item/[slug]/page.tsx` (collapsed outer ternary, reuse bhd
  const; AR side preserved as "دينار بحريني" for metadata wording)
- `EditMenuItemDialog.tsx` + `MenuItemDialog.tsx` (price label)
- `MenuBrowser ItemCard` + `pos/ServiceModeClient ServiceItemTile`
  (aria-label)
- `ModifierPicker` (subtotal pill)
- `LoyaltySettings` ("Point value" label)
- `LoyaltyRedemptionWidget` (dropped redundant "BHD" word from JSDoc)

Gate 5 now returns 0. No rendered-text changes — same display in
both locales.

### Item 2 — PUB-009 leftover

`OrderWithItems` alias removed from `custom-types.ts:106-109`.
Session 146 commit `02f8ae2` swapped the `as unknown as
OrderWithItems` cast for a narrow inline row type at the /order/[id]
call site, orphaning the alias. Verified zero references via grep
before removal.

### Item 3 — Full types regen

`npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
picked up the schema additions from migrations 174-179. Required
two cleanups before TSC accepted the output:

1. **CRLF stripped.** PowerShell `>` redirect converted LF to CRLF.
   Normalized via `node -e fs.readFileSync().replace(/\r\n/g,'\n')`.

2. **CLI stdout pollution stripped.** Two non-TypeScript bands
   ended up in the file body because the CLI logs status to stdout,
   not stderr: line 1 `"Initialising login role..."` (preamble) and
   lines 5590-5591 `"A new version of Supabase CLI is available..."`
   (footer). Trimmed via node to the `export type Json` →
   `} as const` slice.

Net diff: adds `graphql_public` schema (was missing), function-level
additions `_menu_destructive_allowed` / `_menu_toggle_allowed` (from
migration 176), `rpc_after_auth_create_staff` family (177), and the
KH-class SQLSTATE-pinned signatures (174 reservation, 179
create_order). 225 inserts / 102 deletes in types.ts.

### Discovered tooling gap (added to BACKLOG.md)

Under new heading `## Session 149 — Tooling`:

> supabase gen types: wrap in a script that pipes through grep/sed
> to strip CLI stdout preamble+footer and forces LF endings —
> prevents types.ts pollution on every regen. Low priority, run
> before next full types regen.

### Key technical decisions

1. **Per-file `const bhd` over a shared helper.** Existing
   formatPrice in `src/lib/format.ts` uses `'BD'` not `'BHD'` —
   reusing it would have changed visual output across all 12
   surfaces. Introducing a new helper just for the label was more
   churn than the 12 one-line const declarations and matched the
   pattern already used in 8+ working files.

2. **CloseShiftDialog gets `currency_symbol` via translations
   object, not a new prop.** The dialog already takes a
   `translations` bag built by its server-component parent. Adding
   a `currency_symbol: string` field there kept the dialog signature
   stable and centralized the `isAr` derivation in the parent.

3. **Bridge body not refreshed locally.** Per `BRIDGE PROTOCOL`,
   Claude.ai owns the CURRENT-SESSION.md body. The local sync script
   only updates the Generated/Master pointer header. The body still
   reads "Updated: 2026-05-18 (session 145 close-out...)" — a manual
   Claude.ai update is owed to capture sessions 146-149.

### Verification

All 9 gates green at HEAD (`5152434`):

- Gate 1 tsc: clean
- Gate 2 RTL: 0
- Gate 3 fonts (word-boundary): 0
- Gate 4 colors: 0
- Gate 5 BHD: 0 (down from 14)
- Gate 6 phones: 0
- Gate 7 hex: 0
- Gate 8 i18n: AR=EN=2,548 keys, PASS
- Gate 9 build: clean

---

## STATE AT END OF SESSION

### Master HEAD
`5152434 docs(session): session 149 close-out`

### Migrations
Local = Remote = **179** applied. Sessions 148/149 added migration 179
(rpc_create_order SQLSTATE codes). Registry rows for 174 + 175
backfilled during session 148 via MCP `execute_sql` with full
function bodies — `supabase migration list --linked` should no longer
flag a gap.

### Pending DB rollout
None. Migration 179 applied via MCP `apply_migration` during
session 148, registered under timestamp `20260518125817` per the
project's MCP convention.

### What's next

- **Operator-side:** Unchanged from session 147 close-out. Supabase
  Pro + Singapore migration, Resend domain verify, 13 staff seed
  (full operator checklist surfaced in chat during session 149 —
  reproduced in the session-148 conversation if needed), TAP merchant
  keys, ~12 missing dish photos.

- **Dev-side:** Backlog has one new low-priority entry in
  `.agent/BACKLOG.md` under "Session 149 — Tooling" (supabase gen
  types wrapper script). Plus the older Session 111 entries that
  predate the launch sweep. No active lanes.

- **Bridge maintenance:** Claude.ai should refresh
  `CURRENT-SESSION.md` body upstream to cover sessions 146-149.
  The local sync script only refreshes the Generated/Master pointer
  header.

### Carry-forward
None for this lane. Both sessions closed cleanly with all gates
green and no deferred work.
