-- ============================================================
-- Kahramana Baghdad — KDS canonical station taxonomy
-- Migration: 093_kds_station_taxonomy_enum_values.sql
-- Date: 2026-05-10
--
-- Adds new enum values required by the canonical 5-station model
-- (grill, fryer, cold, drinks, desserts) plus an explicit 'unassigned'
-- queue for menu items not yet mapped to a station.
--
-- Existing values (shawarma, bakery, appetizer_drinks, main, fry, salads,
-- packing) are retained for in-flight rows; new mappings in 094 route
-- everything to the canonical 5 or to 'unassigned' as a fail-closed default.
--
-- NOTE: ALTER TYPE ADD VALUE cannot be used in the same transaction as a
-- statement that references the new value. This migration only adds enum
-- values; the trigger/RPC changes that depend on them live in migration 094.
-- ============================================================

ALTER TYPE kds_station ADD VALUE IF NOT EXISTS 'fryer';
ALTER TYPE kds_station ADD VALUE IF NOT EXISTS 'cold';
ALTER TYPE kds_station ADD VALUE IF NOT EXISTS 'unassigned';

-- ============================================================
-- ROLLBACK: Postgres does not support removing enum values without recreating
-- the type. Leave new values in place; revert by simply not using them.
-- ============================================================
