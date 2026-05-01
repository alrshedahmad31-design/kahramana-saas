-- ============================================================
-- Kahramana Baghdad — Dashboard Live Operations Fixes
-- Migration: 032_dashboard_live_ops_fixes.sql
--
-- Fixes:
--   1. Enable Supabase Realtime publication for live dashboard tables.
--   2. Re-create the non-driver order UPDATE policy with explicit roles.
--   3. Seed online test drivers for dispatch when no real drivers exist yet.
-- ============================================================

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['orders', 'staff_basic', 'driver_locations']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN undefined_object THEN
        RAISE NOTICE 'Publication supabase_realtime does not exist in this environment.';
    END;
  END LOOP;
END $$;

ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE staff_basic REPLICA IDENTITY FULL;
ALTER TABLE driver_locations REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "orders_update_non_driver_staff" ON orders;

CREATE POLICY "orders_update_non_driver_staff"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND s.role IN ('owner', 'general_manager', 'branch_manager', 'cashier', 'kitchen')
        AND (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM staff_basic s
      WHERE s.id = auth.uid()
        AND s.is_active = TRUE
        AND s.role IN ('owner', 'general_manager', 'branch_manager', 'cashier', 'kitchen')
        AND (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = orders.branch_id
        )
    )
  );

INSERT INTO staff_basic (
  id,
  name,
  role,
  branch_id,
  is_active,
  availability_status,
  phone,
  created_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000041',
    'Mohammed Driver',
    'driver',
    'riffa',
    TRUE,
    'online',
    '+97330000041',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000042',
    'Ahmed Driver',
    'driver',
    'qallali',
    TRUE,
    'online',
    '+97330000042',
    now()
  )
ON CONFLICT (id) DO UPDATE
SET is_active = TRUE,
    availability_status = 'online';
