-- ============================================================
-- Kahramana Baghdad — Schedule RLS and RPC hardening
-- Migration: 047_schedule_rls_hardening.sql
-- Date: 2026-05-05
-- ============================================================

-- ── Schedule RLS: branch-scoped manager access ────────────────────────────────

DROP POLICY IF EXISTS "managers_all_shifts" ON shifts;
DROP POLICY IF EXISTS "shifts_branch_scoped" ON shifts;
CREATE POLICY "shifts_branch_scoped"
  ON shifts FOR ALL TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager','cashier','inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager','cashier','inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "managers_all_entries" ON time_entries;
DROP POLICY IF EXISTS "time_entries_branch_scoped" ON time_entries;
CREATE POLICY "time_entries_branch_scoped"
  ON time_entries FOR ALL TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = time_entries.staff_id
        AND s.branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager')
    OR EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = time_entries.staff_id
        AND s.branch_id = auth_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "managers_all_leaves" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_branch_scoped" ON leave_requests;
CREATE POLICY "leave_requests_branch_scoped"
  ON leave_requests FOR ALL TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = leave_requests.staff_id
        AND s.branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager')
    OR EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = leave_requests.staff_id
        AND s.branch_id = auth_user_branch_id()
    )
  );

-- ── SECURITY DEFINER RPCs: service-role only ─────────────────────────────────

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname LIKE 'rpc_%'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname,
      fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      fn.proname,
      fn.args
    );
  END LOOP;
END $$;
