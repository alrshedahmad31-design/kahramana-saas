-- 062_rpc_create_order.sql
-- Atomic order-creation RPC.
-- Replaces the sequential client-side writes in checkout/actions.ts with a
-- single PostgreSQL function that commits (or rolls back) everything together:
--   1. Idempotency guard
--   2. Coupon lock + validation + usage_count increment
--   3. Loyalty deduction + points_transaction record
--   4. orders INSERT
--   5. order_items INSERT (p_items JSONB array)
-- payments and coupon_usages are still written client-side after a successful call.

CREATE OR REPLACE FUNCTION rpc_create_order(
  p_idempotency_key      TEXT,
  p_customer_name        TEXT,
  p_customer_phone       TEXT,
  p_branch_id            UUID,
  p_order_type           TEXT,
  p_items                JSONB,
  p_total_bhd            NUMERIC,
  p_notes                TEXT        DEFAULT NULL,
  p_customer_notes       TEXT        DEFAULT NULL,
  p_delivery_address     TEXT        DEFAULT NULL,
  p_delivery_building    TEXT        DEFAULT NULL,
  p_delivery_street      TEXT        DEFAULT NULL,
  p_delivery_area        TEXT        DEFAULT NULL,
  p_delivery_lat         NUMERIC     DEFAULT NULL,
  p_delivery_lng         NUMERIC     DEFAULT NULL,
  p_source               TEXT        DEFAULT 'direct',
  p_coupon_id            UUID        DEFAULT NULL,
  p_coupon_discount_bhd  NUMERIC     DEFAULT 0,
  p_points_to_redeem     INT         DEFAULT 0,
  p_loyalty_discount_bhd NUMERIC     DEFAULT 0,
  p_payment_method       TEXT        DEFAULT 'cash',
  p_status               TEXT        DEFAULT 'new',
  p_expires_at           TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id    UUID;
  v_existing_id UUID;
  v_coupon      coupons%ROWTYPE;
  v_customer    customer_profiles%ROWTYPE;
  v_new_balance INT;
  v_item        JSONB;
BEGIN

  -- ── 1. Idempotency ────────────────────────────────────────────────────────────
  -- If a committed order already carries this key, return it immediately.
  SELECT id INTO v_existing_id
  FROM   orders
  WHERE  idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  -- ── 2. Coupon: row-lock → validate → increment ────────────────────────────────
  IF p_coupon_id IS NOT NULL THEN

    SELECT * INTO v_coupon
    FROM   coupons
    WHERE  id = p_coupon_id
    FOR UPDATE;                              -- serialise concurrent uses

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

  -- ── 3. Loyalty: row-lock → validate balance → deduct ─────────────────────────
  IF p_points_to_redeem > 0 THEN

    SELECT * INTO v_customer
    FROM   customer_profiles
    WHERE  phone = p_customer_phone
    FOR UPDATE;                              -- serialise concurrent redemptions

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

    v_new_balance := v_customer.points_balance - p_points_to_redeem;

    UPDATE customer_profiles
    SET    points_balance = v_new_balance
    WHERE  id = v_customer.id;

  END IF;

  -- ── 4. Order insert ────────────────────────────────────────────────────────────
  INSERT INTO orders (
    idempotency_key,
    customer_name, customer_phone, branch_id,
    order_type,    status,         total_bhd,    expires_at,
    notes,         customer_notes, source,
    delivery_address,  delivery_building, delivery_street,
    delivery_area,     delivery_lat,      delivery_lng,
    loyalty_points_redeemed, loyalty_discount_bhd,
    coupon_id,    coupon_discount_bhd,
    whatsapp_sent_at
  ) VALUES (
    p_idempotency_key,
    p_customer_name, p_customer_phone, p_branch_id,
    p_order_type,    p_status::order_status, p_total_bhd, p_expires_at,
    p_notes,         p_customer_notes, p_source,
    p_delivery_address,  p_delivery_building, p_delivery_street,
    p_delivery_area,     p_delivery_lat,      p_delivery_lng,
    p_points_to_redeem,  p_loyalty_discount_bhd,
    p_coupon_id,
      CASE WHEN p_coupon_id IS NOT NULL THEN p_coupon_discount_bhd ELSE NULL END,
    NULL                 -- whatsapp_sent_at set later by notification job
  )
  RETURNING id INTO v_order_id;

  -- ── 5. Order items insert ──────────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      menu_item_slug, name_ar,     name_en,
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

  -- ── 6. Loyalty transaction (inserted after order so FK is satisfied) ──────────
  IF p_points_to_redeem > 0 THEN
    INSERT INTO points_transactions (
      customer_id, order_id,    points_earned, points_spent,
      balance_after, transaction_type, description
    ) VALUES (
      v_customer.id, v_order_id, 0,             p_points_to_redeem,
      v_new_balance, 'redeemed',
      'Redeemed for order #' || UPPER(SUBSTRING(v_order_id::TEXT FROM 1 FOR 8))
    );
  END IF;

  RETURN v_order_id;

END;
$$;

-- ── Permissions ────────────────────────────────────────────────────────────────
-- Revoke default public execute, then grant to the two client-facing roles.
-- (service_role has superuser-equivalent access and does not require an explicit grant.)
REVOKE EXECUTE ON FUNCTION rpc_create_order(
  TEXT, TEXT, TEXT, UUID, TEXT, JSONB, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT,
  UUID, NUMERIC, INT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rpc_create_order(
  TEXT, TEXT, TEXT, UUID, TEXT, JSONB, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT,
  UUID, NUMERIC, INT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

GRANT EXECUTE ON FUNCTION rpc_create_order(
  TEXT, TEXT, TEXT, UUID, TEXT, JSONB, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT,
  UUID, NUMERIC, INT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ
) TO anon;
