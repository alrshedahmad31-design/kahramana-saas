-- ============================================================
-- Kahramana Baghdad — Waitlist Management
-- Migration: 099_waitlist_entries.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  guest_name  TEXT NOT NULL,
  phone       TEXT NOT NULL CHECK (phone ~ '^\+973[0-9]{8}$'),
  party_size  SMALLINT NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  status      TEXT NOT NULL DEFAULT 'waiting'
              CHECK (status IN ('waiting', 'notified', 'seated', 'cancelled')),
  notes       TEXT,
  notified_at TIMESTAMPTZ,
  seated_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_branch_scope" ON waitlist_entries
  FOR ALL
  TO authenticated
  USING (
    branch_id = (SELECT branch_id FROM staff_basic WHERE id = auth.uid())
  )
  WITH CHECK (
    branch_id = (SELECT branch_id FROM staff_basic WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_waitlist_branch_status
  ON waitlist_entries(branch_id, status, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;

GRANT ALL ON waitlist_entries TO authenticated;

-- ROLLBACK:
-- DROP TABLE IF EXISTS waitlist_entries;
