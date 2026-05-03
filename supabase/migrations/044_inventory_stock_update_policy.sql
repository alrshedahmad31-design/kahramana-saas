-- ============================================================
-- Kahramana Baghdad — Tighten inventory_stock UPDATE policy
-- Migration: 044_inventory_stock_update_policy.sql
-- Date: 2026-05-04
-- Fix: I6 — old policy was USING (true), allowing any authenticated
-- user to UPDATE any stock row directly. Restrict to managers/owners
-- scoped to their own branch.
-- Note: SECURITY DEFINER RPCs (rpc_transfer_stock, etc.) bypass RLS
-- and are unaffected — this only blocks raw client UPDATE calls.
-- ============================================================

DROP POLICY IF EXISTS "stock_update_authenticated" ON inventory_stock;

CREATE POLICY "stock_update_managers_only"
  ON inventory_stock FOR UPDATE TO authenticated
  USING (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  );
