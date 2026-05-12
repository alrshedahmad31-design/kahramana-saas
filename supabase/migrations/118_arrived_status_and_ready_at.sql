-- ============================================================
-- 117_arrived_status_and_ready_at.sql
--
-- Three changes:
--   1. order_status enum gains 'arrived' (a sub-state of out_for_delivery
--      that records the driver having reached the customer's door).
--   2. orders.ready_at column — wall-clock time at which the kitchen
--      marked the order ready (i.e. last KDS station bumped).
--   3. bump_station_order RPC sets orders.ready_at = NOW() the first
--      time all stations for an order have completed.
--
-- SAFE TO RE-RUN.
-- ============================================================

-- ── 1. order_status: + 'arrived' ───────────────────────────────
-- ALTER TYPE ... ADD VALUE is idempotent via IF NOT EXISTS.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'arrived';

-- ── 2. orders.ready_at ─────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_ready_at
  ON orders (ready_at)
  WHERE ready_at IS NOT NULL;

-- ── 3. bump_station_order: stamp ready_at on last station bump ─
-- Same auth + body as 108; the only addition is the post-bump check
-- that counts remaining incomplete station rows for the order and,
-- when zero, stamps orders.ready_at the FIRST time only (COALESCE
-- preserves a prior value so re-bumps don't reset the timestamp).

CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station  TEXT
) RETURNS void AS $$
DECLARE
  v_branch_id        TEXT;
  v_caller_branch_id TEXT;
  v_pending_stations INT;
BEGIN
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

  -- Count any station-status rows that are still incomplete for this order.
  -- When zero remain, the kitchen has finished the whole order — stamp
  -- orders.ready_at once (COALESCE keeps the earlier timestamp if the
  -- last-station bump fires twice for the same order).
  SELECT COUNT(*) INTO v_pending_stations
  FROM   order_item_station_status
  WHERE  order_id = p_order_id
    AND  status <> 'completed';

  IF v_pending_stations = 0 THEN
    UPDATE orders
    SET    ready_at = COALESCE(ready_at, NOW())
    WHERE  id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
