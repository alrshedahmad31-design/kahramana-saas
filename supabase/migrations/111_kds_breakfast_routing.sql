-- Migration 111: Breakfast to Mains Overrides
-- Re-routing Egg dishes and Tomato Tawah from 'cold' to 'mains'.

CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station   kds_station;
  v_branch_id TEXT;
  v_slug      TEXT;
  v_name      TEXT;
BEGIN
  v_slug := LOWER(NEW.menu_item_slug);
  v_name := NEW.name_ar;

  v_station := CASE
    -- 1. Pizza
    WHEN v_slug LIKE 'pizza-%'      OR v_name LIKE '%بيتزا%' OR v_slug LIKE 'pastry-%' OR v_name LIKE '%فطيرة%' THEN 'pizza'
    WHEN v_name LIKE '%فطائر%'      OR v_name LIKE '%خبز%' THEN 'pizza'

    -- 2. Grill
    WHEN v_slug LIKE 'grills-%'     OR v_slug LIKE 'bbq-%' THEN 'grill'
    WHEN v_name LIKE '%كباب%'       OR v_name LIKE '%تكة%' OR v_name LIKE '%مشويات%' THEN 'grill'
    WHEN v_slug LIKE 'sandwiches-%' AND (v_name LIKE '%كباب%' OR v_name LIKE '%تكة%') THEN 'grill'

    -- 3. Mains (Including Eggs, Shakshuka, Tawah, Falafel)
    WHEN v_slug LIKE 'stews-%'      OR v_name LIKE '%مرق%' OR v_name LIKE '%تبسي%' THEN 'mains'
    WHEN v_slug LIKE 'main-%'       OR v_slug LIKE 'mains-%' OR v_slug LIKE 'rice-%' THEN 'mains'
    WHEN v_name LIKE '%شكشوكة%'     OR v_name LIKE '%فلافل%' OR v_name LIKE '%باجلا%' OR v_name LIKE '%لبلبي%' THEN 'mains'
    WHEN v_name LIKE '%بيض%'        OR v_name LIKE '%طاوة%' OR v_name LIKE '%مخلمة%' THEN 'mains'
    WHEN v_slug LIKE 'sandwiches-%' AND (v_name LIKE '%شكشوكة%' OR v_name LIKE '%فلافل%' OR v_name LIKE '%بيض%' OR v_name LIKE '%مخلمة%') THEN 'mains'
    WHEN v_slug LIKE 'breakfast-eggs-%' OR v_slug LIKE 'breakfast-tawat-%' THEN 'mains'

    -- 4. Shawarma
    WHEN v_slug LIKE 'shawarma-%'   OR v_name LIKE '%شاورما%' OR v_name LIKE '%صاج%' OR v_name LIKE '%شباتي%' THEN 'shawarma'
    WHEN v_slug LIKE 'sandwiches-%' OR v_slug LIKE '%sandwich%' THEN 'shawarma'

    -- 5. Cold
    WHEN v_slug LIKE 'appetizers-%' OR v_name LIKE '%مقبلات%' OR v_slug LIKE 'cold-%' OR v_name LIKE '%بارد%' THEN 'cold'
    WHEN v_slug LIKE 'drinks-%'     OR v_name LIKE '%عصير%' OR v_name LIKE '%شاي%' OR v_name LIKE '%مشروب%' THEN 'cold'
    WHEN v_slug LIKE 'desserts-%'   OR v_name LIKE '%حلويات%' OR v_name LIKE '%كنافة%' THEN 'cold'
    WHEN v_slug LIKE 'breakfast-%'  OR v_name LIKE '%فطور%' OR v_name LIKE '%سلطة%' OR v_name LIKE '%شوربة%' THEN 'cold'

    ELSE 'cold'
  END::kds_station;

  SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

  INSERT INTO order_item_station_status (order_id, item_id, station, branch_id)
  VALUES (NEW.order_id, NEW.id, v_station, v_branch_id)
  ON CONFLICT (item_id) DO UPDATE 
  SET station = EXCLUDED.station, 
      branch_id = EXCLUDED.branch_id,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
