-- ============================================================
-- Kahramana Baghdad — Staff Complete (Permissions, Documents, Payroll)
-- Migration: 022_staff_complete.sql
-- Applied: 2026-04-29
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── staff_permissions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  permission   TEXT NOT NULL,
  granted_by   UUID REFERENCES staff_basic(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  UNIQUE (staff_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff ON staff_permissions(staff_id);

ALTER TABLE staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_permissions" ON staff_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "managers_read_permissions" ON staff_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager', 'branch_manager')
  ));

CREATE POLICY "managers_manage_permissions" ON staff_permissions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager')
  ));

CREATE POLICY "auth_view_own_permissions" ON staff_permissions
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- ── staff_documents ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('id_copy', 'contract', 'certificate', 'health_card', 'other')),
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size_kb  INTEGER,
  expiry_date   DATE,
  notes         TEXT,
  uploaded_by   UUID REFERENCES staff_basic(id),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON staff_documents(staff_id);

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_documents" ON staff_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "managers_all_documents" ON staff_documents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager', 'branch_manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager', 'branch_manager')
  ));

CREATE POLICY "auth_view_own_documents" ON staff_documents
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- ── staff_payroll ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_payroll (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  regular_hours   DECIMAL(7,2) NOT NULL DEFAULT 0,
  overtime_hours  DECIMAL(7,2) NOT NULL DEFAULT 0,
  hourly_rate     DECIMAL(10,2),
  base_pay        DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonuses         DECIMAL(10,2) NOT NULL DEFAULT 0,
  deductions      DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_pay         DECIMAL(10,2) GENERATED ALWAYS AS (base_pay + bonuses - deductions) STORED,
  currency        TEXT NOT NULL DEFAULT 'BHD',
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paid')),
  notes           TEXT,
  approved_by     UUID REFERENCES staff_basic(id),
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_payroll_staff  ON staff_payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON staff_payroll(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON staff_payroll(status);

ALTER TABLE staff_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_payroll" ON staff_payroll
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "owners_all_payroll" ON staff_payroll
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_basic
    WHERE id = auth.uid()
    AND role IN ('owner', 'general_manager')
  ));

CREATE POLICY "auth_view_own_payroll" ON staff_payroll
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid() AND status = 'paid');

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS staff_payroll;
-- DROP TABLE IF EXISTS staff_documents;
-- DROP TABLE IF EXISTS staff_permissions;
