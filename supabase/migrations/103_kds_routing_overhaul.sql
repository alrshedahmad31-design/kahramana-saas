-- Migration 103: KDS Routing Overhaul
-- Goal: Redefine the 5-station routing and backfill legacy data.

-- 1. Expand Enum
-- Note: 'mains' and 'pizza' are the new canonical stations.
-- Using COMMIT to allow enum modification if needed in some environments,
-- but standard Supabase migrations usually handle this.
ALTER TYPE kds_station ADD VALUE IF NOT EXISTS 'mains';
ALTER TYPE kds_station ADD VALUE IF NOT EXISTS 'pizza';

-- 2. Update Routing Function
CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station   kds_station;
  v_branch_id TEXT;
BEGIN
  v_station := CASE
    -- Mains (الأطباق الرئيسية)
    WHEN NEW.menu_item_slug LIKE 'mains-%'      THEN 'mains'
    WHEN NEW.menu_item_slug LIKE 'stews-%'      THEN 'mains'
    WHEN NEW.menu_item_slug LIKE 'main-%'       THEN 'mains'
    WHEN NEW.menu_item_slug LIKE 'rice-%'       THEN 'mains'

    -- Grill (المشاوي)
    WHEN NEW.menu_item_slug LIKE 'grills-%'     THEN 'grill'
    WHEN NEW.menu_item_slug LIKE 'bbq-%'        THEN 'grill'

    -- Shawarma (الشاورما والسندويشات)
    WHEN NEW.menu_item_slug LIKE 'shawarma-%'   THEN 'shawarma'
    WHEN NEW.menu_item_slug LIKE 'sandwiches-%' THEN 'shawarma'

    -- Pizza (البيتزا والفطائر)
    WHEN NEW.menu_item_slug LIKE 'pizza-%'      THEN 'pizza'
    WHEN NEW.menu_item_slug LIKE 'pastry-%'     THEN 'pizza'
    WHEN NEW.menu_item_slug LIKE 'fatayer-%'    THEN 'pizza'
    WHEN NEW.menu_item_slug LIKE 'bread-%'      THEN 'pizza'

    -- Cold (المقبلات، المشروبات، الحلويات، الفطور)
    WHEN NEW.menu_item_slug LIKE 'cold-%'       THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'appetizers-%' THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'hot-%'        THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'drinks-%'     THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'desserts-%'   THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'dessert-%'    THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'breakfast-%'  THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'salad-%'      THEN 'cold'
    WHEN NEW.menu_item_slug LIKE 'soup-%'       THEN 'cold'

    ELSE 'unassigned'
  END::kds_station;

  SELECT branch_id INTO v_branch_id
  FROM orders WHERE id = NEW.order_id;

  INSERT INTO order_item_station_status (order_id, item_id, station, branch_id)
  VALUES (NEW.order_id, NEW.id, v_station, v_branch_id)
  ON CONFLICT (item_id) DO UPDATE SET station = EXCLUDED.station;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill Existing Rows
-- We update all existing station rows to match the new taxonomy.
UPDATE order_item_station_status oiss
SET station = (
  CASE
    WHEN oi.menu_item_slug LIKE 'mains-%'      THEN 'mains'
    WHEN oi.menu_item_slug LIKE 'stews-%'      THEN 'mains'
    WHEN oi.menu_item_slug LIKE 'main-%'       THEN 'mains'
    WHEN oi.menu_item_slug LIKE 'rice-%'       THEN 'mains'
    WHEN oi.menu_item_slug LIKE 'grills-%'     THEN 'grill'
    WHEN oi.menu_item_slug LIKE 'bbq-%'        THEN 'grill'
    WHEN oi.menu_item_slug LIKE 'shawarma-%'   THEN 'shawarma'
    WHEN oi.menu_item_slug LIKE 'sandwiches-%' THEN 'shawarma'
    WHEN oi.menu_item_slug LIKE 'pizza-%'      THEN 'pizza'
    WHEN oi.menu_item_slug LIKE 'pastry-%'     THEN 'pizza'
    WHEN oi.menu_item_slug LIKE 'fatayer-%'    THEN 'pizza'
    WHEN oi.menu_item_slug LIKE 'bread-%'      THEN 'pizza'
    WHEN oi.menu_item_slug LIKE 'cold-%'       THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'appetizers-%' THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'hot-%'        THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'drinks-%'     THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'desserts-%'   THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'dessert-%'    THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'breakfast-%'  THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'salad-%'      THEN 'cold'
    WHEN oi.menu_item_slug LIKE 'soup-%'       THEN 'cold'
    ELSE oiss.station
  END
)::kds_station
FROM order_items oi
WHERE oiss.item_id = oi.id;
