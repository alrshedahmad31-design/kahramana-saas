-- 038_cash_reconciliation_discrepancy.sql
-- Adds discrepancy workflow columns to driver_cash_handovers.
-- Backfills verified rows from the old boolean `verified` column.

ALTER TABLE driver_cash_handovers
  ADD COLUMN IF NOT EXISTS actual_received      NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS discrepancy          NUMERIC(10,3)
    GENERATED ALWAYS AS (COALESCE(actual_received, total_cash) - total_cash) STORED,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (reconciliation_status IN ('pending', 'verified', 'discrepancy', 'disputed')),
  ADD COLUMN IF NOT EXISTS manager_notes        TEXT,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ;

-- Backfill: rows already verified via old boolean → mark as verified
UPDATE driver_cash_handovers
SET    reconciliation_status = CASE WHEN verified THEN 'verified' ELSE 'pending' END,
       verified_at           = CASE WHEN verified THEN handed_at  ELSE NULL END,
       actual_received       = CASE WHEN verified THEN total_cash ELSE NULL END
WHERE  reconciliation_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_handovers_status
  ON driver_cash_handovers(reconciliation_status, handed_at DESC);

-- ROLLBACK:
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS actual_received CASCADE;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS discrepancy;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS reconciliation_status;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS manager_notes;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS verified_at;
--   DROP INDEX IF EXISTS idx_handovers_status;
