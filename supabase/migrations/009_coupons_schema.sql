-- ── Phase 5B: Coupon System ───────────────────────────────────────────────────

-- ── Enum ─────────────────────────────────────────────────────────────────────

CREATE TYPE coupon_type AS ENUM ('percentage', 'fixed_amount');

-- ── Coupons table ─────────────────────────────────────────────────────────────

CREATE TABLE coupons (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text          UNIQUE NOT NULL,
  type                 coupon_type   NOT NULL,
  value                numeric(10,2) NOT NULL CHECK (value > 0),
  description_ar       text,
  description_en       text,
  min_order_value_bhd  numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order_value_bhd >= 0),
  max_discount_bhd     numeric(10,2)           CHECK (max_discount_bhd > 0),
  usage_limit          int                     CHECK (usage_limit > 0),
  usage_count          int           NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  per_customer_limit   int           NOT NULL DEFAULT 1 CHECK (per_customer_limit > 0),
  valid_from           timestamptz   NOT NULL DEFAULT now(),
  valid_until          timestamptz,
  is_active            boolean       NOT NULL DEFAULT true,
  created_by           uuid          REFERENCES staff_basic(id) ON DELETE SET NULL,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_uppercase  CHECK (code = UPPER(code)),
  CONSTRAINT coupons_valid_range     CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT coupons_percentage_cap  CHECK (type <> 'percentage' OR value BETWEEN 1 AND 100)
);

-- ── Coupon usages table ───────────────────────────────────────────────────────

CREATE TABLE coupon_usages (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id            uuid          NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  customer_id          uuid          REFERENCES customer_profiles(id) ON DELETE SET NULL,
  order_id             uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount_bhd  numeric(10,2) NOT NULL,
  used_at              timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT coupon_usages_unique_order UNIQUE (order_id)
);

-- ── Add coupon columns to orders ──────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id            uuid REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount_bhd  numeric(10,2);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE coupons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

-- Public can read active coupons (needed for checkout validation)
CREATE POLICY "public_read_active_coupons"
  ON coupons FOR SELECT
  USING (is_active = true);

-- Staff (manager+) can read ALL coupons including inactive
CREATE POLICY "staff_read_all_coupons"
  ON coupons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
        AND is_active = true
    )
  );

-- Staff (manager+) can insert/update coupons
CREATE POLICY "staff_manage_coupons"
  ON coupons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
        AND is_active = true
    )
  );

-- Authenticated users can record their own coupon usage
CREATE POLICY "authenticated_insert_coupon_usage"
  ON coupon_usages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Customers can read their own usages
CREATE POLICY "customer_read_own_usages"
  ON coupon_usages FOR SELECT
  USING (auth.uid() = customer_id);

-- Staff can read all usages
CREATE POLICY "staff_read_all_usages"
  ON coupon_usages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
        AND is_active = true
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_coupons_code            ON coupons (code);
CREATE INDEX idx_coupons_active_dates    ON coupons (is_active, valid_from, valid_until);
CREATE INDEX idx_coupon_usages_coupon    ON coupon_usages (coupon_id);
CREATE INDEX idx_coupon_usages_customer  ON coupon_usages (customer_id, coupon_id);
CREATE INDEX idx_orders_coupon           ON orders (coupon_id) WHERE coupon_id IS NOT NULL;

-- ── RPC: atomic usage_count increment ────────────────────────────────────────
-- Uses UPDATE ... RETURNING to ensure atomicity without explicit locking

CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET usage_count = usage_count + 1
  WHERE id = p_coupon_id
    AND (usage_limit IS NULL OR usage_count < usage_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
