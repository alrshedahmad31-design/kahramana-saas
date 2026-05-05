-- ============================================================
-- Kahramana Baghdad — Add 'returned' status to order_status
-- Migration: 054_add_returned_status.sql
-- ============================================================

-- ENUM values cannot be added within a transaction in some PG versions,
-- but Supabase allows it if handled correctly.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';
