-- ============================================================
-- Kahramana Baghdad — KDS hardening + canonical taxonomy
-- Migration: 094_kds_hardening_and_taxonomy.sql
-- Date: 2026-05-10
--
-- Implements the top-5 KDS audit fixes (2026-05-10):
--   #1 RLS + RPC role lockdown (KDS-authorized roles only)
--   #2 Canonical 5-station taxonomy in trigger + menu_items_sync
--   #3 ELSE 'unassigned' fail-closed mapping for new/unknown slugs
--   #4 update_order_item_station_status: p_expected_status conflict check
--      + server-side transition validation
--   #5 bump_station_order RPC: verifies all items are 'ready' and
--      returns the affected row count
--
-- Depends on: 089 (kds_select/kds_update + RPC), 093 (enum values).
-- ============================================================

-- ── 1. RLS — restrict to KDS-authorized roles ────────────────────────
-- Previous policies (089) only checked branch scope. Same-branch
-- cashier/waiter/driver could call PostgREST directly. Add a role
-- predicate matching canAccessKDS() in src/lib/auth/rbac.ts.

DROP POLICY IF EXISTS "kds_select" ON order_item_station_status;
CREATE POLICY "kds_select"
  ON order_item_station_status FOR SELECT
  TO authenticated
  USING (
    auth_user_role() IN ('kitchen', 'branch_manager', 'general_manager', 'owner')
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_item_station_status.order_id
        AND (
          auth_user_role() IN ('owner', 'general_manager')
          OR o.branch_id = auth_user_branch_id()
        )
    )
  );

DROP POLICY IF EXISTS "kds_update" ON order_item_station_status;
CREATE POLICY "kds_update"
  ON order_item_station_status FOR UPDATE
  TO authenticated
  USING (
    auth_user_role() IN ('kitchen', 'branch_manager', 'general_manager', 'owner')
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_item_station_status.order_id
        AND (
          auth_user_role() IN ('owner', 'general_manager')
          OR o.branch_id = auth_user_branch_id()
        )
    )
  )
  WITH CHECK (
    auth_user_role() IN ('kitchen', 'branch_manager', 'general_manager', 'owner')
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_item_station_status.order_id
        AND (
          auth_user_role() IN ('owner', 'general_manager')
          OR o.branch_id = auth_user_branch_id()
        )
    )
  );

-- ── 2. Trigger — canonical 5-station mapping + 'unassigned' fallback ─
-- All grill / shawarma items → 'grill' (shared meat station).
-- Pizza, pastry, sandwiches, breakfast cooked items → 'fryer'.
-- Cold apps, salads, soups, mtabal, hummus → 'cold'.
-- All drinks-* → 'drinks'.
-- Sweets/desserts → 'desserts'.
-- Anything else → 'unassigned' (explicit queue, not silently 'main').

CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station   kds_station;
  v_branch_id TEXT;
