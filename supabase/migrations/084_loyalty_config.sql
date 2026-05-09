-- ============================================================
-- 084_loyalty_config.sql
-- Configurable loyalty parameters: points-per-BHD, redemption ratios, tier
-- thresholds. Replaces hardcoded constants in src/lib/loyalty/calculations.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS loyalty_config (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                TEXT,                                                -- NULL = global default
  points_per_bhd           INT           NOT NULL DEFAULT 10,
  max_redemption_ratio     NUMERIC(3,2)  NOT NULL DEFAULT 0.50,
  min_redemption_points    INT           NOT NULL DEFAULT 200,
  point_value_bhd          NUMERIC(8,4)  NOT NULL DEFAULT 0.005,
  points_expiry_months     INT           NOT NULL DEFAULT 12,
  tier_silver_threshold    INT           NOT NULL DEFAULT 500,
  tier_gold_threshold      INT           NOT NULL DEFAULT 1500,
  tier_platinum_threshold  INT           NOT NULL DEFAULT 5000,
  is_active                BOOLEAN       NOT NULL DEFAULT true,
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CHECK (points_per_bhd        > 0),
  CHECK (max_redemption_ratio  >= 0 AND max_redemption_ratio <= 1),
  CHECK (min_redemption_points >= 0),
  CHECK (point_value_bhd       > 0)
);

-- One global active config per (branch_id NULL) — partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_config_global_active
  ON loyalty_config (is_active)
  WHERE branch_id IS NULL AND is_active = true;

ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;

-- Public read: customer-facing checkout / account pages need to display rules
DROP POLICY IF EXISTS "loyalty_config public read" ON loyalty_config;
CREATE POLICY "loyalty_config public read"
  ON loyalty_config
  FOR SELECT
  TO public
  USING (true);

-- Owner / GM write only
DROP POLICY IF EXISTS "loyalty_config owner write" ON loyalty_config;
CREATE POLICY "loyalty_config owner write"
  ON loyalty_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  );

-- Seed with current hardcoded values (idempotent)
INSERT INTO loyalty_config (
  branch_id,
  points_per_bhd,
  max_redemption_ratio,
  min_redemption_points,
  point_value_bhd,
  points_expiry_months,
  tier_silver_threshold,
  tier_gold_threshold,
  tier_platinum_threshold,
  is_active
)
SELECT
  NULL, 10, 0.50, 200, 0.005, 12, 500, 1500, 5000, true
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_config WHERE branch_id IS NULL AND is_active = true
);
