-- ============================================================
-- Kahramana Baghdad
-- Migration: 141_restore_loyalty_on_reversal.sql
--
-- VULN-103.
--
-- When an order is cancelled, returned, or refunded, the
-- customer-redeemed loyalty points (orders.loyalty_points_redeemed) were
-- silently kept on the order row but NOT returned to the customer's
-- points_balance. The corresponding loyalty_discount_bhd credit also
-- stayed booked. Net effect: customers lose points when staff cancels
-- or refunds an order they redeemed against.
--
-- This RPC restores the redeemed points atomically:
--   1. Locate the order (FOR UPDATE to serialize concurrent reversals).
--   2. Look up customer_profiles by orders.customer_phone — if no profile,
--      record audit and exit (points were never tied to a profile row).
--   3. Idempotency check: scan audit_logs for an existing
--      'LOYALTY_POINTS_RESTORED' row for this order. If present, return
--      success without touching balances — re-run safety.
--   4. Increment customer_profiles.points_balance by the redeemed count.
--   5. INSERT points_transactions (type='bonus') for traceability.
--   6. INSERT audit_logs (action='LOYALTY_POINTS_RESTORED') with the
--      points count, BHD credit, order id, actor id.
--
-- Notes:
--   - We do NOT zero orders.loyalty_points_redeemed / loyalty_discount_bhd
--     — those are historical and used by analytics. Idempotency is enforced
--     by the audit-log lookup, not by mutating the order.
--   - Callers (orders/actions.ts cancel paths + payments/actions.ts refund)
--     invoke this AFTER their own state mutation succeeds. The audit row is
--     the source of truth for "this reversal was applied".
--
-- ACL: revoke anon, grant authenticated + service_role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_restore_redeemed_loyalty_points(
  p_order_id        uuid,
  p_actor_id        uuid,
  p_actor_role      text,
  p_actor_branch_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order            orders%ROWTYPE;
  v_customer         customer_profiles%ROWTYPE;
  v_already_restored INT;
  v_new_balance      INT;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Lock the order row to serialize parallel reversal attempts.
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND');
  END IF;

  IF v_order.loyalty_points_redeemed IS NULL OR v_order.loyalty_points_redeemed <= 0 THEN
    RETURN jsonb_build_object('success', true, 'code', 'NO_POINTS_REDEEMED', 'points_restored', 0);
  END IF;

  IF v_order.customer_phone IS NULL OR v_order.customer_phone = '' THEN
    RETURN jsonb_build_object('success', true, 'code', 'NO_CUSTOMER_PHONE', 'points_restored', 0);
  END IF;

  -- Idempotency: a prior 'LOYALTY_POINTS_RESTORED' audit row for this order
  -- means we already credited the customer — exit success without touching
  -- balances. Callers are safe to retry on transient failures.
  SELECT count(*) INTO v_already_restored
  FROM audit_logs
  WHERE table_name = 'customer_profiles'
    AND action     = 'LOYALTY_POINTS_RESTORED'
    AND changes ->> 'order_id' = p_order_id::text;

  IF v_already_restored > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_RESTORED',
      'points_restored', 0
    );
  END IF;

  SELECT * INTO v_customer
  FROM customer_profiles
  WHERE phone = v_order.customer_phone;

  IF NOT FOUND THEN
    -- Audit anyway so operators can see the redemption-without-profile state.
    INSERT INTO audit_logs (
      table_name, action, user_id, record_id, changes, branch_id, actor_role
    ) VALUES (
      'customer_profiles', 'LOYALTY_RESTORE_SKIPPED_NO_PROFILE', p_actor_id,
      p_order_id::text,
      jsonb_build_object(
        'order_id',                p_order_id,
        'customer_phone',          v_order.customer_phone,
        'points_redeemed',         v_order.loyalty_points_redeemed,
        'loyalty_discount_bhd',    v_order.loyalty_discount_bhd
      ),
      p_actor_branch_id,
      NULLIF(p_actor_role, '')::staff_role
    );
    RETURN jsonb_build_object('success', true, 'code', 'NO_CUSTOMER_PROFILE', 'points_restored', 0);
  END IF;

  v_new_balance := v_customer.points_balance + v_order.loyalty_points_redeemed;

  UPDATE customer_profiles
  SET points_balance = v_new_balance
  WHERE id = v_customer.id;

  INSERT INTO points_transactions (
    customer_id, order_id,
    points_earned, points_spent,
    balance_after, transaction_type, description
  ) VALUES (
    v_customer.id, p_order_id,
    v_order.loyalty_points_redeemed, 0,
    v_new_balance, 'bonus',
    'Points restored from reversed order ' || upper(substring(p_order_id::text FROM 1 FOR 8))
  );

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'customer_profiles', 'LOYALTY_POINTS_RESTORED', p_actor_id,
    v_customer.id::text,
    jsonb_build_object(
      'order_id',             p_order_id,
      'customer_id',          v_customer.id,
      'points_restored',      v_order.loyalty_points_redeemed,
      'loyalty_discount_bhd', v_order.loyalty_discount_bhd,
      'previous_balance',     v_customer.points_balance,
      'new_balance',          v_new_balance,
      'reason',               'order_reversal'
    ),
    p_actor_branch_id,
    NULLIF(p_actor_role, '')::staff_role
  );

  RETURN jsonb_build_object(
    'success',          true,
    'points_restored',  v_order.loyalty_points_redeemed,
    'new_balance',      v_new_balance,
    'customer_id',      v_customer.id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_restore_redeemed_loyalty_points(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_restore_redeemed_loyalty_points(uuid, uuid, text, text) TO authenticated, service_role;

-- ============================================================
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.rpc_restore_redeemed_loyalty_points(uuid, uuid, text, text);
-- ============================================================
