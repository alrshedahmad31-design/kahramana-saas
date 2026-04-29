-- ============================================================
-- Kahramana Baghdad — Report Audit Log
-- Migration: 019_report_audit_log.sql
-- Applied: 2026-04-29
--
-- Purpose: Track every report generated — who, when, filters, row count.
-- Access: owner + general_manager only (RLS enforced).
--
-- ROLLBACK: DROP TABLE IF EXISTS report_audit_log;
-- ============================================================

CREATE TABLE IF NOT EXISTS report_audit_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name      TEXT        NOT NULL,
  report_type      TEXT        NOT NULL,
  generated_by     UUID        REFERENCES staff_basic(id) ON DELETE SET NULL,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filters          JSONB,
  row_count        INTEGER,
  data_snapshot    JSONB,
  export_format    TEXT        CHECK (export_format IN ('csv', 'excel', 'pdf', 'preview')),
  file_size_kb     INTEGER,
  validation_flags JSONB
);

CREATE INDEX IF NOT EXISTS idx_report_audit_generated_at
  ON report_audit_log (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_audit_type
  ON report_audit_log (report_type, generated_at DESC);

ALTER TABLE report_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_admins_only" ON report_audit_log
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  );
