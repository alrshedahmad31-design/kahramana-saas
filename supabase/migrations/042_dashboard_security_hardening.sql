-- ============================================================
-- Kahramana Baghdad — Dashboard Security Hardening Phase 1
-- Migration: 042_dashboard_security_hardening.sql
-- Scope: tighten dashboard-facing orders/payments RLS without touching
--        webhook/service_role flows.
-- ============================================================

-- ── PAYMENTS: restrict staff read access by role and branch ──────────────────

DROP POLICY IF EXISTS "staff_select_payments" ON payments;
DROP POLICY IF EXISTS "payments_select_dashboard_staff" ON payments;

CREATE POLICY "payments_select_dashboard_staff"
  ON payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      JOIN orders o ON o.id = payments.order_id
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND (
          s.role::text IN ('owner','general_manager')
          OR (
            s.role::text IN ('branch_manager','cashier')
            AND s.branch_id IS NOT NULL
            AND s.branch_id = o.branch_id
          )
        )
    )
  );

-- ── ORDERS: remove non-operational staff from direct order access ────────────
-- Customer and driver policies remain unchanged. Service role bypass remains
-- available for server actions and payment webhooks.

DROP POLICY IF EXISTS "orders_select_non_driver_staff" ON orders;
DROP POLICY IF EXISTS "orders_select_dashboard_staff" ON orders;

CREATE POLICY "orders_select_dashboard_staff"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND (
          s.role::text IN ('owner','general_manager')
          OR (
            s.role::text IN ('branch_manager','cashier')
            AND s.branch_id IS NOT NULL
            AND s.branch_id = orders.branch_id
          )
          OR (
            s.role::text = 'kitchen'
            AND s.branch_id IS NOT NULL
            AND s.branch_id = orders.branch_id
            AND orders.status::text IN ('accepted','preparing','ready')
          )
        )
    )
  );

DROP POLICY IF EXISTS "orders_update_non_driver_staff" ON orders;
DROP POLICY IF EXISTS "orders_update_dashboard_staff" ON orders;

CREATE POLICY "orders_update_dashboard_staff"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND (
          s.role::text IN ('owner','general_manager')
          OR (
            s.role::text IN ('branch_manager','cashier')
            AND s.branch_id IS NOT NULL
            AND s.branch_id = orders.branch_id
          )
          OR (
            s.role::text = 'kitchen'
            AND s.branch_id IS NOT NULL
            AND s.branch_id = orders.branch_id
            AND orders.status::text IN ('accepted','preparing')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND (
          s.role::text IN ('owner','general_manager')
          OR (
            s.role::text IN ('branch_manager','cashier')
            AND s.branch_id IS NOT NULL
            AND s.branch_id = orders.branch_id
          )
          OR (
            s.role::text = 'kitchen'
            AND s.branch_id IS NOT NULL
            AND s.branch_id = orders.branch_id
            AND orders.status::text IN ('preparing','ready')
          )
        )
    )
  );

-- ── ORDER_ITEMS: mirror dashboard order read scope ───────────────────────────

DROP POLICY IF EXISTS "order_items_select_staff" ON order_items;
DROP POLICY IF EXISTS "order_items_select_non_driver_staff" ON order_items;
DROP POLICY IF EXISTS "order_items_select_dashboard_staff" ON order_items;

CREATE POLICY "order_items_select_dashboard_staff"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN staff_basic s ON s.id = auth.uid()
      WHERE o.id = order_items.order_id
        AND s.is_active = TRUE
        AND (
          s.role::text IN ('owner','general_manager')
          OR (
            s.role::text IN ('branch_manager','cashier')
            AND s.branch_id IS NOT NULL
            AND s.branch_id = o.branch_id
          )
          OR (
            s.role::text = 'kitchen'
            AND s.branch_id IS NOT NULL
            AND s.branch_id = o.branch_id
            AND o.status::text IN ('accepted','preparing','ready')
          )
        )
    )
  );

DROP POLICY IF EXISTS "order_items_select_driver" ON order_items;

CREATE POLICY "order_items_select_driver"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN staff_basic s ON s.id = auth.uid()
      WHERE o.id = order_items.order_id
        AND s.is_active = TRUE
        AND s.role::text = 'driver'
        AND s.branch_id IS NOT NULL
        AND s.branch_id = o.branch_id
        AND (
          o.assigned_driver_id = auth.uid()
          OR o.status::text = 'ready'
        )
    )
  );
