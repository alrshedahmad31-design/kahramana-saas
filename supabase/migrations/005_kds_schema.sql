-- ============================================================
-- Kahramana Baghdad — KDS Schema
-- Migration: 005_kds_schema.sql
-- Applied: 2026-04-28
-- Depends on: 001 (staff_basic, order_items, orders), 003 (auth_user_role, auth_user_branch_id)
-- ============================================================

-- ── KDS station enum ──────────────────────────────────────────────────────────

CREATE TYPE kds_station AS ENUM (
  'grill',
  'fry',
  'salads',
  'desserts',
  'drinks',
  'packing'
);

-- ── Add station column to menu_items_sync ─────────────────────────────────────
-- NULL = not yet mapped (trigger defaults to 'packing')

ALTER TABLE menu_items_sync
  ADD COLUMN IF NOT EXISTS station kds_station;

-- ── kds_queue table ───────────────────────────────────────────────────────────

CREATE TABLE kds_queue (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id)      ON DELETE CASCADE,
  order_item_id UUID        NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  station       kds_station NOT NULL DEFAULT 'packing',
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
  priority      INTEGER     NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  assigned_to   UUID        REFERENCES staff_basic(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary KDS query: station + active statuses, ordered by age
CREATE INDEX idx_kds_station_status_created
  ON kds_queue(station, status, created_at);

-- Partial index covering only active (non-final) items — small, hot
CREATE INDEX idx_kds_active
  ON kds_queue(station, created_at)
  WHERE status IN ('pending', 'preparing');

-- For order-level aggregation (checking if all items are ready)
CREATE INDEX idx_kds_order_status
  ON kds_queue(order_id, status);

CREATE INDEX idx_kds_order_item_id
  ON kds_queue(order_item_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE kds_queue ENABLE ROW LEVEL SECURITY;

-- Any authenticated staff sees KDS items for their branch's orders.
-- Global admins (owner / GM) see all branches.
-- Depends on auth_user_role() and auth_user_branch_id() from migration 003.
CREATE POLICY "kds_select_staff"
  ON kds_queue FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = kds_queue.order_id
        AND o.branch_id = auth_user_branch_id()
    )
  );

-- Kitchen staff and branch managers can bump items in their branch.
CREATE POLICY "kds_update_staff"
  ON kds_queue FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = kds_queue.order_id
        AND o.branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role() IN ('owner', 'general_manager')
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = kds_queue.order_id
        AND o.branch_id = auth_user_branch_id()
    )
  );

-- No INSERT/DELETE from client: the trigger handles inserts; deletions via CASCADE only.

-- ── Auto-enqueue trigger ──────────────────────────────────────────────────────
-- Fires AFTER each order_item INSERT.
-- Resolves station from menu_items_sync; defaults to 'packing' when unmapped.

CREATE OR REPLACE FUNCTION fn_kds_enqueue_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station kds_station;
BEGIN
  SELECT station INTO v_station
  FROM menu_items_sync
  WHERE slug = NEW.menu_item_slug;

  -- Default unmapped items to packing so nothing falls through
  IF v_station IS NULL THEN
    v_station := 'packing';
  END IF;

  INSERT INTO kds_queue (order_id, order_item_id, station, status, priority, created_at)
  VALUES (NEW.order_id, NEW.id, v_station, 'pending', 0, NOW());

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kds_enqueue
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_kds_enqueue_item();

-- ============================================================
-- ROLLBACK:
--
-- DROP TRIGGER IF EXISTS trg_kds_enqueue ON order_items;
-- DROP FUNCTION IF EXISTS fn_kds_enqueue_item();
-- DROP POLICY IF EXISTS "kds_select_staff" ON kds_queue;
-- DROP POLICY IF EXISTS "kds_update_staff" ON kds_queue;
-- DROP INDEX IF EXISTS idx_kds_station_status_created;
-- DROP INDEX IF EXISTS idx_kds_active;
-- DROP INDEX IF EXISTS idx_kds_order_status;
-- DROP INDEX IF EXISTS idx_kds_order_item_id;
-- DROP TABLE IF EXISTS kds_queue;
-- ALTER TABLE menu_items_sync DROP COLUMN IF EXISTS station;
-- DROP TYPE IF EXISTS kds_station;
-- ============================================================
