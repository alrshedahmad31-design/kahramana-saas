-- 066_fix_branch_id_type.sql
-- branches.id is TEXT PRIMARY KEY ("riffa", "qallali"), not UUID.
-- Migration 064 incorrectly declared p_branch_id as UUID, causing
-- "invalid input syntax for type uuid: 'riffa'" on every order.
-- Fix: drop the UUID-signature overload and recreate with TEXT.

DROP FUNCTION IF EXISTS rpc_create_order(
  TEXT, TEXT, TEXT, UUID, TEXT, JSONB, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT,
  UUID, NUMERIC, INT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, UUID
);

CREATE OR REPLACE FUNCTION rpc_create_order(
  -- ── Required ─────────────────────────────────────────────────────────────────
  p_idempotency_key      TEXT,
  p_customer_name        TEXT,
  p_customer_phone       TEXT,
  p_branch_id            TEXT,               -- TEXT, not UUID (branches.id is TEXT PK)
  p_order_type           TEXT,
  p_items                JSONB,
  p_total_bhd            NUMERIC,            -- accepted but IGNORED; recalculated
  -- ── Optional delivery / meta ─────────────────────────────────────────────────
  p_notes                TEXT        DEFAULT NULL,
  p_customer_notes       TEXT        DEFAULT NULL,
  p_delivery_address     TEXT        DEFAULT NULL,
  p_delivery_building    TEXT        DEFAULT NULL,
  p_delivery_street      TEXT        DEFAULT NULL,
  p_delivery_area        TEXT        DEFAULT NULL,
  p_delivery_lat         NUMERIC     DEFAULT NULL,
  p_delivery_lng         NUMERIC     DEFAULT NULL,
  p_source               TEXT        DEFAULT 'direct',
  -- ── Discount inputs ──────────────────────────────────────────────────────────
  p_coupon_id            UUID        DEFAULT NULL,
  p_coupon_discount_bhd  NUMERIC     DEFAULT 0,
  p_points_to_redeem     INT         DEFAULT 0,
  -- ── Payment ──────────────────────────────────────────────────────────────────
  p_payment_method       TEXT        DEFAULT 'cash',
  -- ── Legacy params kept for caller compatibility; values are IGNORED ──────────
  p_status               TEXT        DEFAULT 'new',
  p_loyalty_discount_bhd NUMERIC     DEFAULT 0,
  p_expires_at           TIMESTAMPTZ DEFAULT NULL,
  -- ── Customer UUID for service_role calls involving loyalty redemption ─────────
  p_customer_id          UUID        DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id          UUID;
  v_existing_id       UUID;
  v_coupon            coupons%ROWTYPE;
  v_customer          customer_profiles%ROWTYPE;
  v_new_balance       INT;
  v_item              JSONB;
  v_status            order_status;
  v_expires_at        TIMESTAMPTZ;
  v_calculated_total  NUMERIC;
  v_points_discount   NUMERIC;
  v_final_total       NUMERIC;
  v_customer_phone    TEXT;
  v_effective_cid     UUID;
BEGIN

  -- ── 1. Auth gate ──────────────────────────────────────────────────────────────
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- ── 2. Phone override from verified profile ───────────────────────────────────
  v_customer_phone := p_customer_phone;
  IF auth.uid() IS NOT NULL THEN
    SELECT phone INTO v_customer_phone
    FROM   customer_profiles
    WHERE  id = auth.uid();
    IF NOT FOUND THEN
      v_customer_phone := p_customer_phone;
    END IF;
  END IF;

  -- ── 3. Idempotency ────────────────────────────────────────────────────────────
  SELECT id INTO v_existing_id
  FROM   orders
  WHERE  idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_existing_id; END IF;

  -- ── 4. Price validation against menu_items_sync ───────────────────────────────
  IF EXISTS (
    SELECT 1
    FROM   jsonb_array_elements(p_items) AS item
    JOIN   menu_items_sync mis ON mis.slug = item->>'menu_item_slug'
    WHERE  mis.price_bhd IS NOT NULL
      AND  ABS(mis.price_bhd - (item->>'unit_price_bhd')::NUMERIC) > 0.001
  ) THEN
    RAISE EXCEPTION 'PRICE_MISMATCH: submitted unit_price_bhd does not match menu_items_sync';
  END IF;

  SELECT COALESCE(
    SUM((item->>'unit_price_bhd')::NUMERIC * (item->>'quantity')::INT), 0
  )
  INTO v_calculated_total
  FROM jsonb_array_elements(p_items) AS item;

  IF v_calculated_total < 0.001 THEN
    RAISE EXCEPTION 'INVALID_TOTAL: order subtotal is zero or negative';
  END IF;

  IF COALESCE(p_coupon_discount_bhd, 0) > v_calculated_total THEN
    RAISE EXCEPTION 'COUPON_INVALID: coupon discount exceeds order subtotal';
  END IF;

  -- ── 5. Coupon: row-lock → validate → increment ────────────────────────────────
  IF p_coupon_id IS NOT NULL THEN

    SELECT * INTO v_coupon
    FROM   coupons
    WHERE  id = p_coupon_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'COUPON_INVALID: coupon not found';
    END IF;

    IF NOT v_coupon.is_active OR COALESCE(v_coupon.paused, FALSE) THEN
      RAISE EXCEPTION 'COUPON_INVALID: coupon inactive or paused';
    END IF;

    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
      RAISE EXCEPTION 'COUPON_INVALID: coupon has expired';
    END IF;

    IF v_coupon.usage_limit IS NOT NULL
       AND v_coupon.usage_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'COUPON_INVALID: usage limit reached';
    END IF;

    UPDATE coupons
    SET    usage_count = usage_count + 1
    WHERE  id = p_coupon_id;

  END IF;

  -- ── 6. Loyalty: UUID-verified → row-lock → validate → deduct ─────────────────
  IF p_points_to_redeem > 0 THEN

    v_effective_cid := COALESCE(auth.uid(), p_customer_id);
    IF v_effective_cid IS NULL THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: authentication required to redeem points';
    END IF;

    SELECT * INTO v_customer
    FROM   customer_profiles
    WHERE  id = v_effective_cid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: customer profile not found';
    END IF;

    IF p_points_to_redeem < 200 THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: minimum redemption is 200 points';
    END IF;

    IF v_customer.points_balance < p_points_to_redeem THEN
      RAISE EXCEPTION
        'INSUFFICIENT_POINTS: balance % < requested %',
        v_customer.points_balance, p_points_to_redeem;
    END IF;

    v_points_discount := p_points_to_redeem::NUMERIC * 0.005;

    IF v_points_discount > (v_calculated_total * 0.5) THEN
      RAISE EXCEPTION 'POINTS_OVER_CAP: points discount exceeds 50%% of order subtotal';
    END IF;

    v_new_balance := v_customer.points_balance - p_points_to_redeem;

    UPDATE customer_profiles
    SET    points_balance = v_new_balance
    WHERE  id = v_customer.id;

  ELSE
    v_points_discount := 0;
  END IF;

  -- ── 7. Force status and expiry from payment method ────────────────────────────
  v_status := CASE
    WHEN p_payment_method IN ('tap', 'benefit_pay', 'online') THEN 'pending_payment'::order_status
    ELSE 'new'::order_status
  END;

  v_expires_at := CASE
    WHEN v_status = 'pending_payment' THEN NOW() + INTERVAL '30 minutes'
    ELSE NULL
  END;

  -- ── 8. Server-derived final total ─────────────────────────────────────────────
  v_final_total := GREATEST(
    0.001,
    v_calculated_total
      - COALESCE(p_coupon_discount_bhd, 0)
      - v_points_discount
  );

  -- ── 9. Order insert ───────────────────────────────────────────────────────────
  INSERT INTO orders (
    idempotency_key,
    customer_name,       customer_phone,    branch_id,
    order_type,          status,            total_bhd,          expires_at,
    notes,               customer_notes,    source,
    delivery_address,    delivery_building, delivery_street,
    delivery_area,       delivery_lat,      delivery_lng,
    loyalty_points_redeemed, loyalty_discount_bhd,
    coupon_id,           coupon_discount_bhd,
    whatsapp_sent_at
  ) VALUES (
    p_idempotency_key,
    p_customer_name,     v_customer_phone,  p_branch_id,
    p_order_type,        v_status,          v_final_total,      v_expires_at,
    p_notes,             p_customer_notes,  p_source,
    p_delivery_address,  p_delivery_building, p_delivery_street,
    p_delivery_area,     p_delivery_lat,    p_delivery_lng,
    p_points_to_redeem,  v_points_discount,
    p_coupon_id,
      CASE WHEN p_coupon_id IS NOT NULL THEN p_coupon_discount_bhd ELSE NULL END,
    NULL
  )
  RETURNING id INTO v_order_id;

  -- ── 10. Order items insert ─────────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      menu_item_slug, name_ar,          name_en,
      selected_size,  selected_variant,
      quantity,       notes,
      unit_price_bhd, item_total_bhd
    ) VALUES (
      v_order_id,
      v_item->>'menu_item_slug',
      v_item->>'name_ar',
      v_item->>'name_en',
      NULLIF(v_item->>'selected_size',    ''),
      NULLIF(v_item->>'selected_variant', ''),
      (v_item->>'quantity')::INT,
      NULLIF(v_item->>'notes', ''),
      (v_item->>'unit_price_bhd')::NUMERIC,
      (v_item->>'item_total_bhd')::NUMERIC
    );
  END LOOP;

  -- ── 11. Loyalty transaction ────────────────────────────────────────────────────
  IF p_points_to_redeem > 0 THEN
    INSERT INTO points_transactions (
      customer_id,   order_id,    points_earned, points_spent,
      balance_after, transaction_type, description
    ) VALUES (
      v_customer.id, v_order_id, 0,              p_points_to_redeem,
      v_new_balance, 'redeemed',
      'Redeemed for order #' || UPPER(SUBSTRING(v_order_id::TEXT FROM 1 FOR 8))
    );
  END IF;

  RETURN v_order_id;

END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_create_order FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION rpc_create_order TO authenticated;
GRANT  EXECUTE ON FUNCTION rpc_create_order TO service_role;
