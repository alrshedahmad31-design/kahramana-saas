-- 063_phone_normalization.sql
-- Normalize Bahraini phone numbers to canonical +973XXXXXXXX format.
-- Fixes the phone mismatch between customer_profiles (registration) and
-- orders.customer_phone (checkout) so the loyalty trigger can match them.

-- ── 1. Helper: normalize a Bahraini phone to +973XXXXXXXX ────────────────────
CREATE OR REPLACE FUNCTION normalize_bahrain_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN p LIKE '+973%' THEN p
    WHEN p LIKE '00973%' THEN '+973' || substr(p, 6)
    WHEN p LIKE '973%' AND char_length(p) = 11 THEN '+' || p
    WHEN p ~ '^\d{8}$' THEN '+973' || p
    ELSE p
  END;
$$;

-- ── 2. Normalize existing customer_profiles phone values ─────────────────────
UPDATE customer_profiles
SET    phone = normalize_bahrain_phone(phone)
WHERE  phone NOT LIKE '+973%';

-- ── 3. Update loyalty trigger to normalize the order phone before matching ───
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

  -- Resolve customer profile by normalized phone
  SELECT * INTO v_customer
  FROM customer_profiles
  WHERE phone = normalize_bahrain_phone(NEW.customer_phone);

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- 1% of total in fils (10 points per 1 BHD)
  v_points_earned := floor(NEW.total_bhd * 10);
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

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS normalize_bahrain_phone(TEXT);
-- (award_loyalty_points_on_completion is reverted by re-running 008 migration)
