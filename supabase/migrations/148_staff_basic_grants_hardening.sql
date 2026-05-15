-- Migration 148 — H3: staff_basic grants hardening
--
-- AUDIT FINDING:
--   public.staff_basic is a TABLE (not a view) with RLS enabled and rich
--   policies scoped to {authenticated}. However, the default Supabase Data
--   API grants leave `anon` with full DML (SELECT/INSERT/UPDATE/DELETE/
--   TRUNCATE/REFERENCES/TRIGGER) on this internal staff table. RLS filters
--   anon rows to nothing today, but the grants are unnecessary attack
--   surface — any future policy regression would silently expose the staff
--   roster (ids, roles, branch_ids, names, is_active flags).
--
-- FIX:
--   1. REVOKE ALL FROM anon — anon has no legitimate need to touch this
--      table; staff context only ever runs as `authenticated`.
--   2. REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER FROM authenticated —
--      no DELETE policy exists, and the rest are admin-grade privileges
--      that don't belong on the runtime auth role. Keep SELECT/INSERT/
--      UPDATE which match the existing policies.
--
-- ROLLBACK:
--   GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
--     ON public.staff_basic TO anon, authenticated;

REVOKE ALL ON public.staff_basic FROM anon;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.staff_basic
  FROM authenticated;
