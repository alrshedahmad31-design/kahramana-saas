-- Phase 5 — Loyalty & Points System
-- ROLLBACK: see bottom of file

-- ── Source tracking on orders (direct vs delivery platform) ──────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'direct';

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- ── Loyalty tier enum ─────────────────────────────────────────────────────────

CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- ── Customer profiles ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone            text UNIQUE NOT NULL,
  name             text,
  email            text,
  loyalty_tier     loyalty_tier NOT NULL DEFAULT 'bronze',
  points_balance   int NOT NULL DEFAULT 0,
  total_spent_bhd  numeric(10,2) NOT NULL DEFAULT 0,
  total_orders     int NOT NULL DEFAULT 0,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  last_order_at    timestamptz
);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- ── Points transactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS points_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  order_id         uuid REFERENCES orders(id) ON DELETE SET NULL,
  points_earned    int NOT NULL DEFAULT 0,
  points_spent     int NOT NULL DEFAULT 0,
  balance_after    int NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'bonus')),
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_points_tx_customer ON points_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_tx_order ON points_transactions(order_id);

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Customers read own profile only
CREATE POLICY "customer_read_own_profile"
  ON customer_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "customer_update_own_profile"
  ON customer_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Customers can insert their own profile (on registration)
CREATE POLICY "customer_insert_own_profile"
  ON customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Customers read own transactions only
CREATE POLICY "customer_read_own_transactions"
  ON points_transactions FOR SELECT
  USING (auth.uid() = customer_id);

-- Staff (owner / manager / marketing) can read all
CREATE POLICY "staff_read_customer_profiles"
  ON customer_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
        AND is_active = true
    )
  );

CREATE POLICY "staff_read_points_transactions"
  ON points_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
        AND is_active = true
    )
  );

-- ── Tier calculation function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_loyalty_tier(p_orders int, p_spent numeric)
RETURNS loyalty_tier AS $$
BEGIN
  IF   p_orders >= 50 OR p_spent >= 600 THEN RETURN 'platinum';
  ELSIF p_orders >= 25 OR p_spent >= 300 THEN RETURN 'gold';
  ELSIF p_orders >= 10 OR p_spent >= 100 THEN RETURN 'silver';
  ELSE                                        RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Points award trigger (fires on order → 'completed') ───────────────────────

CREATE OR REPLACE FUNCTION award_loyalty_points_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_customer      customer_profiles%ROWTYPE;
  v_points_earned int;
  v_new_balance   int;
  v_new_orders    int;
  v_new_spent     numeric(10,2);
  v_new_tier      loyalty_tier;
BEGIN
  -- Only when status transitions INTO 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Only for direct-channel orders with a linked phone
  IF NEW.source <> 'direct' OR NEW.customer_phone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve customer profile by phone
  SELECT * INTO v_customer
  FROM customer_profiles
  WHERE phone = NEW.customer_phone;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- 5 points per 1 BHD, floored
  v_points_earned := floor(NEW.total_bhd * 5);
  v_new_balance   := v_customer.points_balance + v_points_earned;
  v_new_orders    := v_customer.total_orders   + 1;
  v_new_spent     := v_customer.total_spent_bhd + NEW.total_bhd;
  v_new_tier      := calculate_loyalty_tier(v_new_orders, v_new_spent);

  -- Update profile — never downgrade tier (tiers only go up)
  UPDATE customer_profiles SET
    points_balance  = v_new_balance,
    total_spent_bhd = v_new_spent,
    total_orders    = v_new_orders,
    last_order_at   = NOW(),
    loyalty_tier    = GREATEST(loyalty_tier, v_new_tier)
  WHERE id = v_customer.id;

  -- Record the earned transaction
  INSERT INTO points_transactions (
    customer_id, order_id, points_earned, points_spent,
    balance_after, transaction_type, description
  ) VALUES (
    v_customer.id, NEW.id, v_points_earned, 0,
    v_new_balance, 'earned',
    'Points earned for order #' || upper(substring(NEW.id::text FROM 1 FOR 8))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_award_loyalty_points
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_completion();

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_award_loyalty_points ON orders;
-- DROP FUNCTION IF EXISTS award_loyalty_points_on_completion();
-- DROP FUNCTION IF EXISTS calculate_loyalty_tier(int, numeric);
-- DROP TABLE IF EXISTS points_transactions;
-- DROP TABLE IF EXISTS customer_profiles;
-- DROP TYPE IF EXISTS loyalty_tier;
-- ALTER TABLE orders DROP COLUMN IF EXISTS source;
