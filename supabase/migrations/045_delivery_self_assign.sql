-- ============================================================
-- Kahramana Baghdad — Delivery Self-Assign
-- Migration: 045_delivery_self_assign.sql
-- ============================================================
-- Adds: delivery_apartment column for structured address storage.
-- RLS for driver self-assign and mark-delivered is enforced at
-- the server-action layer (service client + session checks).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_apartment'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_apartment TEXT;
  END IF;
END $$;
