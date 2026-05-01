-- ============================================================
-- Kahramana Baghdad — Driver Availability Status
-- Migration: 031_driver_availability.sql
--
-- Problem: No way for drivers to check in/out.
--   Dispatch board showed all non-delivering drivers as "available"
--   even when they were offline — causing empty driver list errors.
--
-- Fix: Add availability_status column to staff_basic.
--   Drivers toggle it from the Driver PWA header.
--   Delivery board only shows drivers with status 'online' as available.
-- ============================================================

ALTER TABLE staff_basic
  ADD COLUMN IF NOT EXISTS availability_status TEXT
  DEFAULT 'offline'
  CHECK (availability_status IN ('online', 'offline', 'busy'));

-- Active drivers already in the system are presumed available
UPDATE staff_basic
SET    availability_status = 'online'
WHERE  role = 'driver'
  AND  is_active = TRUE;
