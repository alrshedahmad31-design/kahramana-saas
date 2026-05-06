-- Migration: 060_driver_locations_rls.sql
-- Description: Hardening RLS for driver_locations and adding support for upserting current location.

-- 1. Schema Updates
ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add a unique constraint to allow upserting the "current" location for an active order
-- This ensures the table doesn't grow indefinitely with every 15s ping for the same order
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_locations_driver_order_key') THEN
    ALTER TABLE driver_locations ADD CONSTRAINT driver_locations_driver_order_key UNIQUE (driver_id, order_id);
  END IF;
END $$;

-- 2. RLS Policies
DROP POLICY IF EXISTS "driver_location_insert_own" ON driver_locations;
DROP POLICY IF EXISTS "driver_location_select_own" ON driver_locations;
DROP POLICY IF EXISTS "driver_write_own_location" ON driver_locations;
DROP POLICY IF EXISTS "driver_update_own_location" ON driver_locations;
DROP POLICY IF EXISTS "manager_read_branch_driver_locations" ON driver_locations;

-- Driver can only write own location
CREATE POLICY "driver_write_own_location"
  ON driver_locations FOR INSERT TO authenticated
  WITH CHECK (driver_id::text = auth.uid()::text);

CREATE POLICY "driver_update_own_location"  
  ON driver_locations FOR UPDATE TO authenticated
  USING (driver_id::text = auth.uid()::text);

-- Customer (or guest) can read location for their own order only while it is out for delivery
CREATE POLICY "customer_read_own_order_driver_location"
  ON driver_locations FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = driver_locations.order_id
        AND o.status = 'out_for_delivery'
    )
  );

-- Manager/owner can read all locations for their branch orders
CREATE POLICY "manager_read_branch_driver_locations"
  ON driver_locations FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner', 'general_manager')
    OR (
      auth_user_role()::text IN ('branch_manager')
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = driver_locations.order_id
          AND o.branch_id = auth_user_branch_id()
      )
    )
  );

-- Note: customer location-tracking policy omitted — orders table has no user_id
-- (orders are phone/WhatsApp-based, no customer auth flow exists)
