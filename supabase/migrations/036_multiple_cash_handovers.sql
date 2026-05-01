-- 036_multiple_cash_handovers.sql
-- Allow multiple cash handovers per driver per shift_date.
-- Each delivered cash order can appear in exactly ONE handover (unique on order_id).
-- Safe to re-run: all DDL uses IF NOT EXISTS / CREATE OR REPLACE.

CREATE TABLE IF NOT EXISTS driver_cash_handover_orders (
  handover_id UUID NOT NULL REFERENCES driver_cash_handovers(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY (handover_id, order_id),
  UNIQUE (order_id)   -- core invariant: one order in exactly one handover
);

CREATE INDEX IF NOT EXISTS idx_dcho_handover ON driver_cash_handover_orders(handover_id);
CREATE INDEX IF NOT EXISTS idx_dcho_order    ON driver_cash_handover_orders(order_id);

ALTER TABLE driver_cash_handover_orders ENABLE ROW LEVEL SECURITY;

-- Driver: read own handover order links
DROP POLICY IF EXISTS "dcho_select_own" ON driver_cash_handover_orders;
CREATE POLICY "dcho_select_own"
  ON driver_cash_handover_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_cash_handovers h
      WHERE h.id = driver_cash_handover_orders.handover_id
        AND h.driver_id = auth.uid()
    )
  );

-- Manager: read all
DROP POLICY IF EXISTS "dcho_select_manager" ON driver_cash_handover_orders;
CREATE POLICY "dcho_select_manager"
  ON driver_cash_handover_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager')
        AND is_active = TRUE
    )
  );

-- Driver: insert (server enforces handover ownership)
DROP POLICY IF EXISTS "dcho_insert_own" ON driver_cash_handover_orders;
CREATE POLICY "dcho_insert_own"
  ON driver_cash_handover_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM driver_cash_handovers h
      WHERE h.id = driver_cash_handover_orders.handover_id
        AND h.driver_id = auth.uid()
    )
  );

-- Service role bypass
DROP POLICY IF EXISTS "service_all_dcho" ON driver_cash_handover_orders;
CREATE POLICY "service_all_dcho"
  ON driver_cash_handover_orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill: existing handovers with order_ids[] → link table
INSERT INTO driver_cash_handover_orders (handover_id, order_id)
SELECT h.id, ord_id::uuid
FROM driver_cash_handovers h
CROSS JOIN LATERAL unnest(h.order_ids) AS ord_id
WHERE array_length(h.order_ids, 1) > 0
  AND EXISTS (SELECT 1 FROM orders WHERE id = ord_id::uuid)
ON CONFLICT (order_id) DO NOTHING;

-- ROLLBACK:
--   DROP TABLE IF EXISTS driver_cash_handover_orders;
