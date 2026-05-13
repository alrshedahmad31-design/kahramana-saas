-- ============================================================
-- Kahramana Baghdad — customers anon INSERT shape guard
-- Migration: 121_customers_insert_guard.sql
-- Date: 2026-05-13
--
-- BL-004 low-severity follow-up. customers_insert_anon previously had
-- WITH CHECK (true), letting any anonymous caller insert arbitrary
-- customers rows (e.g. blank or junk-shaped name/phone) via direct
-- PostgREST. The legitimate guest-checkout path uses rpc_create_order
-- (SECURITY DEFINER, bypasses RLS), so tightening this policy only
-- affects abuse vectors, not real traffic.
--
-- The new predicate also rejects NULL name / NULL phone (char_length
-- on NULL returns NULL, which is treated as false by WITH CHECK).
-- That is an intended side-effect — anonymous inserts must carry
-- both fields with a sensible shape.
-- ============================================================

DROP POLICY IF EXISTS "customers_insert_anon" ON customers;

CREATE POLICY "customers_insert_anon"
  ON customers FOR INSERT TO anon
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 120
    AND phone ~ '^\+?[0-9\s\-()]{7,30}$'
  );

-- ============================================================
-- ROLLBACK:
--   DROP POLICY IF EXISTS "customers_insert_anon" ON customers;
--   CREATE POLICY "customers_insert_anon"
--     ON customers FOR INSERT TO anon WITH CHECK (true);
-- ============================================================
