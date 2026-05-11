-- Migration 104: KDS Routing Refinement & RPC Fix
-- Goal: Fix misclassified stews and shawarma items by prioritizing keywords.
-- Goal: Resolve bump_station_order overload conflict (TEXT vs kds_station).

-- 0. Resolve RPC Overload Conflict
DROP FUNCTION IF EXISTS bump_station_order(uuid, text);
DROP FUNCTION IF EXISTS bump_station_order(uuid, kds_station);

CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station  TEXT
) RETURNS void AS $$
DECLARE
  v_branch_id TEXT;
  v_caller_branch_id TEXT;
BEGIN
  -- 1. Security Check (Branch scope)
  v_caller_branch_id := (SELECT branch_id FROM staff WHERE id = auth.uid());
  
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = p_order_id;
  
  IF v_branch_id IS DISTINCT FROM v_caller_branch_id AND v_caller_branch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Branch mismatch';
  END IF;

  -- 2. Mark station items as completed
  UPDATE order_item_station_status
  SET 
    status = 'completed',
    bumped_at = NOW()
  WHERE order_id = p_order_id
    AND station::text = p_station
    AND status != 'completed';

  -- 3. If all stations for this order are completed, mark order as ready
  -- (Optionally trigger global status update here, but KDS logic usually 
  -- manages order status separately via pick-up/delivery flows).
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Update Routing Function
CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station   kds_station;
  v_branch_id TEXT;
  v_slug      TEXT;
  v_name      TEXT;
BEGIN
  v_slug := LOWER(NEW.menu_item_slug);
  v_name := NEW.name_ar; -- Arabic name for keyword matching

  v_station := CASE
    -- Priority 1: Shawarma (catch keywords first)
    WHEN v_slug LIKE 'shawarma-%'   OR v_name LIKE '%شاورما%' OR v_name LIKE '%صاج%' OR v_name LIKE '%شباتي%' THEN 'shawarma'
    WHEN v_slug LIKE 'sandwiches-%' OR v_slug LIKE '%sandwich%' THEN 'shawarma'

    -- Priority 2: Mains & Stews (المرق والأطباق الرئيسية)
    WHEN v_slug LIKE 'stews-%'      OR v_name LIKE '%مرق%' OR v_name LIKE '%تبسي%' THEN 'mains'
    WHEN v_slug LIKE 'main-%'       OR v_slug LIKE 'mains-%' OR v_slug LIKE 'rice-%' THEN 'mains'

    -- Priority 3: Grill (المشاوي)
    WHEN v_slug LIKE 'grills-%'     OR v_slug LIKE 'bbq-%' THEN 'grill'

    -- Priority 4: Pizza & Bakery (البيتزا والفطائر)
    WHEN v_slug LIKE 'pizza-%'      OR v_slug LIKE 'pastry-%' OR v_slug LIKE 'fatayer-%' OR v_slug LIKE 'bread-%' THEN 'pizza'

    -- Priority 5: Cold & Appetizers (المقبلات والباردة)
    WHEN v_slug LIKE 'cold-%'       OR v_slug LIKE 'hot-%' OR v_slug LIKE 'drinks-%' 
      OR v_slug LIKE 'dessert%'     OR v_slug LIKE 'breakfast-%' OR v_slug LIKE 'salad-%' 
      OR v_slug LIKE 'soup-%'       OR v_slug LIKE 'appetizers-%' THEN 'cold'

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

-- 2. Force Global Backfill
-- Move items incorrectly assigned to 'grill' or 'unassigned' to their correct stations.
UPDATE order_item_station_status oiss
SET station = (
  CASE
    WHEN LOWER(oi.menu_item_slug) LIKE 'shawarma-%' OR oi.name_ar LIKE '%شاورما%' OR oi.name_ar LIKE '%صاج%' OR oi.name_ar LIKE '%شباتي%' THEN 'shawarma'
    WHEN LOWER(oi.menu_item_slug) LIKE 'sandwiches-%' OR LOWER(oi.menu_item_slug) LIKE '%sandwich%' THEN 'shawarma'
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'stews-%' OR oi.name_ar LIKE '%مرق%' OR oi.name_ar LIKE '%تبسي%' THEN 'mains'
    WHEN LOWER(oi.menu_item_slug) LIKE 'main-%' OR LOWER(oi.menu_item_slug) LIKE 'mains-%' OR LOWER(oi.menu_item_slug) LIKE 'rice-%' THEN 'mains'
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'grills-%' OR LOWER(oi.menu_item_slug) LIKE 'bbq-%' THEN 'grill'
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'pizza-%' OR LOWER(oi.menu_item_slug) LIKE 'pastry-%' OR LOWER(oi.menu_item_slug) LIKE 'fatayer-%' OR LOWER(oi.menu_item_slug) LIKE 'bread-%' THEN 'pizza'
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'cold-%' OR LOWER(oi.menu_item_slug) LIKE 'hot-%' OR LOWER(oi.menu_item_slug) LIKE 'drinks-%' 
      OR LOWER(oi.menu_item_slug) LIKE 'dessert%' OR LOWER(oi.menu_item_slug) LIKE 'breakfast-%' OR LOWER(oi.menu_item_slug) LIKE 'salad-%' 
      OR LOWER(oi.menu_item_slug) LIKE 'soup-%' OR LOWER(oi.menu_item_slug) LIKE 'appetizers-%' THEN 'cold'
      
    ELSE oiss.station
  END
)::kds_station
FROM order_items oi
WHERE oiss.item_id = oi.id;
