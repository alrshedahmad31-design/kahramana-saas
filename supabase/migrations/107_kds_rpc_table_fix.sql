-- Migration 107: RPC Table Name Fix
-- Correcting 'staff' to 'staff_basic' in KDS RPC functions.

-- 1. update_order_item_station_status
CREATE OR REPLACE FUNCTION update_order_item_station_status(
  p_order_id        UUID,
  p_item_id         UUID,
  p_station         TEXT,
  p_status          TEXT,
  p_expected_status TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_branch_id TEXT;
  v_caller_branch_id TEXT;
BEGIN
  -- FIX: Changed 'staff' to 'staff_basic'
  v_caller_branch_id := (SELECT branch_id FROM staff_basic WHERE id = auth.uid());
  
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = p_order_id;
  
  IF v_branch_id IS DISTINCT FROM v_caller_branch_id AND v_caller_branch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE order_item_station_status
  SET status = p_status::kds_item_status
  WHERE item_id = p_item_id
    AND station::text = p_station
    AND (p_expected_status IS NULL OR status::text = p_expected_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. bump_station_order
CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station  TEXT
) RETURNS void AS $$
DECLARE
  v_branch_id TEXT;
  v_caller_branch_id TEXT;
BEGIN
  -- FIX: Changed 'staff' to 'staff_basic'
  v_caller_branch_id := (SELECT branch_id FROM staff_basic WHERE id = auth.uid());
  
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = p_order_id;
  
  IF v_branch_id IS DISTINCT FROM v_caller_branch_id AND v_caller_branch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Branch mismatch';
  END IF;

  UPDATE order_item_station_status
  SET status = 'completed', bumped_at = NOW()
  WHERE order_id = p_order_id
    AND station::text = p_station
    AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. recall_station_order
CREATE OR REPLACE FUNCTION recall_station_order(
  p_order_id UUID,
  p_station  TEXT
) RETURNS void AS $$
DECLARE
  v_branch_id TEXT;
  v_caller_branch_id TEXT;
BEGIN
  -- FIX: Changed 'staff' to 'staff_basic'
  v_caller_branch_id := (SELECT branch_id FROM staff_basic WHERE id = auth.uid());
  
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = p_order_id;
  
  IF v_branch_id IS DISTINCT FROM v_caller_branch_id AND v_caller_branch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE order_item_station_status
  SET status = 'ready', bumped_at = NULL
  WHERE order_id = p_order_id
    AND station::text = p_station
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
