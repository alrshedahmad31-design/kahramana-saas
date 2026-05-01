-- 029_driver_cash_handover.sql
-- Tracks end-of-shift cash handovers from drivers to restaurant managers.

CREATE TABLE driver_cash_handovers (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    UUID         NOT NULL REFERENCES staff_basic(id),
  shift_date   DATE         NOT NULL,
  total_cash   NUMERIC(10,3) NOT NULL CHECK (total_cash >= 0),
  order_ids    TEXT[]       NOT NULL DEFAULT '{}',
  handed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  received_by  UUID         REFERENCES staff_basic(id),
  verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_handovers_driver ON driver_cash_handovers(driver_id, shift_date);
CREATE INDEX idx_cash_handovers_date   ON driver_cash_handovers(shift_date);

ALTER TABLE driver_cash_handovers ENABLE ROW LEVEL SECURITY;

-- Driver: read own handovers
CREATE POLICY driver_cash_handovers_select_own ON driver_cash_handovers
  FOR SELECT
  USING (driver_id = auth.uid());

-- Driver: insert own handover
CREATE POLICY driver_cash_handovers_insert_own ON driver_cash_handovers
  FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Manager: read all handovers
CREATE POLICY manager_cash_handovers_select ON driver_cash_handovers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager')
        AND is_active = TRUE
    )
  );

-- Manager: verify/update handovers
CREATE POLICY manager_cash_handovers_update ON driver_cash_handovers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager')
        AND is_active = TRUE
    )
  );
