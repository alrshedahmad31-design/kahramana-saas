-- ============================================================
-- Kahramana Baghdad
-- Migration: 152_customer_birthday.sql
--
-- Adds an optional `birthday` column to customer_profiles. Used by:
--   - Account page UI: capture date of birth
--   - Account page card: "Your birthday gift in N days" countdown
--   - (Future) pg_cron job that credits bonus points each birthday
--
-- This migration is intentionally schema-only. The points-credit cron
-- and gift mechanic land in a later migration once that spec is settled.
--
-- CHECK constraint guards against:
--   - Future birthdays (typo / data entry)
--   - Dates before 1900 (typo)
--   - Naked time component (DATE only, no timestamp)
--
-- Partial index on birthday: the future cron needs to scan only
-- profiles with a birthday set, which is expected to be a minority
-- of rows for the foreseeable future.
-- ============================================================

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Drop+recreate the CHECK so re-running the migration is idempotent
-- without erroring on the existing constraint.
ALTER TABLE public.customer_profiles
  DROP CONSTRAINT IF EXISTS customer_profiles_birthday_range_chk;

ALTER TABLE public.customer_profiles
  ADD CONSTRAINT customer_profiles_birthday_range_chk
  CHECK (
    birthday IS NULL
    OR (birthday >= DATE '1900-01-01' AND birthday <= CURRENT_DATE)
  );

CREATE INDEX IF NOT EXISTS idx_customer_profiles_birthday
  ON public.customer_profiles (birthday)
  WHERE birthday IS NOT NULL;

-- ── Rollback (manual) ────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS public.idx_customer_profiles_birthday;
-- ALTER TABLE public.customer_profiles
--   DROP CONSTRAINT IF EXISTS customer_profiles_birthday_range_chk;
-- ALTER TABLE public.customer_profiles
--   DROP COLUMN IF EXISTS birthday;
