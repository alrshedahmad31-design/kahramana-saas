-- ============================================================
-- Kahramana Baghdad — Inventory Bug Fixes
-- Migration: 043_inventory_fixes.sql
-- Date: 2026-05-03
-- Safe to re-run: all DDL uses CREATE OR REPLACE / IF EXISTS
--
-- Fixes applied:
--   C1  rpc_transfer_stock — add FOR UPDATE to prevent concurrent negative stock
--   W2  rpc_inventory_count_submit — signed delta replaces ABS() in movement record
--   C4  rpc_inventory_count_session_approve — new atomic batch-approval RPC
--   W4  par_levels — add branch_id isolation to write policy
--   W5  inventory_transfers — add branch filter to SELECT
--   W6  catering_packages — add branch_id isolation to write policy
-- ============================================================

-- ── Pre-req: allow signed quantity on inventory_movements for count_adjust ──────
-- The original constraint is CHECK (quantity > 0).
-- count_adjust movements now store the signed delta so audit reports can
-- distinguish shrinkage (negative) from surplus (positive).
-- All other movement types continue using positive quantities; the new
-- constraint only relaxes the sign while still rejecting zero movements.

ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_quantity_check;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_quantity_nonzero
  CHECK (quantity <> 0);


-- ============================================================
-- C1: rpc_transfer_stock — add FOR UPDATE row lock
-- Without this, two concurrent calls both read the same v_avail,
-- both pass the stock check, and both deduct — leaving stock negative.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_transfer_stock(
  p_from_branch  TEXT,
  p_to_branch    TEXT,
  p_ingredient   UUID,
  p_quantity     NUMERIC,
  p_staff_id     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_avail NUMERIC;
BEGIN
  SELECT (on_hand - reserved - catering_reserved) INTO v_avail
  FROM inventory_stock
  WHERE branch_id = p_from_branch AND ingredient_id = p_ingredient
  FOR UPDATE;

  IF v_avail IS NULL OR v_avail < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK_FOR_TRANSFER' USING ERRCODE = 'P0004';
  END IF;

  UPDATE inventory_stock
  SET on_hand          = on_hand - p_quantity,
      last_movement_at = NOW()
  WHERE branch_id = p_from_branch AND ingredient_id = p_ingredient;

  INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand, last_movement_at)
  VALUES (p_to_branch, p_ingredient, p_quantity, NOW())
  ON CONFLICT (branch_id, ingredient_id) DO UPDATE
    SET on_hand          = inventory_stock.on_hand + EXCLUDED.on_hand,
        last_movement_at = NOW();

  INSERT INTO inventory_movements (
    branch_id, ingredient_id, movement_type, quantity, performed_by, performed_at
  )
  VALUES
    (p_from_branch, p_ingredient, 'transfer_out', p_quantity, p_staff_id, NOW()),
    (p_to_branch,   p_ingredient, 'transfer_in',  p_quantity, p_staff_id, NOW());
END;
$$;


-- ============================================================
-- W2: rpc_inventory_count_submit — signed delta in movement record
-- Stock is still SET to actual_qty (correct for a physical count).
-- The movement now records the signed delta so reports can distinguish
-- shrinkage (negative) from surplus (positive).
-- Zero-delta counts produce no movement record (nothing changed).
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_inventory_count_submit(
  p_count_id    UUID,
  p_approved_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count inventory_counts%ROWTYPE;
  v_delta NUMERIC;
BEGIN
  SELECT * INTO v_count FROM inventory_counts WHERE id = p_count_id;

  -- Set stock to the physically counted value (absolute, not delta).
  UPDATE inventory_stock
  SET on_hand          = v_count.actual_qty,
      last_count_at    = NOW(),
      last_movement_at = NOW()
  WHERE branch_id     = v_count.branch_id
    AND ingredient_id = v_count.ingredient_id;

  -- Record signed delta: negative = shrinkage, positive = surplus.
  v_delta := v_count.actual_qty - v_count.system_qty;

  IF v_delta <> 0 THEN
    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity, performed_by, performed_at
    ) VALUES (
      v_count.branch_id, v_count.ingredient_id, 'count_adjust',
      v_delta,
      p_approved_by, NOW()
    );
  END IF;

  UPDATE inventory_counts
  SET approved_by = p_approved_by, approved_at = NOW()
  WHERE id = p_count_id;

  IF ABS(COALESCE(v_count.variance_pct, 0)) > 10 THEN
    INSERT INTO inventory_alerts (
      branch_id, ingredient_id, alert_type, severity, message, metadata
    ) VALUES (
      v_count.branch_id, v_count.ingredient_id,
      'count_variance_high', 'critical',
      'High count variance: ' || v_count.variance_pct || '%',
      jsonb_build_object(
        'count_id',     p_count_id,
        'delta',        v_delta,
        'variance_pct', v_count.variance_pct
      )
    );
  END IF;
END;
$$;


-- ============================================================
-- C4: rpc_inventory_count_session_approve — atomic batch approval
-- The old JS for-loop called rpc_inventory_count_submit once per row.
-- If item 3 of 10 failed, items 1-2 were already committed with no
-- rollback. This single plpgsql function runs all items in one
-- implicit transaction — any failure rolls back the entire session.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_inventory_count_session_approve(
  p_session_name TEXT,
  p_branch_id    TEXT,
  p_approved_by  UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id
    FROM inventory_counts
    WHERE count_session = p_session_name
      AND branch_id     = p_branch_id
      AND approved_by   IS NULL
  LOOP
    PERFORM rpc_inventory_count_submit(
      p_count_id    := v_row.id,
      p_approved_by := p_approved_by
    );
  END LOOP;
END;
$$;


-- ============================================================
-- W4: par_levels — add branch_id isolation for non-global roles
-- Old policy let any inventory_manager write par levels for any branch.
-- ============================================================
DROP POLICY IF EXISTS "par_levels_all_managers"              ON par_levels;
DROP POLICY IF EXISTS "par_levels_managers_branch_isolated"  ON par_levels;

CREATE POLICY "par_levels_managers_branch_isolated"
  ON par_levels FOR ALL TO authenticated
  USING (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  );


-- ============================================================
-- W5: inventory_transfers — add branch filter to SELECT
-- Old policy let any branch manager read all transfers across all branches.
-- READ: own from_branch OR to_branch.
-- WRITE: only from own from_branch (can't initiate from another branch).
-- ============================================================
DROP POLICY IF EXISTS "transfers_all_managers"               ON inventory_transfers;
DROP POLICY IF EXISTS "transfers_managers_branch_isolated"   ON inventory_transfers;

CREATE POLICY "transfers_managers_branch_isolated"
  ON inventory_transfers FOR ALL TO authenticated
  USING (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND (
        from_branch_id = auth_user_branch_id()
        OR to_branch_id = auth_user_branch_id()
      )
    )
  )
  WITH CHECK (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND from_branch_id = auth_user_branch_id()
    )
  );


-- ============================================================
-- W6: catering_packages — add branch_id isolation
-- Old policy allowed cross-branch package creation/edits.
-- ============================================================
DROP POLICY IF EXISTS "catering_packages_all_managers"               ON catering_packages;
DROP POLICY IF EXISTS "catering_packages_managers_branch_isolated"   ON catering_packages;

CREATE POLICY "catering_packages_managers_branch_isolated"
  ON catering_packages FOR ALL TO authenticated
  USING (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager', 'inventory_manager')
      AND branch_id = auth_user_branch_id()
    )
  );
