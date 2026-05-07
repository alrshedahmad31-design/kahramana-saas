-- ============================================================
-- Kahramana Baghdad — Shift Closing System
-- Migration: 071_shift_closing.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS shift_closings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES branches(id),
  closed_by           UUID NOT NULL REFERENCES staff_basic(id),
  shift_date          DATE NOT NULL,
  shift_type          TEXT NOT NULL CHECK (shift_type IN ('morning','evening','night')),
  expected_cash_bhd   NUMERIC(10,3) NOT NULL DEFAULT 0,
  actual_cash_bhd     NUMERIC(10,3) NOT NULL DEFAULT 0,
  difference_bhd      NUMERIC(10,3) GENERATED ALWAYS AS (actual_cash_bhd - expected_cash_bhd) STORED,
  total_orders        INTEGER NOT NULL DEFAULT 0,
  total_revenue_bhd   NUMERIC(10,3) NOT NULL DEFAULT 0,
  notes               TEXT,
  discrepancy_reason  TEXT,
  manager_signature   TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','flagged')),
  approved_by         UUID REFERENCES staff_basic(id),
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE shift_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read_own_branch_shifts ON shift_closings;
CREATE POLICY staff_read_own_branch_shifts ON shift_closings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND (
        role IN ('owner','general_manager') OR
        (role IN ('branch_manager','cashier') AND branch_id = shift_closings.branch_id)
      )
    )
  );

DROP POLICY IF EXISTS staff_insert_shift ON shift_closings;
CREATE POLICY staff_insert_shift ON shift_closings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('branch_manager','cashier','owner','general_manager')
    )
  );

DROP POLICY IF EXISTS gm_approve_shift ON shift_closings;
CREATE POLICY gm_approve_shift ON shift_closings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner','general_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner','general_manager')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_closings_branch_date ON shift_closings(branch_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_shift_closings_status ON shift_closings(status);
