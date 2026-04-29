-- ============================================================
-- Kahramana Baghdad — Audit Logs: Branch Columns + RLS
-- Migration: 004_audit_logs_rls.sql
-- Applied: 2026-04-28
-- Depends on: 003_rls_staff_fix.sql (auth_user_role, auth_user_branch_id)
-- Issue: audit_logs had no RLS policies — service_role-only via comment
--        intention. Now we expose read access to staff with proper scoping,
--        and allow authenticated users to write their own audit entries.
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── Add context columns ───────────────────────────────────────────────────────

-- branch_id: which branch the action affected (NULL = cross-branch / global)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS branch_id   TEXT        REFERENCES branches(id);

-- actor_role: role of the user at the time of the action (denormalised for
--             read performance — avoids joining staff_basic on every SELECT)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_role  staff_role;

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Support branch-scoped queries from branch managers and the KDS
CREATE INDEX IF NOT EXISTS idx_audit_branch_id
  ON audit_logs(branch_id) WHERE branch_id IS NOT NULL;

-- Support per-user audit history
CREATE INDEX IF NOT EXISTS idx_audit_user_id
  ON audit_logs(user_id) WHERE user_id IS NOT NULL;

-- Support chronological queries within a branch
CREATE INDEX IF NOT EXISTS idx_audit_branch_created
  ON audit_logs(branch_id, created_at DESC) WHERE branch_id IS NOT NULL;

-- ── SELECT policies ───────────────────────────────────────────────────────────

-- Any active staff member can read their own audit entries.
CREATE POLICY "audit_select_own"
  ON audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Branch managers can read all audit entries that happened in their branch.
-- This includes actions by other staff members in that branch.
CREATE POLICY "audit_select_branch_manager"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'branch_manager'
    AND branch_id = auth_user_branch_id()
  );

-- Owner and GM have full read access across all branches.
CREATE POLICY "audit_select_global_admin"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
  );

-- ── INSERT policy ─────────────────────────────────────────────────────────────

-- Active authenticated staff can insert audit entries for their own actions.
-- The WITH CHECK ensures user_id must equal the calling user's uid — no
-- impersonation. actor_role must match the caller's actual role.
-- branch_id must match the caller's branch (or be NULL for global admins).
CREATE POLICY "audit_insert_own_actions"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND actor_role = auth_user_role()
    AND (
      branch_id IS NULL
      OR branch_id = auth_user_branch_id()
      OR auth_user_role() IN ('owner', 'general_manager')
    )
  );

-- ── No UPDATE / DELETE policies ───────────────────────────────────────────────
-- Audit logs are immutable. Physical deletion requires service_role (admin API).
-- UPDATE is intentionally omitted — any attempted UPDATE will be denied by RLS.

-- ============================================================
-- ROLLBACK:
--
-- DROP POLICY IF EXISTS "audit_select_own"             ON audit_logs;
-- DROP POLICY IF EXISTS "audit_select_branch_manager"  ON audit_logs;
-- DROP POLICY IF EXISTS "audit_select_global_admin"    ON audit_logs;
-- DROP POLICY IF EXISTS "audit_insert_own_actions"     ON audit_logs;
-- DROP INDEX IF EXISTS idx_audit_branch_id;
-- DROP INDEX IF EXISTS idx_audit_user_id;
-- DROP INDEX IF EXISTS idx_audit_branch_created;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS branch_id;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS actor_role;
-- ============================================================
