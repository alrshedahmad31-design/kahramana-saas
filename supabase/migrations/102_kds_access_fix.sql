-- ============================================================
-- Kahramana Baghdad — KDS Access & Policy Fix
-- Migration: 102_kds_access_fix.sql
-- Applied: 2026-05-11
--
-- Problem: Restrictive RLS on 'orders' table (from 095) blocks
--   kitchen/cashier staff from reading tickets required for KDS.
--
-- Fix:
--   1. Explicitly allow 'kitchen' and 'cashier' roles to SELECT
--      orders from their own branch.
--   2. Harden 'order_item_station_status' select policy.
-- ============================================================

-- 1. Relax orders SELECT policy for staff
-- Note: 'orders_select_staff' was created in 028 but might have been
-- overridden or shadowed. We'll ensure it covers the necessary roles.

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

-- 2. Ensure KDS station status table is readable by the same group
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

-- 3. Also allow 'waiter' to select orders for table service
-- (Handled by the broad staff policy above)

-- Verification:
-- SELECT * FROM pg_policies WHERE tablename IN ('orders', 'order_item_station_status');
