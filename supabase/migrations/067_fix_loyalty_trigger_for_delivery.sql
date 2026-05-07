-- 067_fix_loyalty_trigger_for_delivery.sql
--
-- BUG-4: Loyalty points were never awarded for delivery orders because the
-- trigger only fired on 'completed', but delivery orders end on 'delivered'.
--
-- Fix: update the guard to fire on BOTH 'completed' (dine-in / pickup)
-- AND 'delivered' (delivery). The OLD.status guard prevents double-firing
-- if an order ever transitions between the two terminal statuses.

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
  -- Fire on first transition INTO 'completed' (dine-in/pickup) OR 'delivered' (delivery).
  -- Reject if new status is neither, or if old status was already a terminal state
  -- (guards against double-awarding if status ever moves between terminal statuses).
  IF NEW.status NOT IN ('completed', 'delivered')
     OR OLD.status IN ('completed', 'delivered') THEN
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
