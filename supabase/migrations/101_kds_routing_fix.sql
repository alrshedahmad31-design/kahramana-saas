-- ============================================================
-- Kahramana Baghdad — KDS routing fixes + taxonomy expansion
-- Migration: 101_kds_routing_fix.sql
-- Date: 2026-05-11
--
-- Implements:
--   #1 Backfill legacy station values in order_item_station_status
--   #2 Expand trigger patterns for 'main-%', 'stews-%', and 'breakfast-fattat-%'
--   #3 Re-classify currently 'unassigned' items using the new patterns
-- ============================================================

-- ── 1. Backfill Legacy Stations ──────────────────────────────────────
-- These legacy values cause items to hide from the new 5-station boards.
-- We move them to their closest canonical equivalents.

UPDATE order_item_station_status
SET station = 'grill'
WHERE station IN ('shawarma', 'main');

UPDATE order_item_station_status  
SET station = 'fryer'
WHERE station = 'bakery';

UPDATE order_item_station_status
SET station = 'cold'
WHERE station = 'appetizer_drinks';

-- ── 2. Expanded Trigger Taxonomy ──────────────────────────────────────
-- Broadens the mapping patterns to capture edge cases found in audit.

CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station   kds_station;
  v_branch_id TEXT;
BEGIN
  v_station := CASE
    -- Grill (meat / chicken / kabab / wraps / stews / rotisserie)
    WHEN NEW.menu_item_slug LIKE 'grills-%'                   THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'shawarma-%'                 THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%kabab%'         THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%tikka%'         THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-grilled-%'       THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%liver%'         THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'mains-%'                    THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'main-%'                     THEN 'grill' -- Catch-all for main-rotisserie-chicken etc.
    WHEN NEW.menu_item_slug LIKE 'stews-%'                    THEN 'grill' -- Tabsi, Bamia, etc. share meat station
    WHEN NEW.menu_item_slug = 'main-kharof'                   THEN 'grill'

    -- Fryer (pizza, pastry, breakfast eggs/tawat, hot apps, deep-fried)
    WHEN NEW.menu_item_slug LIKE 'pizza-%'                    THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'pastry-%'                   THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-eggs-%'           THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-tawat-%'          THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-plates-%'         THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'breakfast-fattat-%'         THEN 'fryer' -- Fattat-falafel etc.
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%'               THEN 'fryer'
    WHEN NEW.menu_item_slug LIKE 'hot-apps-%'                 THEN 'fryer'

    -- Cold (no-heat prep + soups)
    WHEN NEW.menu_item_slug LIKE 'cold-apps-%'                THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'salad-%'                    THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'soup-%'                     THEN 'cold'

    -- Drinks
    WHEN NEW.menu_item_slug LIKE 'drinks-%'                   THEN 'drinks'

    -- Desserts
    WHEN NEW.menu_item_slug LIKE 'dessert-%'                  THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE 'desserts-%'                 THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE 'sweets-%'                   THEN 'desserts'
    WHEN NEW.menu_item_slug = 'kunafa'                        THEN 'desserts'
    WHEN NEW.menu_item_slug = 'cream-caramel'                 THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE '%-kunafa'                   THEN 'desserts'
    WHEN NEW.menu_item_slug LIKE '%-baklava%'                 THEN 'desserts'

    -- Fail closed: explicit unassigned queue
    ELSE 'unassigned'
  END::kds_station;

  SELECT branch_id INTO v_branch_id
  FROM orders WHERE id = NEW.order_id;

  INSERT INTO order_item_station_status (order_id, item_id, station, branch_id)
  VALUES (NEW.order_id, NEW.id, v_station, v_branch_id)
  ON CONFLICT (item_id) DO UPDATE SET station = EXCLUDED.station, branch_id = EXCLUDED.branch_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Backfill Unassigned ────────────────────────────────────────────
-- Fixes the 3 known unassigned items (and any others) by re-running the 
-- logic against existing rows.

DO $$
DECLARE
  r RECORD;
  v_new_station kds_station;
BEGIN
  FOR r IN 
    SELECT oi.id, oi.menu_item_slug
    FROM order_items oi
    JOIN order_item_station_status oiss ON oiss.item_id = oi.id
    WHERE oiss.station = 'unassigned'
  LOOP
    v_new_station := CASE
      WHEN r.menu_item_slug LIKE 'main-%'                     THEN 'grill'
      WHEN r.menu_item_slug LIKE 'stews-%'                    THEN 'grill'
      WHEN r.menu_item_slug LIKE 'breakfast-fattat-%'         THEN 'fryer'
      ELSE 'unassigned'
    END;

    IF v_new_station <> 'unassigned' THEN
      UPDATE order_item_station_status 
      SET station = v_new_station 
      WHERE item_id = r.id;
    END IF;
  END LOOP;
END $$;
