-- ============================================================
-- Kahramana Baghdad — Contact Messages
-- Migration: 002_contact_messages.sql
-- Applied: 2026-04-28
-- ROLLBACK: see bottom of file
-- ============================================================

CREATE TABLE contact_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  phone      TEXT,
  branch_id  TEXT        REFERENCES branches(id),  -- TEXT matches branches.id PK
  message    TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'read', 'replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Public can submit contact messages (anonymous guest)
CREATE POLICY "contact_messages_insert_anon"
  ON contact_messages FOR INSERT TO anon WITH CHECK (true);

-- Staff can read all contact messages
CREATE POLICY "contact_messages_select_authenticated"
  ON contact_messages FOR SELECT TO authenticated USING (true);

-- Staff can update status (mark as read/replied)
CREATE POLICY "contact_messages_update_authenticated"
  ON contact_messages FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_contact_messages_status     ON contact_messages(status);

-- ============================================================
-- ROLLBACK:
--
-- DROP TABLE IF EXISTS contact_messages CASCADE;
-- ============================================================
