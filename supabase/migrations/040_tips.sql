-- 040_tips.sql
-- Adds tip_bhd column to orders for driver-recorded cash tips.
-- Tips are NOT included in total_bhd; tracked separately.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_bhd NUMERIC(10,3) NOT NULL DEFAULT 0
    CHECK (tip_bhd >= 0);

CREATE INDEX IF NOT EXISTS idx_orders_tip
  ON orders(assigned_driver_id, delivered_at DESC)
  WHERE tip_bhd > 0;

-- ROLLBACK:
--   ALTER TABLE orders DROP COLUMN IF EXISTS tip_bhd;
--   DROP INDEX IF EXISTS idx_orders_tip;
