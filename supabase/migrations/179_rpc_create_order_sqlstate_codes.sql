-- 179_rpc_create_order_sqlstate_codes.sql
-- PUB-007 extension: switch rpc_create_order sentinel matching from
-- error.message substring to SQLSTATE codes.
--
-- Mirrors migration 174 (rpc_create_reservation). The JS caller
-- (src/app/[locale]/checkout/actions.ts:722-746) currently discriminates
-- COUPON_INVALID / INSUFFICIENT_POINTS / POINTS_OVER_CAP / PRICE_MISMATCH
-- / AUTH_REQUIRED via rpcError.message.includes(...). A future RPC
-- refactor that wraps error context would silently degrade these
-- branches to the generic toSafeError fallback.
--
-- Convention: one SQLSTATE per logical error class, regardless of how
-- many internal branches raise it. Reuses KH001 from migration 174 for
-- AUTH_REQUIRED so the code maps to the same caller meaning across
-- RPCs. New codes KH015..KH021 for the remaining classes.
--
-- KH015 — PRICE_MISMATCH
-- KH016 — INVALID_TOTAL
-- KH017 — COUPON_INVALID (covers all 5 internal branches)
-- KH018 — PROMOTION_INVALID (covers all 8 internal branches)
-- KH019 — INSUFFICIENT_POINTS (covers all 4 internal branches)
-- KH020 — POINTS_OVER_CAP
-- KH021 — INVALID_PAYMENT_MODE
--
-- Class "KH" is free per migration 174 (verified against migrations
-- 000-178). MESSAGE text is preserved verbatim so existing Sentry /
-- log lines stay readable.
--
-- Body is otherwise identical to migration 164. CREATE OR REPLACE
-- keeps GRANTs intact, so no REVOKE/GRANT block needed here.
-- SAFE TO RE-RUN.

