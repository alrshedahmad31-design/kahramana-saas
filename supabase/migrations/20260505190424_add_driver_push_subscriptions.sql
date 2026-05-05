-- ============================================================
-- Kahramana Baghdad — Driver Push Subscriptions
-- Migration: 20260505190424_add_driver_push_subscriptions.sql
--
-- Stores Web Push API subscriptions per driver so the server
-- can send push notifications when a new order is assigned.
-- Also adds 'delivery_failed' to the order_status enum.
-- ============================================================

-- 1. Add delivery_failed to order_status enum (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'order_status'::regtype
      AND enumlabel = 'delivery_failed'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'delivery_failed' AFTER 'out_for_delivery';
  END IF;
END
$$;

-- 2. Create driver_push_subscriptions table
CREATE TABLE IF NOT EXISTS driver_push_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     UUID        NOT NULL REFERENCES staff_basic(id) ON DELETE CASCADE,
  endpoint      TEXT        NOT NULL,
  p256dh        TEXT        NOT NULL,  -- public key
  auth_key      TEXT        NOT NULL,  -- auth secret
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One subscription slot per (driver, endpoint) pair
  UNIQUE (driver_id, endpoint)
);

ALTER TABLE driver_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Driver: can manage their own subscriptions
CREATE POLICY "driver_push_select"
  ON driver_push_subscriptions FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "driver_push_insert"
  ON driver_push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND role = 'driver' AND is_active = TRUE
    )
  );

CREATE POLICY "driver_push_delete"
  ON driver_push_subscriptions FOR DELETE TO authenticated
  USING (driver_id = auth.uid());

-- Service role (used by server actions) can read all to send notifications
CREATE POLICY "service_push_select"
  ON driver_push_subscriptions FOR SELECT TO service_role
  USING (TRUE);

-- Index for fast lookup by driver_id when sending notifications
CREATE INDEX IF NOT EXISTS driver_push_subs_driver_id_idx
  ON driver_push_subscriptions(driver_id);

-- ============================================================
-- ROLLBACK:
--   DROP TABLE IF EXISTS driver_push_subscriptions;
--   -- Note: enum value cannot be dropped in Postgres
-- ============================================================
