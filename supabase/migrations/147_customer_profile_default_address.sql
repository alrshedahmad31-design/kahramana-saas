-- 147_customer_profile_default_address.sql
--
-- Adds optional default-address columns to customer_profiles so authenticated
-- customers can pre-fill checkout from their last saved delivery address.
-- Mirrors the column-level UPDATE grant pattern from migration 064 so the
-- anon/authenticated client can write only these specific columns.
--
-- ROLLBACK:
--   ALTER TABLE public.customer_profiles
--     DROP COLUMN IF EXISTS default_block,
--     DROP COLUMN IF EXISTS default_road,
--     DROP COLUMN IF EXISTS default_building,
--     DROP COLUMN IF EXISTS default_flat,
--     DROP COLUMN IF EXISTS default_area,
--     DROP COLUMN IF EXISTS default_lat,
--     DROP COLUMN IF EXISTS default_lng;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS default_block    TEXT,
  ADD COLUMN IF NOT EXISTS default_road     TEXT,
  ADD COLUMN IF NOT EXISTS default_building TEXT,
  ADD COLUMN IF NOT EXISTS default_flat     TEXT,
  ADD COLUMN IF NOT EXISTS default_area     TEXT,
  ADD COLUMN IF NOT EXISTS default_lat      NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS default_lng      NUMERIC(10,7);

-- Column-level grant — authenticated customers may update ONLY the address
-- defaults plus the existing name/email/phone surface (migration 064 RLS).
GRANT UPDATE (
  default_block, default_road, default_building,
  default_flat, default_area, default_lat, default_lng
) ON public.customer_profiles TO authenticated;
