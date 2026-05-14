-- ============================================================
-- Kahramana Baghdad
-- Migration: 136_app_config.sql
--
-- VULN-SEC-01 Path B: replace the cluster-GUC env-gate from
-- migration 006 with a table-driven flag.
--
-- Background: the original 006 used `current_setting('app.environment', true)`
-- to decide whether to abort the seed in production. Supabase managed strips
-- superuser from the `postgres` role, so `ALTER DATABASE postgres SET
-- app.environment = 'production'` returns `42501 permission denied` in both
-- the CLI session and the Studio SQL Editor. Without that ALTER, the GUC is
-- unset, `current_setting(..., true)` returns NULL, and the gate is silent.
--
-- Fix: a small key/value table that the seed migration reads instead. Any
-- role with table-owner privileges (the Studio `postgres` role qualifies)
-- can INSERT the production flag — no superuser required.
--
-- Operator action required AFTER this migration is applied to prod
-- (single INSERT, run from Studio):
--
--   INSERT INTO public.app_config (key, value)
--   VALUES ('environment', 'production')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- Without that row, 006's gate remains permissive (matches the prior
-- behaviour when the GUC was unset). The banner + reviewer-grep marker
-- still trip a careful human; the row activates the runtime gate.
--
-- ROLLBACK:
--   DROP TABLE public.app_config;
--   (006's exception handler swallows undefined_table and falls through.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_config IS
  'Operator-managed runtime flags. The (environment=production) row is the trip wire for the 006_seed_test_staff env-gate. Owner-write only; staff-read via RLS.';

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Read: dashboard staff only. Anon and authenticated customers must not see
-- which environment this is, what flags are active, etc.
DROP POLICY IF EXISTS "app_config staff read" ON public.app_config;
CREATE POLICY "app_config staff read"
  ON public.app_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.staff_basic
      WHERE  id        = auth.uid()
        AND  role      IN ('owner', 'general_manager', 'branch_manager')
        AND  is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policy → only the table owner (postgres) and
-- service_role (bypasses RLS) can write. Studio runs as postgres → can
-- INSERT the production flag from the SQL Editor without superuser.

REVOKE ALL ON public.app_config FROM PUBLIC;
REVOKE ALL ON public.app_config FROM anon, authenticated;

-- authenticated gets SELECT GRANT so the RLS policy is reachable for staff.
-- The policy itself filters out non-staff rows (i.e., everything for anyone
-- whose JWT isn't tied to an active manager+ staff_basic row).
GRANT SELECT ON public.app_config TO authenticated;

-- service_role + postgres retain implicit ALL via Supabase's defaults.
