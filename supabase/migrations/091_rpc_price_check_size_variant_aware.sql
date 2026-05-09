-- ============================================================
-- Kahramana Baghdad — Make rpc_create_order price guard size/variant-aware
-- Migration: 091_rpc_price_check_size_variant_aware.sql
--
-- Problem fixed (QA 2026-05-09 — docs/qa/waiter-table-qa.md, step 6):
--   Session 80 commit b65fe6c shipped additive size+variant pricing in
--   VariantPicker / resolveCheckoutMenuItemPrice — submitted unit_price_bhd
--   for an item with a selected size now equals (base + size_delta).
--   The PRICE_MISMATCH guard added in 064 / 083 / 086 only bypasses the
--   check when (a) menu_items_sync.price_bhd IS NULL, or (b) the line
--   has modifiers — neither case covers size/variant selections.
--   Result: every waiter / POS / QR / customer order with a selected
--   size or variant raised PRICE_MISMATCH.
--
-- Fix:
--   Extend the bypass to also skip the strict equality check when the
--   line has selected_size or selected_variant set. Server actions
--   (resolveCheckoutMenuItemPrice in src/lib/menu.ts) already validate
--   these values against the canonical static menu data before submission.
--   Function signature, parameter list, GRANTS, and all other behaviour
--   are preserved verbatim from migration 086.
--
-- Trade-off:
--   A direct rpc_create_order caller could spoof selected_size to bypass
--   the check. This relies on the same trust model already used for
--   modifiers since 083, plus auth.uid() / RLS gating in 064. Long-term
--   mitigation: store size/variant prices in DB tables and recompute.
--
-- ROLLBACK:
--   Re-run the function definition from migration 086.
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_create_order(
  p_idempotency_key      TEXT,
  p_customer_name        TEXT,
  p_customer_phone       TEXT,
  p_branch_id            TEXT,
  p_order_type           TEXT,
  p_items                JSONB,
  p_total_bhd            NUMERIC,
  p_notes                TEXT        DEFAULT NULL,
  p_customer_notes       TEXT        DEFAULT NULL,
  p_delivery_address     TEXT        DEFAULT NULL,
  p_delivery_city        TEXT        DEFAULT NULL,
  p_delivery_building    TEXT        DEFAULT NULL,
  p_delivery_street      TEXT        DEFAULT NULL,
  p_delivery_area        TEXT        DEFAULT NULL,
  p_delivery_lat         NUMERIC     DEFAULT NULL,
  p_delivery_lng         NUMERIC     DEFAULT NULL,
  p_source               TEXT        DEFAULT 'direct',
  p_coupon_id            UUID        DEFAULT NULL,
  p_coupon_discount_bhd  NUMERIC     DEFAULT 0,
  p_points_to_redeem     INT         DEFAULT 0,
  p_payment_method       TEXT        DEFAULT 'cash',
  p_status               TEXT        DEFAULT 'new',
  p_loyalty_discount_bhd NUMERIC     DEFAULT 0,
  p_expires_at           TIMESTAMPTZ DEFAULT NULL,
  p_customer_id          UUID        DEFAULT NULL,
  p_table_number         INT         DEFAULT NULL,
  p_promotion_id         UUID        DEFAULT NULL,
  p_promotion_discount_bhd NUMERIC   DEFAULT 0
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
  v_promotion         promotions%ROWTYPE;
  v_customer          customer_profiles%ROWTYPE;
  v_new_balance       INT;
  v_item              JSONB;
  v_status            order_status;
  v_expires_at        TIMESTAMPTZ;
  v_calculated_total  NUMERIC;
  v_points_discount   NUMERIC;
  v_promo_discount    NUMERIC;
  v_final_total       NUMERIC;
  v_customer_phone    TEXT;
  v_effective_cid     UUID;
BEGIN

  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  v_customer_phone := p_customer_phone;
  IF auth.uid() IS NOT NULL THEN
    SELECT phone INTO v_customer_phone
    FROM   customer_profiles
    WHERE  id = auth.uid();
    IF NOT FOUND THEN
      v_customer_phone := p_customer_phone;
    END IF;
  END IF;

  SELECT id INTO v_existing_id
  FROM   orders
  WHERE  idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_existing_id; END IF;

  -- PRICE_MISMATCH guard
  -- Bypass cases: (a) menu_items_sync.price_bhd IS NULL,
  --               (b) line has modifiers,
  --               (c) line has selected_size, OR
  --               (d) line has selected_variant.
  -- Cases (c) and (d) added in migration 091 — additive size/variant
  -- pricing is validated server-side by resolveCheckoutMenuItemPrice.
  IF EXISTS (
    SELECT 1
    FROM   jsonb_array_elements(p_items) AS item
    JOIN   menu_items_sync mis ON mis.slug = item->>'menu_item_slug'
    WHERE  mis.price_bhd IS NOT NULL
      AND  COALESCE(jsonb_array_length(item->'modifiers'), 0) = 0
      AND  COALESCE(item->>'selected_size',    '') = ''
      AND  COALESCE(item->>'selected_variant', '') = ''
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

  IF p_coupon_id IS NOT NULL THEN
    SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'COUPON_INVALID: coupon not found'; END IF;
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
    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = p_coupon_id;
  END IF;

  -- Promotion validation + atomic use_count increment.
  v_promo_discount := COALESCE(p_promotion_discount_bhd, 0);
  IF p_promotion_id IS NOT NULL THEN
    IF v_promo_discount < 0 THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: discount cannot be negative';
    END IF;
    IF v_promo_discount > v_calculated_total THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: discount exceeds order subtotal';
    END IF;
    SELECT * INTO v_promotion FROM promotions WHERE id = p_promotion_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion not found';
    END IF;
    IF NOT v_promotion.is_active THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion inactive';
    END IF;
    IF v_promotion.branch_id IS NOT NULL AND v_promotion.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion not valid for this branch';
    END IF;
    IF v_promotion.starts_at IS NOT NULL AND v_promotion.starts_at > NOW() THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion has not started';
    END IF;
    IF v_promotion.ends_at IS NOT NULL AND v_promotion.ends_at < NOW() THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion has expired';
    END IF;
    IF v_promotion.max_uses IS NOT NULL
       AND v_promotion.use_count >= v_promotion.max_uses THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: usage limit reached';
    END IF;
    UPDATE promotions SET use_count = use_count + 1 WHERE id = p_promotion_id;
  ELSE
    v_promo_discount := 0;
  END IF;

  IF p_points_to_redeem > 0 THEN
    v_effective_cid := COALESCE(auth.uid(), p_customer_id);
    IF v_effective_cid IS NULL THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: authentication required to redeem points';
    END IF;
    SELECT * INTO v_customer FROM customer_profiles WHERE id = v_effective_cid FOR UPDATE;
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
    UPDATE customer_profiles SET points_balance = v_new_balance WHERE id = v_customer.id;
  ELSE
    v_points_discount := 0;
  END IF;

  v_status := CASE
    WHEN p_source IN ('manual', 'waiter', 'qr')
      THEN 'accepted'::order_status
    WHEN p_payment_method IN ('tap', 'benefit_pay', 'online')
      THEN 'pending_payment'::order_status
    ELSE 'new'::order_status
  END;

  v_expires_at := CASE
    WHEN v_status = 'pending_payment' THEN NOW() + INTERVAL '30 minutes'
    ELSE NULL
  END;

  v_final_total := GREATEST(
    0.001,
    v_calculated_total
      - COALESCE(p_coupon_discount_bhd, 0)
      - v_points_discount
      - v_promo_discount
  );

  INSERT INTO orders (
    idempotency_key,
    customer_name,       customer_phone,    branch_id,
    order_type,          status,            total_bhd,          expires_at,
    notes,               customer_notes,    source,
    delivery_address,    delivery_city,     delivery_building,
    delivery_street,     delivery_area,     delivery_lat,       delivery_lng,
    loyalty_points_redeemed, loyalty_discount_bhd,
    coupon_id,           coupon_discount_bhd,
    promotion_id,        promotion_discount_bhd,
    table_number,
    whatsapp_sent_at
  ) VALUES (
    p_idempotency_key,
    p_customer_name,     v_customer_phone,  p_branch_id,
    p_order_type,        v_status,          v_final_total,      v_expires_at,
    p_notes,             p_customer_notes,  p_source,
    p_delivery_address,  p_delivery_city,   p_delivery_building,
    p_delivery_street,   p_delivery_area,   p_delivery_lat,     p_delivery_lng,
    p_points_to_redeem,  v_points_discount,
    p_coupon_id,
      CASE WHEN p_coupon_id IS NOT NULL THEN p_coupon_discount_bhd ELSE NULL END,
    p_promotion_id,
      CASE WHEN p_promotion_id IS NOT NULL THEN v_promo_discount ELSE 0 END,
    p_table_number,
    NULL
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      menu_item_slug, name_ar,          name_en,
      selected_size,  selected_variant,
      quantity,       notes,
      unit_price_bhd, item_total_bhd,
      modifiers
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
      (v_item->>'item_total_bhd')::NUMERIC,
      COALESCE(v_item->'modifiers', '[]'::jsonb)
    );
  END LOOP;

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

GRANT EXECUTE ON FUNCTION rpc_create_order(
  TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
  TEXT, UUID, NUMERIC, INT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, UUID, INT,
  UUID, NUMERIC
) TO authenticated, anon, service_role;
