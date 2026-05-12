# Supabase Migration State

**Production project:** `kahramana-prod` (`wwmzuofstyzworukfxkt`, ap-northeast-1, Postgres 17.6)
**Last verified:** 2026-05-12, directly against the live `schema_migrations` table via Supabase MCP `list_migrations`.

## Current status

**Production is at version `113`.** All numbered migrations on disk are applied. Both timestamp migrations are applied.

```
001 – 044            ✓ applied
(gap: 045 — never created, also missing locally)
046 – 095            ✓ applied
(gap: 096 — never created, also missing locally)
097 – 113            ✓ applied
20260505190424_add_driver_push_subscriptions  ✓ applied
20260508120000_delivery_city_and_kds_fix      ✓ applied
```

## Last batch applied (out-of-session)

Between 2026-05-09 and 2026-05-12, migrations `092` → `113` were applied to production (most likely via `supabase db push` from the sibling Gemini agent or a direct deploy; this Claude Code session was not the applier). Headline changes that batch introduced:

| Range | What changed |
|---|---|
| 092, 095 | RLS tightening on `shift_closings` and `orders` UPDATE paths |
| 093, 094, 100–113 | KDS station taxonomy redesign: new enum values (`mains`, `pizza`, `cold`, `grill`, `shawarma`, `unassigned`), routing trigger rewrite, RLS hardening, recall RPC, all-day counter, multiple backfills mapping the 13 legacy stations onto the new 5-station model |
| 097, 098 | Labor + Menu Engineering analytics RPCs (with TEXT branch ID; UUID overload dropped) |
| 099 | `waitlist_entries` table for table-management waitlist |
| 104 + 108 | `bump_station_order` now takes `(UUID, TEXT)` only — kds_station overload dropped; uses `staff_basic` (not `staff`) |

## Standing rules

- **NEVER** run `supabase db push --include-all` on prod — causes duplicate key on `schema_migrations_pkey`.
- `branches.id` is **TEXT**, not UUID. Any FK or RPC arg referencing it must use TEXT.
- PostgreSQL requires `DROP VIEW IF EXISTS` before `CREATE VIEW` when column names change (`CREATE OR REPLACE` cannot rename columns).
- After applying a migration outside `supabase db push` (e.g. via the SQL editor or MCP `apply_migration`), register it manually in `schema_migrations` so future `db push` doesn't re-run it.
- Supabase realtime filters only support direct-column equality — denormalise (e.g. `branch_id` on `order_item_station_status` from mig 089) when scoping is needed.
- Migration numbering gaps (045, 096) are expected, not missing files.

## How to verify state

```ts
// Via Supabase MCP from any Claude Code session
mcp__plugin_supabase_supabase__list_migrations({ project_id: 'wwmzuofstyzworukfxkt' })
```

Update this file whenever a new batch of migrations is applied.
