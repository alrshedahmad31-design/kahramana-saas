-- ============================================================
-- 085_waiter_tables_and_qr_source.sql
-- Sprint: Waiter App + QR Ordering + Promotion Engine (1/2)
--
-- Adds:
--   1. restaurant_tables  — per-branch dine-in table registry
--   2. orders.table_number — dine-in table reference on orders
--   3. CHECK constraint on orders.source for 6 allowed values
--      (legacy 'direct' kept alongside the new 5: online/manual/waiter/kiosk/qr)
--   4. rpc_create_order  — extended with p_table_number; auto-accepts waiter/qr
--
-- Seed: 20 tables for 'riffa' + 20 tables for 'qallali' = 40 rows.
-- branches.id is TEXT (memory: feedback_rpc_create_order_signature).
--
-- SAFE TO RE-RUN.
-- ============================================================

-- ── 1. restaurant_tables ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     TEXT         NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  table_number  INT          NOT NULL CHECK (table_number > 0),
  label_ar      TEXT,
  label_en      TEXT,
  capacity      INT          NOT NULL DEFAULT 4 CHECK (capacity > 0),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_branch_active
  ON restaurant_tables (branch_id, is_active);

-- updated_at trigger
CREATE OR REPLACE FUNCTION restaurant_tables_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_tables_updated_at ON restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_updated_at
  BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION restaurant_tables_set_updated_at();

-- ── 2. RLS policies ───────────────────────────────────────────

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated staff member sees their own branch.
-- Owner / GM see every branch.
DROP POLICY IF EXISTS "restaurant_tables_select_staff" ON restaurant_tables;
CREATE POLICY "restaurant_tables_select_staff"
  ON restaurant_tables FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR branch_id = auth_user_branch_id()
  );

-- Write: owner / GM (any branch) or branch_manager (own branch only).
DROP POLICY IF EXISTS "restaurant_tables_insert_manager" ON restaurant_tables;
CREATE POLICY "restaurant_tables_insert_manager"
  ON restaurant_tables FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() IN ('owner', 'general_manager')
    OR (auth_user_role() = 'branch_manager' AND branch_id = auth_user_branch_id())
  );

DROP POLICY IF EXISTS "restaurant_tables_update_manager" ON restaurant_tables;
CREATE POLICY "restaurant_tables_update_manager"
  ON restaurant_tables FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR (auth_user_role() = 'branch_manager' AND branch_id = auth_user_branch_id())
  )
  WITH CHECK (
    auth_user_role() IN ('owner', 'general_manager')
    OR (auth_user_role() = 'branch_manager' AND branch_id = auth_user_branch_id())
  );

DROP POLICY IF EXISTS "restaurant_tables_delete_manager" ON restaurant_tables;
CREATE POLICY "restaurant_tables_delete_manager"
  ON restaurant_tables FOR DELETE TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR (auth_user_role() = 'branch_manager' AND branch_id = auth_user_branch_id())
  );

-- ── 3. Seed 20 tables per branch ──────────────────────────────

INSERT INTO restaurant_tables (branch_id, table_number, label_ar, label_en, capacity)
SELECT
  b.id,
  n,
  'طاولة ' || n,
  'Table ' || n,
  4
FROM (VALUES ('riffa'), ('qallali')) AS b(id)
CROSS JOIN generate_series(1, 20) AS n
ON CONFLICT (branch_id, table_number) DO NOTHING;

-- ── 4. orders.table_number ───────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number INT;

CREATE INDEX IF NOT EXISTS idx_orders_branch_table
  ON orders (branch_id, table_number)
  WHERE table_number IS NOT NULL;

-- ── 5. orders.source CHECK constraint ────────────────────────
-- No prior CHECK existed (column added 008 as plain TEXT NOT NULL DEFAULT 'direct').
-- 'direct' kept for legacy rows + RPC default; new sources: online, manual,
-- waiter, kiosk, qr.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('direct', 'online', 'manual', 'waiter', 'kiosk', 'qr'));

-- ── 6. rpc_create_order — extended ───────────────────────────
-- Changes vs 083:
--   + p_table_number INT param (defaults NULL)
--   + auto-accept when p_source IN ('manual', 'waiter', 'qr')
--   + INSERT writes table_number column
-- Everything else unchanged from 083.

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
  p_table_number         INT         DEFAULT NULL
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

  IF EXISTS (
    SELECT 1
    FROM   jsonb_array_elements(p_items) AS item
    JOIN   menu_items_sync mis ON mis.slug = item->>'menu_item_slug'
    WHERE  mis.price_bhd IS NOT NULL
      AND  COALESCE(jsonb_array_length(item->'modifiers'), 0) = 0
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

  -- Status routing:
  --   manual / waiter / qr → straight to 'accepted' (skip payment)
  --   tap / benefit_pay / online → 'pending_payment' (30-min expiry)
  --   else → 'new'
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
  TEXT, UUID, NUMERIC, INT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, UUID, INT
) TO authenticated, anon, service_role;
