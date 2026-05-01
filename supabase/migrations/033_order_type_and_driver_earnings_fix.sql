-- 1. Add order_type to orders (delivery vs pickup)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'delivery'
  CHECK (order_type IN ('delivery', 'pickup'));

CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- 2. Fix driver_earnings broken FK (references non-existent 'staff' table)
ALTER TABLE driver_earnings
  DROP CONSTRAINT IF EXISTS driver_earnings_driver_id_fkey;

ALTER TABLE driver_earnings
  ADD CONSTRAINT driver_earnings_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES staff_basic(id) ON DELETE CASCADE;
