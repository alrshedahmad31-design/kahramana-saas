-- ============================================================
-- Kahramana Baghdad — orders UPDATE RLS tightening
-- Migration: 095_orders_update_rls_tighten.sql
-- Date: 2026-05-10
--
-- Audit fix #4 (Driver audit, 2026-05-10):
--   The existing orders_update_non_driver_staff policy (032_dashboard_live_ops_fixes.sql)
--   allows cashier/kitchen roles to UPDATE the orders row directly. That
--   broad surface lets either role mutate status, branch, totals, or driver
--   assignment via PostgREST without going through the server actions that
--   carry transition + branch validation.
--
-- Tightened model:
--   - Direct orders UPDATE is restricted to owner / general_manager / branch_manager.
--   - cashier and kitchen mutations now go through:
--       * KDS RPCs (update_order_item_station_status / bump_station_order)
--         for station/item progress
--       * Server actions (createManualOrder, advanceOrderStatus,
--         updateOrderStatus, updateOrderWithReason) which use the service
--         role and validate transitions, branch scope, and payment refund
--         requirements before touching orders.
--
-- Driver UPDATE policy (orders_update_driver, 030_driver_rls_hardening.sql)
-- is unchanged — drivers still need to write picked_up_at / arrived_at /
-- delivered_at / status='delivered' on their assigned orders.
-- ============================================================

DROP POLICY IF EXISTS "orders_update_non_driver_staff" ON orders;

CREATE POLICY "orders_update_non_driver_staff"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND s.role IN ('owner', 'general_manager', 'branch_manager')
        AND (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND s.role IN ('owner', 'general_manager', 'branch_manager')
        AND (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  );

-- ============================================================
-- ROLLBACK: Re-add cashier and kitchen to the role list to restore the
-- previous (032) behaviour:
--   DROP POLICY IF EXISTS "orders_update_non_driver_staff" ON orders;
--   CREATE POLICY "orders_update_non_driver_staff"
--     ON orders FOR UPDATE TO authenticated
--     USING (
--       EXISTS (
--         SELECT 1 FROM staff_basic s
--         WHERE s.id = auth.uid() AND s.is_active = TRUE
--           AND s.role IN ('owner','general_manager','branch_manager','cashier','kitchen')
--           AND (s.role IN ('owner','general_manager') OR s.branch_id = orders.branch_id)
--       )
--     )
--     WITH CHECK ( ... same ... );
-- ============================================================
