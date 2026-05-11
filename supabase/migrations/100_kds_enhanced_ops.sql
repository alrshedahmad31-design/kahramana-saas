-- ============================================================
-- Kahramana Baghdad — KDS Enhancements
-- Migration: 100_kds_enhanced_ops.sql
-- Date: 2026-05-11
--
-- Features:
--   1. Recall last bumped order (60s safety window)
--   2. All-day persistent counter per station/branch
--   3. GRANT EXECUTE for new RPCs
-- ============================================================

-- Add bumped_at column to track exact completion time
ALTER TABLE order_item_station_status
  ADD COLUMN IF NOT EXISTS bumped_at TIMESTAMPTZ;

-- Update bump_station_order to populate bumped_at
CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station  kds_station
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
  v_total            INT;
  v_not_ready        INT;
  v_updated          INT;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('kitchen', 'branch_manager', 'general_manager', 'owner') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'ready')
  INTO v_total, v_not_ready
  FROM order_item_station_status
  WHERE order_id = p_order_id
    AND station  = p_station;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS' USING ERRCODE = 'P0002';
  END IF;

  IF v_not_ready > 0 THEN
    RAISE EXCEPTION 'NOT_ALL_READY'
      USING ERRCODE = '22023',
            DETAIL  = format('%s of %s items are not ready yet', v_not_ready, v_total);
  END IF;

  UPDATE order_item_station_status
  SET status     = 'completed',
      bumped_at  = now(),
      updated_at = now()
  WHERE order_id = p_order_id
    AND station  = p_station
    AND status   = 'ready';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'NO_ROWS_AFFECTED'
      USING ERRCODE = '40001',
            DETAIL  = 'Concurrent change beat the bump — refresh and retry';
  END IF;

  RETURN v_updated;
END;
$$;

-- Feature 1: Recall Station Order (60s window)
CREATE OR REPLACE FUNCTION recall_station_order(
  p_order_id UUID,
  p_station  kds_station
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
  v_bumped_at        TIMESTAMPTZ;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('kitchen', 'branch_manager', 'general_manager', 'owner') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  -- Verify bumped_at is within the last 60 seconds
  SELECT MAX(bumped_at) INTO v_bumped_at
  FROM order_item_station_status
  WHERE order_id = p_order_id
    AND station  = p_station
    AND status   = 'completed';

  IF v_bumped_at IS NULL THEN
    RAISE EXCEPTION 'NOT_BUMPED' USING ERRCODE = 'P0002';
  END IF;

  IF v_bumped_at < (now() - INTERVAL '60 seconds') THEN
    RAISE EXCEPTION 'RECALL_WINDOW_EXPIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE order_item_station_status
  SET status     = 'ready',
      bumped_at  = NULL,
      updated_at = now()
  WHERE order_id = p_order_id
    AND station  = p_station
    AND status   = 'completed';
END;
$$;

-- Feature 2: All-Day Counter (Midnight to Midnight)
CREATE OR REPLACE FUNCTION get_station_daily_count(
  p_station  kds_station,
  p_branch_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- We count distinct order_ids that have been completed at this station today
  SELECT COUNT(DISTINCT order_id) INTO v_count
  FROM order_item_station_status
  WHERE station   = p_station
    AND branch_id = p_branch_id
    AND status    = 'completed'
    AND bumped_at >= CURRENT_DATE; -- Midnight local time (postgres server time)

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grants
REVOKE EXECUTE ON FUNCTION recall_station_order(UUID, kds_station) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION recall_station_order(UUID, kds_station) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_station_daily_count(kds_station, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_station_daily_count(kds_station, TEXT) TO authenticated;
