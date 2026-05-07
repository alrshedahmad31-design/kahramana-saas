-- 061_orders_loyalty_columns.sql
-- Add loyalty redemption tracking columns to orders table

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount_bhd    NUMERIC(10,3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.loyalty_points_redeemed IS 'Points redeemed at checkout (0 if none used)';
COMMENT ON COLUMN orders.loyalty_discount_bhd    IS 'BHD value of redeemed points applied as discount (0.000 if none)';

-- Fix DB trigger: was awarding 10 pts/BHD (correct) but leave constant sync to TypeScript
-- No trigger change needed — DB trigger is correct at 10 pts/BHD
-- Fix is applied in calculations.ts (POINTS_PER_BHD 5 → 10)
