-- ============================================================
-- Kahramana Baghdad — Fix AUD-003: RLS Privilege Escalation
-- Migration: 003_rls_staff_fix.sql
-- Applied: 2026-04-28
-- Issue: staff_basic policies used USING (true) — any authenticated
--        user could SELECT/UPDATE/DELETE all staff records across all branches.
-- Fix: Replace with branch-aware, role-aware policies.
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── Helper functions ──────────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS on the underlying table, preventing infinite
-- recursion when policies on staff_basic call back into staff_basic.
-- SET search_path = public prevents search_path injection attacks.

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS staff_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM staff_basic WHERE id = auth.uid() AND is_active = TRUE
$$;

CREATE OR REPLACE FUNCTION auth_user_branch_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM staff_basic WHERE id = auth.uid() AND is_active = TRUE
$$;

-- ── Drop old permissive policies (AUD-003 root cause) ────────────────────────

DROP POLICY IF EXISTS "staff_select_authenticated" ON staff_basic;
DROP POLICY IF EXISTS "staff_write_authenticated"  ON staff_basic;

-- ── SELECT policies ───────────────────────────────────────────────────────────

-- Every active staff member can always see their own record.
CREATE POLICY "staff_select_own"
  ON staff_basic FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Branch managers see their branch team (not their own record — covered above).
CREATE POLICY "staff_select_branch_team"
  ON staff_basic FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'branch_manager'
    AND id != auth.uid()
    AND branch_id = auth_user_branch_id()
  );

-- Owner and GM have global scope (branch_id IS NULL = all branches).
CREATE POLICY "staff_select_global_admin"
  ON staff_basic FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
  );

-- ── INSERT policies ───────────────────────────────────────────────────────────

-- Owner and GM can create staff anywhere.
CREATE POLICY "staff_insert_global_admin"
  ON staff_basic FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() IN ('owner', 'general_manager')
  );

-- Branch managers can create non-manager staff in their own branch only.
CREATE POLICY "staff_insert_branch_manager"
  ON staff_basic FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() = 'branch_manager'
    AND branch_id = auth_user_branch_id()
    AND role NOT IN ('owner', 'general_manager', 'branch_manager')
  );

-- ── UPDATE policies ───────────────────────────────────────────────────────────

-- Any staff member can update their own record (name, etc.) but CANNOT
-- change their own role or branch_id. This prevents self-promotion.
-- NOTE: role = auth_user_role() ensures the new role = current role (no change).
-- NOTE: IS NOT DISTINCT FROM handles NULL branch_id correctly.
CREATE POLICY "staff_update_own_info"
  ON staff_basic FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    role = auth_user_role()
    AND (branch_id IS NOT DISTINCT FROM auth_user_branch_id())
  );

-- Owner can update any non-owner staff record.
-- Owners cannot demote other owners — only service_role (admin API) can change owner status.
-- Owners cannot promote others to owner — that requires service_role as well.
CREATE POLICY "staff_update_owner_manage"
  ON staff_basic FOR UPDATE TO authenticated
  USING (
    auth_user_role() = 'owner'
    AND id != auth.uid()
    AND role != 'owner'
  )
  WITH CHECK (
    role != 'owner'
  );

-- GM can update any non-owner, non-GM staff record.
-- Cannot grant global access (branch_id must remain non-null).
-- Cannot self-modify role — covered by staff_update_own_info.
CREATE POLICY "staff_update_gm_manage"
  ON staff_basic FOR UPDATE TO authenticated
  USING (
    auth_user_role() = 'general_manager'
    AND id != auth.uid()
    AND role NOT IN ('owner', 'general_manager')
  )
  WITH CHECK (
    role NOT IN ('owner', 'general_manager')
    AND branch_id IS NOT NULL
  );

-- Branch manager can update non-manager staff within their own branch.
-- Cannot elevate to manager+, cannot move staff to another branch.
CREATE POLICY "staff_update_branch_manager_manage"
  ON staff_basic FOR UPDATE TO authenticated
  USING (
    auth_user_role() = 'branch_manager'
    AND id != auth.uid()
    AND branch_id = auth_user_branch_id()
    AND role NOT IN ('owner', 'general_manager', 'branch_manager')
  )
  WITH CHECK (
    role NOT IN ('owner', 'general_manager', 'branch_manager')
    AND branch_id = auth_user_branch_id()
  );

-- ── No DELETE policy ──────────────────────────────────────────────────────────
-- Staff records are never deleted via the application layer.
-- Deactivate via UPDATE SET is_active = FALSE instead.
-- Physical deletion (if ever needed) requires service_role (admin API only).

-- ── Indexes for RLS policy performance ───────────────────────────────────────

-- idx_staff_branch already exists from migration 001.
-- Partial index for active staff — accelerates auth_user_role() and auth_user_branch_id():
CREATE INDEX IF NOT EXISTS idx_staff_active_id
  ON staff_basic(id) WHERE is_active = TRUE;

-- Composite partial index for branch + role lookups in policies:
CREATE INDEX IF NOT EXISTS idx_staff_active_branch_role
  ON staff_basic(branch_id, role) WHERE is_active = TRUE;

-- ============================================================
-- ROLLBACK:
--
-- DROP POLICY IF EXISTS "staff_select_own"                   ON staff_basic;
-- DROP POLICY IF EXISTS "staff_select_branch_team"           ON staff_basic;
-- DROP POLICY IF EXISTS "staff_select_global_admin"          ON staff_basic;
-- DROP POLICY IF EXISTS "staff_insert_global_admin"          ON staff_basic;
-- DROP POLICY IF EXISTS "staff_insert_branch_manager"        ON staff_basic;
-- DROP POLICY IF EXISTS "staff_update_own_info"              ON staff_basic;
-- DROP POLICY IF EXISTS "staff_update_owner_manage"          ON staff_basic;
-- DROP POLICY IF EXISTS "staff_update_gm_manage"             ON staff_basic;
-- DROP POLICY IF EXISTS "staff_update_branch_manager_manage" ON staff_basic;
-- DROP INDEX IF EXISTS idx_staff_active_id;
-- DROP INDEX IF EXISTS idx_staff_active_branch_role;
-- DROP FUNCTION IF EXISTS auth_user_role();
-- DROP FUNCTION IF EXISTS auth_user_branch_id();
--
-- Restore original (vulnerable) policies:
-- CREATE POLICY "staff_select_authenticated"
--   ON staff_basic FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "staff_write_authenticated"
--   ON staff_basic FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- ============================================================
