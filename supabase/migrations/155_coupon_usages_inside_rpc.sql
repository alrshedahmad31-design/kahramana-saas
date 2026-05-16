-- ============================================================
-- Kahramana Baghdad
-- Migration: 155_coupon_usages_inside_rpc.sql
--
-- VULN-004 — per_customer_limit=1 was bypassable on multi-tab checkout.
-- rpc_create_order atomically increments coupons.usage_count under
-- a FOR UPDATE row lock, but the per-customer audit row was inserted
-- afterward in JS by checkout/actions.ts. Two parallel checkouts each
-- saw zero prior usages and both succeeded — per_customer_limit=1 was
-- not enforced.
--
-- This migration:
--   1. Adds a snapshot column `per_customer_limit` to coupon_usages so
--      a partial UNIQUE index can dedupe on a value that lives on the
--      indexed table (cross-table predicates aren't allowed).
--   2. Adds a partial UNIQUE INDEX on (coupon_id, customer_id) WHERE
--      per_customer_limit = 1 as the database-level backstop.
--   3. Moves the coupon_usages INSERT into rpc_create_order, executed
--      while the FOR UPDATE lock on coupons is still held (PG row locks
--      live until txn commit). The unique-violation now races to one
--      winner inside the same transaction as the usage_count increment.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_coupon_usages_one_per_customer;
--   ALTER TABLE coupon_usages DROP COLUMN IF EXISTS per_customer_limit;
--   -- (rpc_create_order would need to be restored from migration 134.)
-- ============================================================

-- 1. Snapshot column on coupon_usages.
ALTER TABLE coupon_usages
  ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER NOT NULL DEFAULT 1;

-- 2. Partial UNIQUE index — the DB backstop for per_customer_limit=1.
--    Limited to the rows where the snapshot says "one per customer", so
--    coupons with higher per-customer caps are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usages_one_per_customer
  ON coupon_usages (coupon_id, customer_id)
  WHERE per_customer_limit = 1;

-- 3. Replace rpc_create_order so the coupon_usages INSERT runs while the
--    coupons row is still locked FOR UPDATE.
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
  p_promotion_discount_bhd numeric DEFAULT 0
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

  -- PRICE_MISMATCH guard (091): bypass on null sync price, modifiers,
  -- selected_size, or selected_variant.
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

  -- VULN-104: payment_method takes priority over p_source. A 'tap' order
  -- must always pend gateway confirmation, even if the cashier marked the
  -- source as 'manual'. The previous source-first ordering let a manual+tap
  -- order skip 'pending_payment' and jump straight to 'accepted' without
  -- any authorised Tap transaction.
  v_status := CASE
    WHEN p_payment_method = 'tap'
      THEN 'pending_payment'::order_status
    WHEN p_payment_method = 'cash' AND p_source IN ('manual', 'waiter', 'qr')
      THEN 'accepted'::order_status
    -- Existing logic for manual/waiter/qr with non-tap, non-cash methods.
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

  -- VULN-004: log the coupon usage audit row INSIDE the RPC, while the
  -- FOR UPDATE lock taken on the coupons row is still held (PG row locks
  -- persist until txn commit). The partial UNIQUE INDEX on
  -- (coupon_id, customer_id) WHERE per_customer_limit = 1 then aborts
  -- the second of two parallel attempts.
  --
  -- per_customer_limit is snapshotted from v_coupon so the index predicate
  -- can live on the indexed table. Guests (no resolvable customer id) are
  -- not deduped — per-customer enforcement requires a stable identity.
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

  RETURN v_order_id;

END;
$function$;
