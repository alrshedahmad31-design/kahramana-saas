-- ============================================================
-- Kahramana Baghdad — Staff Management System
-- Migration: 017_staff_management_system.sql
-- Phase 7: Sprint 7A — Workforce Management
-- Applied: 2026-04-29
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── Extended staff_basic columns ──────────────────────────────────────────────

ALTER TABLE staff_basic
  ADD COLUMN IF NOT EXISTS hire_date               DATE,
  ADD COLUMN IF NOT EXISTS employment_type         TEXT DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','temporary')),
  ADD COLUMN IF NOT EXISTS hourly_rate             DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS phone                   TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS id_number               TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth           DATE,
  ADD COLUMN IF NOT EXISTS address                 TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url       TEXT,
  ADD COLUMN IF NOT EXISTS staff_notes             TEXT,
  ADD COLUMN IF NOT EXISTS clock_pin               CHAR(4);

-- ── Shifts ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID  NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  branch_id  TEXT  REFERENCES branches(id),
  shift_date DATE  NOT NULL,
  start_time TIME  NOT NULL,
  end_time   TIME  NOT NULL,
  position   TEXT,
  status     TEXT  NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes      TEXT,
  created_by UUID  REFERENCES staff_basic(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_date   ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff  ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id, shift_date);

-- ── Time entries (clock in/out) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID  NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  shift_id       UUID  REFERENCES shifts(id),
  clock_in       TIMESTAMPTZ NOT NULL,
  clock_out      TIMESTAMPTZ,
  break_minutes  INTEGER NOT NULL DEFAULT 0,
  total_hours    DECIMAL(5,2),
  overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  approved_by    UUID  REFERENCES staff_basic(id),
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_staff ON time_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date  ON time_entries(DATE(clock_in));

-- ── Leave requests ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leave_requests (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID  NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  leave_type     TEXT  NOT NULL
    CHECK (leave_type IN ('annual','sick','emergency','unpaid','other')),
  start_date     DATE  NOT NULL,
  end_date       DATE  NOT NULL,
  days_count     INTEGER NOT NULL CHECK (days_count > 0),
  reason         TEXT,
  status         TEXT  NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by    UUID  REFERENCES staff_basic(id),
  reviewed_at    TIMESTAMPTZ,
  reviewer_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_staff  ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- ── Shift swap requests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID  NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  from_staff_id UUID  NOT NULL REFERENCES staff_basic(id),
  to_staff_id   UUID  REFERENCES staff_basic(id),
  reason        TEXT,
  status        TEXT  NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','cancelled')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by   UUID  REFERENCES staff_basic(id),
  reviewed_at   TIMESTAMPTZ
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Service role bypasses (for time clock server action)
CREATE POLICY "service_all_shifts"        ON shifts              FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_time_entries"  ON time_entries        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_leaves"        ON leave_requests      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_swaps"         ON shift_swap_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Staff view own data
CREATE POLICY "auth_view_own_shifts"  ON shifts        FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "auth_view_own_entries" ON time_entries  FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "auth_view_own_leaves"  ON leave_requests FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "auth_create_own_leave" ON leave_requests FOR INSERT TO authenticated WITH CHECK (staff_id = auth.uid());

-- Managers manage everything
CREATE POLICY "managers_all_shifts" ON shifts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')));

CREATE POLICY "managers_all_entries" ON time_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')));

CREATE POLICY "managers_all_leaves" ON leave_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')));

CREATE POLICY "managers_all_swaps" ON shift_swap_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_basic WHERE id = auth.uid() AND role IN ('owner','general_manager','branch_manager')));

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS shift_swap_requests;
-- DROP TABLE IF EXISTS leave_requests;
-- DROP TABLE IF EXISTS time_entries;
-- DROP TABLE IF EXISTS shifts;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS hire_date;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS employment_type;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS hourly_rate;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS phone;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS emergency_contact_name;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS emergency_contact_phone;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS id_number;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS date_of_birth;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS address;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS profile_photo_url;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS staff_notes;
-- ALTER TABLE staff_basic DROP COLUMN IF EXISTS clock_pin;
