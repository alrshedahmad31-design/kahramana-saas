-- ============================================================
-- Kahramana Baghdad — Fix KDS trigger slug column reference
-- Migration: 077_fix_kds_trigger_slug_column.sql
-- Date: 2026-05-08
--
-- ⚠️  SUPERSEDED BY 079_fix_kds_trigger_inline_mapping.sql
-- The trigger defined here reads from menu_items (empty table).
-- Migration 079 replaces this trigger with an inline CASE mapping
-- that requires no external table.
--
-- If migrations ever replay or squash, 079 MUST run AFTER 077
-- to avoid reverting to the broken menu_items lookup.
-- ============================================================

CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station kds_station;
BEGIN
  -- menu_items.id stores the slug value (TEXT PRIMARY KEY)
  SELECT station INTO v_station
  FROM menu_items
  WHERE id = NEW.menu_item_slug;

  IF v_station IS NOT NULL THEN
    INSERT INTO order_item_station_status (order_id, item_id, station)
    VALUES (NEW.order_id, NEW.id, v_station)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach so the fix takes effect immediately
DROP TRIGGER IF EXISTS trg_order_item_station_status ON order_items;
CREATE TRIGGER trg_order_item_station_status
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION on_order_item_created();
