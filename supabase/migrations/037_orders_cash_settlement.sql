-- 037_orders_cash_settlement.sql
-- Adds cash settlement timestamp + handover backlink to orders.
-- Backfills from existing driver_cash_handover_orders (created in 036).
-- DEPENDS ON 036_multiple_cash_handovers.sql being applied first.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cash_settled_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_settlement_id UUID REFERENCES driver_cash_handovers(id) ON DELETE SET NULL;

-- Partial index: fast lookup of unsettled cash orders per driver
CREATE INDEX IF NOT EXISTS idx_orders_cash_unsettled
  ON orders(assigned_driver_id, status)
  WHERE cash_settled_at IS NULL;

-- Backfill from 036's link table
UPDATE orders o
SET    cash_settled_at    = COALESCE(h.handed_at, h.created_at),
       cash_settlement_id = h.id
FROM   driver_cash_handover_orders link
JOIN   driver_cash_handovers       h ON h.id = link.handover_id
WHERE  link.order_id = o.id
  AND  o.cash_settled_at IS NULL;

-- ROLLBACK:
--   ALTER TABLE orders DROP COLUMN IF EXISTS cash_settlement_id;
--   ALTER TABLE orders DROP COLUMN IF EXISTS cash_settled_at;
--   DROP INDEX IF EXISTS idx_orders_cash_unsettled;
