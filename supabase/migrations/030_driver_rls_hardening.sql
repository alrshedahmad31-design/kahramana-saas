-- ============================================================
-- Kahramana Baghdad — Driver RLS Hardening
-- Migration: 030_driver_rls_hardening.sql
--
-- Problem: migration 028 left two overly-broad policies on orders:
--
--   • orders_update_staff_only — any active staff can UPDATE any order.
--     A driver could update orders not assigned to them, or orders in
--     other branches.
--
--   • orders_select_staff — any active branch staff can SELECT all
--     orders in their branch. Drivers should only see ready orders
--     (eligible for pickup) and orders assigned to themselves.
--
-- Fix: split both policies into role-aware variants.
--
-- SAFE TO RE-RUN: every CREATE is preceded by DROP IF EXISTS.
-- ============================================================

-- ── ORDERS: UPDATE ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orders_update_staff_only"       ON orders;
DROP POLICY IF EXISTS "orders_update_non_driver_staff" ON orders;
DROP POLICY IF EXISTS "orders_update_driver"           ON orders;

-- Non-driver staff update orders within their branch (globals update everything)
CREATE POLICY "orders_update_non_driver_staff"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role     != 'driver'
        AND  (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role     != 'driver'
        AND  (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  );

-- Drivers may update:
--   USING  — ready orders in their branch (to claim), or orders already assigned to them
--   WITH CHECK — after update, assigned_driver_id must be null or their own ID
--                (prevents a driver from assigning an order to a different driver)
CREATE POLICY "orders_update_driver"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role      = 'driver'
        AND  s.branch_id = orders.branch_id
    )
    AND (
      orders.status            = 'ready'
      OR orders.assigned_driver_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role      = 'driver'
        AND  s.branch_id = orders.branch_id
    )
    AND (
      orders.assigned_driver_id IS NULL
      OR orders.assigned_driver_id = auth.uid()
    )
  );

-- ── ORDERS: SELECT ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orders_select_staff"            ON orders;
DROP POLICY IF EXISTS "orders_select_non_driver_staff" ON orders;
DROP POLICY IF EXISTS "orders_select_driver"           ON orders;

-- Non-driver staff: full branch read (globals see all branches)
CREATE POLICY "orders_select_non_driver_staff"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role     != 'driver'
        AND  (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  );

-- Drivers: only orders they are allowed to act on —
--   (a) ready orders in their branch  → eligible for pickup
--   (b) orders assigned to them       → their own active/completed orders
CREATE POLICY "orders_select_driver"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role      = 'driver'
        AND  (
          (orders.status = 'ready' AND s.branch_id = orders.branch_id)
          OR orders.assigned_driver_id = auth.uid()
        )
    )
  );

-- ── ORDER_ITEMS: SELECT ───────────────────────────────────────────────────────
-- Mirror the orders split so drivers cannot enumerate all branch order_items
-- via a direct client query even though orders SELECT is now restricted.

DROP POLICY IF EXISTS "order_items_select_staff"            ON order_items;
DROP POLICY IF EXISTS "order_items_select_non_driver_staff" ON order_items;
DROP POLICY IF EXISTS "order_items_select_driver"           ON order_items;

CREATE POLICY "order_items_select_non_driver_staff"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   orders      o
      JOIN   staff_basic s ON s.id = auth.uid() AND s.is_active = TRUE
      WHERE  o.id    = order_items.order_id
        AND  s.role != 'driver'
        AND  (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = o.branch_id
        )
    )
  );

CREATE POLICY "order_items_select_driver"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   orders      o
      JOIN   staff_basic s ON s.id = auth.uid() AND s.is_active = TRUE
      WHERE  o.id     = order_items.order_id
        AND  s.role   = 'driver'
        AND  s.branch_id = o.branch_id
        AND  (
          o.status             = 'ready'
          OR o.assigned_driver_id = auth.uid()
        )
    )
  );

-- ============================================================
-- ROLLBACK:
--
-- DROP POLICY IF EXISTS "orders_update_non_driver_staff"      ON orders;
-- DROP POLICY IF EXISTS "orders_update_driver"                ON orders;
-- DROP POLICY IF EXISTS "orders_select_non_driver_staff"      ON orders;
-- DROP POLICY IF EXISTS "orders_select_driver"                ON orders;
-- DROP POLICY IF EXISTS "order_items_select_non_driver_staff" ON order_items;
-- DROP POLICY IF EXISTS "order_items_select_driver"           ON order_items;
--
-- CREATE POLICY "orders_update_staff_only"
--   ON orders FOR UPDATE TO authenticated
--   USING  (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND is_active = TRUE))
--   WITH CHECK (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND is_active = TRUE));
--
-- CREATE POLICY "orders_select_staff"
--   ON orders FOR SELECT TO authenticated
--   USING (EXISTS (SELECT 1 FROM staff_basic
--     WHERE id = auth.uid() AND is_active = TRUE
--     AND (role IN ('owner','general_manager') OR branch_id = orders.branch_id)));
--
-- CREATE POLICY "order_items_select_staff"
--   ON order_items FOR SELECT TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM orders o JOIN staff_basic s ON s.id = auth.uid() AND s.is_active = TRUE
--     WHERE o.id = order_items.order_id
--       AND (s.role IN ('owner','general_manager') OR s.branch_id = o.branch_id)));
-- ============================================================
