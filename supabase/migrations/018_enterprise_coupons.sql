-- ── Phase 1: Database Enhancements for Premium Coupon Management ──────────────

-- 1. Enhance coupons table with enterprise features
ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS campaign_name TEXT,
ADD COLUMN IF NOT EXISTS discount_type TEXT, -- Support for: 'percentage', 'fixed', 'free_delivery', 'bogo', 'free_item'
ADD COLUMN IF NOT EXISTS max_discount_amount DECIMAL(10,2), -- Standardized naming
ADD COLUMN IF NOT EXISTS min_order_value DECIMAL(10,2), -- Standardized naming
ADD COLUMN IF NOT EXISTS applicable_branches TEXT[], -- array of branch IDs
ADD COLUMN IF NOT EXISTS applicable_items TEXT[], -- array of menu item IDs
ADD COLUMN IF NOT EXISTS applicable_categories TEXT[],
ADD COLUMN IF NOT EXISTS customer_segment TEXT DEFAULT 'all', -- 'all', 'new', 'returning', 'vip'
ADD COLUMN IF NOT EXISTS days_active INTEGER[], -- [0,1,2,3,4,5,6] (0 is Sunday)
ADD COLUMN IF NOT EXISTS time_start TIME,
ADD COLUMN IF NOT EXISTS time_end TIME,
ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_redemptions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue_impact DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- 2. Coupon redemptions tracking (detailed audit trail)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  order_total DECIMAL(10,2) NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON coupon_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_date ON coupon_redemptions(DATE(redeemed_at));

-- 3. Coupon templates (pre-made campaigns for quick launch)
CREATE TABLE IF NOT EXISTS coupon_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  suggested_min_order DECIMAL(10,2),
  suggested_max_uses INTEGER,
  category TEXT, -- 'seasonal', 'loyalty', 'acquisition', 'retention'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS Policies
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_templates ENABLE ROW LEVEL SECURITY;

-- Staff with marketing or management roles can access these
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_view_redemptions') THEN
    CREATE POLICY "staff_view_redemptions" ON coupon_redemptions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM staff_basic
        WHERE id = auth.uid()
          AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
          AND is_active = true
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_view_templates') THEN
    CREATE POLICY "staff_view_templates" ON coupon_templates FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM staff_basic
        WHERE id = auth.uid()
          AND role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
          AND is_active = true
      )
    );
  END IF;
END $$;

-- 5. Seed default templates
INSERT INTO coupon_templates (name, description, discount_type, discount_value, suggested_min_order, category) VALUES
('Welcome Discount', 'First order discount for new customers', 'percentage', 20, 15, 'acquisition'),
('Weekend Special', 'Weekend orders discount', 'percentage', 15, 20, 'seasonal'),
('Loyalty Reward', 'Thank you for being a valued customer', 'fixed', 5, 25, 'loyalty'),
('Free Delivery', 'Free delivery on all orders', 'free_delivery', 0, 15, 'retention'),
('Lunch Deal', 'Lunch time special', 'percentage', 25, 10, 'seasonal')
ON CONFLICT DO NOTHING;