CREATE OR REPLACE FUNCTION public.rpc_create_order(
  p_idempotency_key        text,
  p_customer_name          text,
  p_customer_phone         text,
  p_branch_id              text,
  p_order_type             text,
  p_items                  jsonb,
  p_total_bhd              numeric,
  p_notes                  text DEFAULT NULL::text,
  p_customer_notes         text DEFAULT NULL::text,
  p_delivery_address       text DEFAULT NULL::text,
  p_delivery_city          text DEFAULT NULL::text,
  p_delivery_building      text DEFAULT NULL::text,
  p_delivery_street        text DEFAULT NULL::text,
  p_delivery_area          text DEFAULT NULL::text,
  p_delivery_lat           numeric DEFAULT NULL::numeric,
  p_delivery_lng           numeric DEFAULT NULL::numeric,
  p_source                 text DEFAULT 'direct'::text,
  p_coupon_id              uuid DEFAULT NULL::uuid,
  p_coupon_discount_bhd    numeric DEFAULT 0,
  p_points_to_redeem       integer DEFAULT 0,
  p_payment_method         text DEFAULT 'cash'::text,
  p_status                 text DEFAULT 'new'::text,
  p_loyalty_discount_bhd   numeric DEFAULT 0,
  p_expires_at             timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_customer_id            uuid DEFAULT NULL::uuid,
  p_table_number           integer DEFAULT NULL::integer,
  p_promotion_id           uuid DEFAULT NULL::uuid,
  p_promotion_discount_bhd numeric DEFAULT 0,
  p_delivery_flat          text DEFAULT NULL::text,
  p_payment_mode           text DEFAULT NULL::text,
  p_payment_expires_at     timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_payment_method    payment_method;
  v_payment_status    payment_status;
BEGIN

  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'KH001';
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
    RAISE EXCEPTION 'PRICE_MISMATCH: submitted unit_price_bhd does not match menu_items_sync'
      USING ERRCODE = 'KH015';
  END IF;

  SELECT COALESCE(
    SUM((item->>'unit_price_bhd')::NUMERIC * (item->>'quantity')::INT), 0
  )
  INTO v_calculated_total
  FROM jsonb_array_elements(p_items) AS item;

  IF v_calculated_total < 0.001 THEN
    RAISE EXCEPTION 'INVALID_TOTAL: order subtotal is zero or negative'
      USING ERRCODE = 'KH016';
  END IF;

  IF COALESCE(p_coupon_discount_bhd, 0) > v_calculated_total THEN
    RAISE EXCEPTION 'COUPON_INVALID: coupon discount exceeds order subtotal'
      USING ERRCODE = 'KH017';
  END IF;

  IF p_coupon_id IS NOT NULL THEN
    SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'COUPON_INVALID: coupon not found' USING ERRCODE = 'KH017';
    END IF;
    IF NOT v_coupon.is_active OR COALESCE(v_coupon.paused, FALSE) THEN
      RAISE EXCEPTION 'COUPON_INVALID: coupon inactive or paused' USING ERRCODE = 'KH017';
    END IF;
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
      RAISE EXCEPTION 'COUPON_INVALID: coupon has expired' USING ERRCODE = 'KH017';
    END IF;
    IF v_coupon.usage_limit IS NOT NULL
       AND v_coupon.usage_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'COUPON_INVALID: usage limit reached' USING ERRCODE = 'KH017';
    END IF;
    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = p_coupon_id;
  END IF;

  v_promo_discount := COALESCE(p_promotion_discount_bhd, 0);
  IF p_promotion_id IS NOT NULL THEN
    IF v_promo_discount < 0 THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: discount cannot be negative'
        USING ERRCODE = 'KH018';
    END IF;
    IF v_promo_discount > v_calculated_total THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: discount exceeds order subtotal'
        USING ERRCODE = 'KH018';
    END IF;
    SELECT * INTO v_promotion FROM promotions WHERE id = p_promotion_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion not found' USING ERRCODE = 'KH018';
    END IF;
    IF NOT v_promotion.is_active THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion inactive' USING ERRCODE = 'KH018';
    END IF;
    IF v_promotion.branch_id IS NOT NULL AND v_promotion.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion not valid for this branch'
        USING ERRCODE = 'KH018';
    END IF;
    IF v_promotion.starts_at IS NOT NULL AND v_promotion.starts_at > NOW() THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion has not started'
        USING ERRCODE = 'KH018';
    END IF;
    IF v_promotion.ends_at IS NOT NULL AND v_promotion.ends_at < NOW() THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: promotion has expired'
        USING ERRCODE = 'KH018';
    END IF;
    IF v_promotion.max_uses IS NOT NULL
       AND v_promotion.use_count >= v_promotion.max_uses THEN
      RAISE EXCEPTION 'PROMOTION_INVALID: usage limit reached'
        USING ERRCODE = 'KH018';
    END IF;
    UPDATE promotions SET use_count = use_count + 1 WHERE id = p_promotion_id;
  ELSE
    v_promo_discount := 0;
  END IF;

  IF p_points_to_redeem > 0 THEN
    v_effective_cid := COALESCE(auth.uid(), p_customer_id);
    IF v_effective_cid IS NULL THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: authentication required to redeem points'
        USING ERRCODE = 'KH019';
    END IF;
    SELECT * INTO v_customer FROM customer_profiles WHERE id = v_effective_cid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: customer profile not found'
        USING ERRCODE = 'KH019';
    END IF;
    IF p_points_to_redeem < 200 THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS: minimum redemption is 200 points'
        USING ERRCODE = 'KH019';
    END IF;
    IF v_customer.points_balance < p_points_to_redeem THEN
      RAISE EXCEPTION
        'INSUFFICIENT_POINTS: balance % < requested %',
        v_customer.points_balance, p_points_to_redeem
        USING ERRCODE = 'KH019';
    END IF;
    v_points_discount := p_points_to_redeem::NUMERIC * 0.005;
    IF v_points_discount > (v_calculated_total * 0.5) THEN
      RAISE EXCEPTION 'POINTS_OVER_CAP: points discount exceeds 50%% of order subtotal'
        USING ERRCODE = 'KH020';
    END IF;
    v_new_balance := v_customer.points_balance - p_points_to_redeem;
    UPDATE customer_profiles SET points_balance = v_new_balance WHERE id = v_customer.id;
  ELSE
    v_points_discount := 0;
  END IF;

  v_status := CASE
    WHEN p_payment_method = 'tap'
      THEN 'pending_payment'::order_status
    WHEN p_payment_method = 'cash' AND p_source IN ('manual', 'waiter', 'qr')
      THEN 'accepted'::order_status
    WHEN p_source IN ('manual', 'waiter', 'qr')
      THEN 'accepted'::order_status
    WHEN p_payment_method IN ('benefit_pay', 'online')
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
    delivery_street,     delivery_area,     delivery_flat,
    delivery_lat,        delivery_lng,
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
    p_delivery_street,   p_delivery_area,   p_delivery_flat,
    p_delivery_lat,      p_delivery_lng,
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

  IF p_coupon_id IS NOT NULL THEN
    v_effective_cid := COALESCE(auth.uid(), p_customer_id);
    IF v_effective_cid IS NOT NULL THEN
      INSERT INTO coupon_usages (
        coupon_id,           customer_id,
        order_id,            discount_amount_bhd,
        per_customer_limit
      ) VALUES (
        p_coupon_id,         v_effective_cid,
        v_order_id,          COALESCE(p_coupon_discount_bhd, 0),
        v_coupon.per_customer_limit
      );
    END IF;
  END IF;

  IF p_payment_mode IS NOT NULL THEN
    IF p_payment_mode = 'cod' THEN
      v_payment_method := 'cash'::payment_method;
      v_payment_status := 'pending_cod'::payment_status;
    ELSIF p_payment_mode = 'online' THEN
      v_payment_method := NULL;
      v_payment_status := 'pending'::payment_status;
    ELSIF p_payment_mode = 'tap_card' THEN
      v_payment_method := 'tap_card'::payment_method;
      v_payment_status := 'pending'::payment_status;
    ELSE
      RAISE EXCEPTION 'INVALID_PAYMENT_MODE: %', p_payment_mode
        USING ERRCODE = 'KH021';
    END IF;

    INSERT INTO payments (
      order_id,   amount_bhd,    method,           status,
      expires_at
    ) VALUES (
      v_order_id, v_final_total, v_payment_method, v_payment_status,
      p_payment_expires_at
    );
  END IF;

  RETURN v_order_id;

END;
$function$;
