-- ============================================================
-- Kahramana Baghdad — Drop legacy UUID overloads of analytics RPCs
-- Migration: 097b_drop_legacy_uuid_overloads.sql
-- ============================================================
--
-- Migration 097's first pass (Gemini, 2026-05-10 session 87) declared
-- p_branch_id UUID. branches.branch_id is TEXT project-wide
-- (per migration 066_fix_branch_id_type), so the comparison would
-- silently fail. Migration 097 was rewritten with TEXT.
--
-- Postgres treats different signatures as distinct functions, so
-- CREATE OR REPLACE FUNCTION ... (TEXT) left the original UUID
-- overloads in place. This migration drops them so PostgREST resolves
-- to a single, correct overload.
--
-- Already applied to production via Supabase MCP on 2026-05-10 11:14:54.
-- This local file exists to keep file ↔ registry parity in git.

DROP FUNCTION IF EXISTS get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, UUID);

-- ROLLBACK
-- Re-creating the UUID overloads is not recommended (they were buggy).
-- If a rollback is needed, re-apply the original 097 file from the git
-- history at commit pre-097-fix.