BEGIN
  v_station := CASE
    -- Grill (meat / chicken / kabab / wraps)
    WHEN NEW.menu_item_slug LIKE 'grills-%'                   THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'shawarma-%'                 THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%kabab%'         THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%tikka%'         THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-grilled-%'       THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%liver%'         THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'mains-%'                    THEN 'grill'
    WHEN NEW.menu_item_slug = 'main-kharof'                   THEN 'grill'

    -- Fryer (pizza, pastry, breakfast eggs/tawat, hot apps, deep-fried)
    WHEN NEW.menu_item_slug LIKE 'pizza-%'                    THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'pastry-%'                   THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-eggs-%'           THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-tawat-%'          THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-plates-%'         THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%'               THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'hot-apps-%'                 THEN 'fryer'

    -- Cold (no-heat prep + soups, which share the same prep station here)
    WHEN NEW.menu_item_slug LIKE 'cold-apps-%'                THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'salad-%'                    THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'soup-%'                     THEN 'cold'

    -- Drinks
    WHEN NEW.menu_item_slug LIKE 'drinks-%'                   THEN 'drinks'

    -- Desserts (sweets / kunafa / cream-caramel / etc.)
    WHEN NEW.menu_item_slug LIKE 'dessert-%'                  THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE 'desserts-%'                 THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE 'sweets-%'                   THEN 'desserts'
    WHEN NEW.menu_item_slug = 'kunafa'                        THEN 'desserts'
    WHEN NEW.menu_item_slug = 'cream-caramel'                 THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE '%-kunafa'                   THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE '%-baklava%'                 THEN 'desserts'

    -- Fail closed: explicit unassigned queue, never silent 'main'
    ELSE 'unassigned'
  END::kds_station;

  SELECT branch_id INTO v_branch_id
  FROM orders WHERE id = NEW.order_id;

  INSERT INTO order_item_station_status (order_id, item_id, station, branch_id)
  VALUES (NEW.order_id, NEW.id, v_station, v_branch_id)
  ON CONFLICT (item_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_item_station_status ON order_items;
CREATE TRIGGER trg_order_item_station_status
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION on_order_item_created();

-- ── 3. menu_items_sync station backfill (if table exists) ──────────────
-- Re-map any legacy station values in the cached mapping table to the
-- new canonical taxonomy. Falls back to 'unassigned' for unrecognized rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_items_sync') THEN
    UPDATE menu_items_sync SET station = 'grill'      WHERE slug LIKE 'grills-%';
    UPDATE menu_items_sync SET station = 'grill'      WHERE slug LIKE 'shawarma-%';
    UPDATE menu_items_sync SET station = 'grill'      WHERE slug LIKE 'mains-%' OR slug = 'main-kharof';
    UPDATE menu_items_sync SET station = 'grill'      WHERE slug LIKE 'sandwiches-%kabab%' OR slug LIKE 'sandwiches-%tikka%' OR slug LIKE 'sandwiches-grilled-%' OR slug LIKE 'sandwiches-%liver%';
    UPDATE menu_items_sync SET station = 'fryer'      WHERE slug LIKE 'pizza-%' OR slug LIKE 'pastry-%';
    UPDATE menu_items_sync SET station = 'fryer'      WHERE slug LIKE 'breakfast-eggs-%' OR slug LIKE 'breakfast-tawat-%' OR slug LIKE 'breakfast-plates-%';
    UPDATE menu_items_sync SET station = 'fryer'      WHERE slug LIKE 'sandwiches-%' AND station <> 'grill';
    UPDATE menu_items_sync SET station = 'fryer'      WHERE slug LIKE 'hot-apps-%';
    UPDATE menu_items_sync SET station = 'cold'       WHERE slug LIKE 'cold-apps-%' OR slug LIKE 'salad-%' OR slug LIKE 'soup-%';
    UPDATE menu_items_sync SET station = 'drinks'     WHERE slug LIKE 'drinks-%';
    UPDATE menu_items_sync SET station = 'desserts'   WHERE slug LIKE 'dessert-%' OR slug LIKE 'desserts-%' OR slug LIKE 'sweets-%' OR slug = 'kunafa' OR slug = 'cream-caramel' OR slug LIKE '%-kunafa' OR slug LIKE '%-baklava%';
    UPDATE menu_items_sync SET station = 'unassigned' WHERE station IN ('shawarma','bakery','appetizer_drinks','main','fry','salads','packing');
  END IF;
END $$;

-- ── 4. update_order_item_station_status — role + conflict + transition ─
-- Adds:
--   - role whitelist (matches canAccessKDS in TS)
--   - p_expected_status: optimistic concurrency check
--   - server-side transition validation (pending→preparing→ready→completed)
--   - RAISE on conflict / forbidden transition / unauthorized
-- New optional p_expected_status param means existing callers keep working.

CREATE OR REPLACE FUNCTION update_order_item_station_status(
  p_order_id        UUID,
  p_item_id         UUID,
  p_station         kds_station,
  p_status          kds_item_status,
  p_expected_status kds_item_status DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
  v_current_status   kds_item_status;
  v_updated_count    INT;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('kitchen', 'branch_manager', 'general_manager', 'owner') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  -- Read current to validate the transition graph:
  --   pending → preparing → ready → completed
  --   completed → ready (recall path is allowed)
  SELECT status INTO v_current_status
  FROM order_item_station_status
  WHERE order_id = p_order_id
    AND item_id  = p_item_id
    AND station  = p_station;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_current_status = 'pending'   AND p_status = 'preparing')
    OR (v_current_status = 'preparing' AND p_status = 'ready')
    OR (v_current_status = 'ready'     AND p_status = 'completed')
    OR (v_current_status = 'completed' AND p_status = 'ready')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION'
      USING ERRCODE = '22023',
            DETAIL  = format('Cannot move from %s to %s', v_current_status, p_status);
  END IF;

  UPDATE order_item_station_status
  SET status     = p_status,
      updated_at = now()
  WHERE order_id = p_order_id
    AND item_id  = p_item_id
    AND station  = p_station
    AND (p_expected_status IS NULL OR status = p_expected_status);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'CONFLICT'
      USING ERRCODE = '40001',
            DETAIL  = 'Item status changed by another request — refresh and retry';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_order_item_station_status(UUID, UUID, kds_station, kds_item_status, kds_item_status) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION update_order_item_station_status(UUID, UUID, kds_station, kds_item_status, kds_item_status) TO authenticated;

-- ── 5. bump_station_order — verify ALL items 'ready' before completing ─
-- Replaces the client-side .update() loop in src/app/[locale]/dashboard/kds/
-- actions.ts:bumpStationOrder. Atomic: pre-checks every station row is
-- 'ready' and returns the updated row count so the action can detect
-- "nothing changed" cases that previously silently succeeded.

CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station  kds_station
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
  v_total            INT;
  v_not_ready        INT;
  v_updated          INT;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('kitchen', 'branch_manager', 'general_manager', 'owner') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'ready')
  INTO v_total, v_not_ready
  FROM order_item_station_status
  WHERE order_id = p_order_id
    AND station  = p_station;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS' USING ERRCODE = 'P0002';
  END IF;

  IF v_not_ready > 0 THEN
    RAISE EXCEPTION 'NOT_ALL_READY'
      USING ERRCODE = '22023',
            DETAIL  = format('%s of %s items are not ready yet', v_not_ready, v_total);
  END IF;

  UPDATE order_item_station_status
  SET status     = 'completed',
      updated_at = now()
  WHERE order_id = p_order_id
    AND station  = p_station
    AND status   = 'ready';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'NO_ROWS_AFFECTED'
      USING ERRCODE = '40001',
            DETAIL  = 'Concurrent change beat the bump — refresh and retry';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION bump_station_order(UUID, kds_station) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION bump_station_order(UUID, kds_station) TO authenticated;

-- ============================================================
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS bump_station_order(UUID, kds_station);
--   -- Restore previous update_order_item_station_status (no expected/role check) from 089.
--   -- Restore previous on_order_item_created (legacy CASE + ELSE 'main') from 089.
--   DROP POLICY IF EXISTS "kds_select" ON order_item_station_status;
--   DROP POLICY IF EXISTS "kds_update" ON order_item_station_status;
--   -- Restore previous (no role predicate) policies from 089.
-- ============================================================
