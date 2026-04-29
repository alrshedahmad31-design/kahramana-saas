-- Phase 4 — Driver schema
-- Adds assigned_driver_id to orders and a driver_locations table for GPS tracking.
-- ROLLBACK: ALTER TABLE orders DROP COLUMN IF EXISTS assigned_driver_id; DROP TABLE IF EXISTS driver_locations;

-- ── Add driver assignment to orders ──────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES staff_basic(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_driver
  ON orders(assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;

-- ── Driver GPS locations ──────────────────────────────────────────────────────
-- One row per update (append-only); latest row = current position.
-- iOS drivers never insert here (manual status only).

CREATE TABLE IF NOT EXISTS driver_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID        NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,
  lat         NUMERIC(10, 7) NOT NULL,
  lng         NUMERIC(10, 7) NOT NULL,
  accuracy_m  NUMERIC(6, 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver
  ON driver_locations(driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_locations_order
  ON driver_locations(order_id, created_at DESC) WHERE order_id IS NOT NULL;

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers insert their own location; branch_manager+ can read all for their branch
CREATE POLICY "driver_location_insert_own"
  ON driver_locations FOR INSERT TO authenticated
  WITH CHECK (driver_id = (
    SELECT id FROM staff_basic WHERE staff_basic.id = auth_user_branch_id()::uuid LIMIT 1
  ) OR driver_id IN (
    SELECT id FROM staff_basic WHERE id::text = auth.uid()::text
  ));

-- Drivers read their own; managers read all (via orders join → branch scope)
CREATE POLICY "driver_location_select_own"
  ON driver_locations FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM staff_basic WHERE id::text = auth.uid()::text)
    OR auth_user_role() IN ('owner', 'general_manager', 'branch_manager')
  );
