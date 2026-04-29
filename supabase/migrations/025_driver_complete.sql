-- ============================================================
-- Kahramana Baghdad — Driver Complete Data Layer
-- Migration: 025_driver_complete.sql
-- Applied: 2026-04-29
-- ============================================================

DO $$
BEGIN
  -- Structured delivery address fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_building') THEN
    ALTER TABLE orders ADD COLUMN delivery_building TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_street') THEN
    ALTER TABLE orders ADD COLUMN delivery_street TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_area') THEN
    ALTER TABLE orders ADD COLUMN delivery_area TEXT;
  END IF;

  -- Timing fields for urgency + on-time tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='expected_delivery_time') THEN
    ALTER TABLE orders ADD COLUMN expected_delivery_time TIMESTAMPTZ;
  END IF;

  -- Notes fields (separate concerns)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_notes') THEN
    ALTER TABLE orders ADD COLUMN customer_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_notes') THEN
    ALTER TABLE orders ADD COLUMN driver_notes TEXT;
  END IF;
END $$;
