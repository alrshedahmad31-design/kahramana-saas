-- ============================================================
-- Kahramana Baghdad — KDS Schema & Access Fix
-- Migration: 102_kds_schema_access_fix.sql
-- Applied: 2026-05-11
--
-- 1. Add 'bumped_at' to 'order_item_station_status' for recall logic.
-- 2. Relax RLS on 'orders' table for staff visibility.
-- 3. Update 'bump_station_order' to record bump time.
-- ============================================================

-- 1. Schema update
ALTER TABLE order_item_station_status 
ADD COLUMN IF NOT EXISTS bumped_at TIMESTAMPTZ;

-- 2. Relax orders SELECT policy for staff
DROP POLICY IF EXISTS "orders_select_staff_v2" ON orders;
CREATE POLICY "orders_select_staff_v2"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  (
          role IN ('owner', 'general_manager')
          OR (branch_id = orders.branch_id AND role IN ('branch_manager', 'cashier', 'kitchen', 'waiter'))
        )
    )
  );

-- 3. Relax KDS select policy
DROP POLICY IF EXISTS "kds_select_v2" ON order_item_station_status;
CREATE POLICY "kds_select_v2"
  ON order_item_station_status FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  (
          role IN ('owner', 'general_manager')
          OR (branch_id = order_item_station_status.branch_id AND role IN ('branch_manager', 'cashier', 'kitchen', 'waiter'))
        )
    )
  );

-- 4. Update the bump logic to record the time
-- This allows the 'Recall' feature to function by checking the 60s window.
CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station TEXT
) RETURNS void AS $$
BEGIN
  UPDATE order_item_station_status
  SET status = 'completed',
      bumped_at = NOW(),
      updated_at = NOW()
  WHERE order_id = p_order_id
    AND station = p_station
    AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
