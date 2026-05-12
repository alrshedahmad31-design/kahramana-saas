-- Migration 110: KDS Routing Precision (User-Requested Overrides)
-- Refines the routing trigger to handle specific sandwich/pizza edge cases.

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
    -- 1. Pizza (Highest priority to catch "Pizza Shawarma")
    WHEN v_slug LIKE 'pizza-%'      OR v_name LIKE '%بيتزا%' OR v_slug LIKE 'pastry-%' OR v_name LIKE '%فطيرة%' THEN 'pizza'
    WHEN v_name LIKE '%فطائر%'      OR v_name LIKE '%خبز%' THEN 'pizza'

    -- 2. Grill (Meat/Chicken Kabab/Tikka even in sandwiches)
    WHEN v_slug LIKE 'grills-%'     OR v_slug LIKE 'bbq-%' THEN 'grill'
    WHEN v_name LIKE '%كباب%'       OR v_name LIKE '%تكة%' OR v_name LIKE '%مشويات%' THEN 'grill'
    WHEN v_slug LIKE 'sandwiches-%' AND (v_name LIKE '%كباب%' OR v_name LIKE '%تكة%') THEN 'grill'

    -- 3. Mains (Stews, Rice, and specific sandwiches like Shakshuka/Falafel)
    WHEN v_slug LIKE 'stews-%'      OR v_name LIKE '%مرق%' OR v_name LIKE '%تبسي%' THEN 'mains'
    WHEN v_slug LIKE 'main-%'       OR v_slug LIKE 'mains-%' OR v_slug LIKE 'rice-%' THEN 'mains'
    WHEN v_name LIKE '%شكشوكة%'     OR v_name LIKE '%فلافل%' OR v_name LIKE '%باجلا%' OR v_name LIKE '%لبلبي%' THEN 'mains'
    WHEN v_slug LIKE 'sandwiches-%' AND (v_name LIKE '%شكشوكة%' OR v_name LIKE '%فلافل%') THEN 'mains'

    -- 4. Shawarma (The rest of sandwiches and shawarma plates)
    WHEN v_slug LIKE 'shawarma-%'   OR v_name LIKE '%شاورما%' OR v_name LIKE '%صاج%' OR v_name LIKE '%شباتي%' THEN 'shawarma'
    WHEN v_slug LIKE 'sandwiches-%' OR v_slug LIKE '%sandwich%' THEN 'shawarma'

    -- 5. Cold (Appetizers, drinks, desserts, etc.)
    WHEN v_slug LIKE 'appetizers-%' OR v_name LIKE '%مقبلات%' OR v_slug LIKE 'cold-%' OR v_name LIKE '%بارد%' THEN 'cold'
    WHEN v_slug LIKE 'drinks-%'     OR v_name LIKE '%عصير%' OR v_name LIKE '%شاي%' OR v_name LIKE '%مشروب%' THEN 'cold'
    WHEN v_slug LIKE 'desserts-%'   OR v_name LIKE '%حلويات%' OR v_name LIKE '%كنافة%' THEN 'cold'
    WHEN v_slug LIKE 'breakfast-%'  OR v_name LIKE '%فطور%' OR v_name LIKE '%سلطة%' OR v_name LIKE '%شوربة%' THEN 'cold'

    ELSE 'cold' -- Default fallback
  END::kds_station;

  -- Inherit branch_id from parent order
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

  -- Create/Update KDS tracking row
  INSERT INTO order_item_station_status (order_id, item_id, station, branch_id)
  VALUES (NEW.order_id, NEW.id, v_station, v_branch_id)
  ON CONFLICT (item_id) DO UPDATE 
  SET station = EXCLUDED.station, 
      branch_id = EXCLUDED.branch_id,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
