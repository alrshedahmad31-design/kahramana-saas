-- ============================================================
-- Kahramana Baghdad
-- Migration: 160_catering_inquiries.sql
--
-- First-party record of catering inquiries submitted through the
-- public /catering page form ("أخبرنا عن مناسبتك").
--
-- Today the form opens a pre-filled wa.me link and only writes to GA.
-- A wa.me handoff doesn't survive the customer never tapping "Send",
-- leaving lost leads invisible. This table persists every submission
-- so staff have an authoritative inbox even when the WhatsApp leg
-- fails or is abandoned.
--
-- Access model:
--   - Writes: service_role only (the catering server action uses
--     createServiceClient() — same pattern as contact_messages and
--     reservations). anon and authenticated have no INSERT.
--   - Reads:  service_role only. Dashboard pages that surface these
--     leads use createServiceClient(), matching the reservations
--     dashboard pattern. authenticated has no SELECT policy.
--   - Default DML grants are REVOKED from anon and authenticated
--     per the supabase_default_table_dml_grants memory — RLS alone
--     does not block grants.
--
-- Schema mirrors CateringInquiryValues in
--   src/lib/whatsapp-catering-message.ts
-- so the server action can map fields 1:1.
--
-- SAFE TO RE-RUN.
-- ROLLBACK: bottom of file.
-- ============================================================

CREATE TABLE IF NOT EXISTS catering_inquiries (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT         NOT NULL
                                   CHECK (char_length(name) BETWEEN 1 AND 200),
  phone             TEXT         NOT NULL
                                   CHECK (char_length(phone) BETWEEN 8 AND 30),
  occasion_type     TEXT         NOT NULL
                                   CHECK (char_length(occasion_type) BETWEEN 1 AND 80),
  event_date        DATE         NOT NULL,
  event_time        TIME,
  guest_count       INT          NOT NULL
                                   CHECK (guest_count > 0 AND guest_count <= 1000),
  area              TEXT         NOT NULL
                                   CHECK (char_length(area) BETWEEN 1 AND 300),
  service_type      TEXT         NOT NULL
                                   CHECK (char_length(service_type) BETWEEN 1 AND 80),
  preferred_branch  TEXT         REFERENCES branches(id) ON DELETE SET NULL,
  budget            TEXT         CHECK (budget IS NULL OR char_length(budget) <= 100),
  notes             TEXT         NOT NULL
                                   CHECK (char_length(notes) BETWEEN 1 AND 2000),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catering_inquiries_created_at
  ON catering_inquiries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catering_inquiries_preferred_branch
  ON catering_inquiries (preferred_branch)
  WHERE preferred_branch IS NOT NULL;

ALTER TABLE catering_inquiries ENABLE ROW LEVEL SECURITY;

-- No SELECT / INSERT / UPDATE / DELETE policies for anon or
-- authenticated. service_role bypasses RLS, which is the only intended
-- access path. RLS with no matching policy denies — that is the gate.

-- Belt and braces: strip the default Supabase grants that hand anon
-- and authenticated full DML on every public table (per the
-- supabase_default_table_dml_grants memory). Without this the RLS gate
-- is the only line of defence.
REVOKE ALL ON catering_inquiries FROM anon;
REVOKE ALL ON catering_inquiries FROM authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON catering_inquiries TO service_role;

-- ============================================================
-- ROLLBACK:
--
-- DROP INDEX IF EXISTS idx_catering_inquiries_preferred_branch;
-- DROP INDEX IF EXISTS idx_catering_inquiries_created_at;
-- DROP TABLE IF EXISTS catering_inquiries;
-- ============================================================
