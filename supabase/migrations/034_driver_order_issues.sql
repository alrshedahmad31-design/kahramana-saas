-- ============================================================
-- Kahramana Baghdad — Driver Order Issues
-- Migration: 034_driver_order_issues.sql
--
-- Minimal issue-reporting table for drivers to flag problems
-- (no-answer, unclear address, vehicle trouble, etc.) on orders
-- assigned to them. Visible to branch managers and above in the
-- dashboard/delivery board.
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_order_issues (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id  UUID        NOT NULL REFERENCES staff_basic(id),
  reason     TEXT        NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_order_issues ENABLE ROW LEVEL SECURITY;

-- Driver: may insert issues only for orders they own (server-side enforced too)
CREATE POLICY "driver_issue_insert"
  ON driver_order_issues FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND role = 'driver' AND is_active = TRUE
    )
  );

-- Driver: read own; non-driver staff: read branch issues; globals: read all
CREATE POLICY "driver_issue_select"
  ON driver_order_issues FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM staff_basic s
      WHERE  s.id        = auth.uid()
        AND  s.is_active = TRUE
        AND  s.role     != 'driver'
        AND  (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = (SELECT branch_id FROM orders WHERE id = order_id)
        )
    )
  );

-- Index for dashboard queries by order
CREATE INDEX IF NOT EXISTS driver_order_issues_order_id_idx
  ON driver_order_issues(order_id);

-- Index for driver's own history
CREATE INDEX IF NOT EXISTS driver_order_issues_driver_id_idx
  ON driver_order_issues(driver_id);

-- ============================================================
-- ROLLBACK:
--   DROP TABLE IF EXISTS driver_order_issues;
-- ============================================================
