-- ============================================================
-- Kahramana Baghdad — Cash Flow System
-- Migration: 056_cash_flow_system.sql
-- ============================================================

-- 1. Update orders table with cash handover tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_collected DECIMAL(10,3) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_handed_over BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create cash_handovers table
CREATE TABLE IF NOT EXISTS cash_handovers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id            UUID NOT NULL REFERENCES auth.users(id),
  branch_id            TEXT NOT NULL REFERENCES branches(id),
  expected_amount      DECIMAL(10,3) NOT NULL,
  actual_amount        DECIMAL(10,3) NOT NULL,
  difference           DECIMAL(10,3) GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
  manager_confirmed    BOOLEAN DEFAULT FALSE,
  confirmed_by         UUID REFERENCES auth.users(id) DEFAULT NULL,
  confirmed_at         TIMESTAMPTZ DEFAULT NULL,
  order_ids            UUID[] NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Security (RLS)
ALTER TABLE cash_handovers ENABLE ROW LEVEL SECURITY;

-- Select Policies
DROP POLICY IF EXISTS "Drivers can view their own handovers" ON cash_handovers;
CREATE POLICY "Drivers can view their own handovers"
  ON cash_handovers
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view branch handovers" ON cash_handovers;
CREATE POLICY "Managers can view branch handovers"
  ON cash_handovers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner', 'general_manager', 'branch_manager')
      AND (branch_id = cash_handovers.branch_id OR role IN ('owner', 'general_manager'))
    )
  );

-- Update Policy (for confirmation)
DROP POLICY IF EXISTS "Managers can confirm handovers" ON cash_handovers;
CREATE POLICY "Managers can confirm handovers"
  ON cash_handovers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner', 'general_manager', 'branch_manager')
      AND (branch_id = cash_handovers.branch_id OR role IN ('owner', 'general_manager'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner', 'general_manager', 'branch_manager')
      AND (branch_id = cash_handovers.branch_id OR role IN ('owner', 'general_manager'))
    )
  );

-- Service Role
DROP POLICY IF EXISTS "Service role full access" ON cash_handovers;
CREATE POLICY "Service role full access"
  ON cash_handovers
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_cash_handovers_driver ON cash_handovers(driver_id);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_branch ON cash_handovers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_confirmed ON cash_handovers(manager_confirmed) WHERE manager_confirmed = FALSE;
