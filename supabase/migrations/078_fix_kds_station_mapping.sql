-- ============================================================
-- Kahramana Baghdad — Fix KDS station mapping
-- Migration: 078_fix_kds_station_mapping.sql
-- Date: 2026-05-08
--
-- Problem: menu.json has no station values → menu_items_sync.station = NULL
-- for all 168 items → trigger defaults everything to 'main' →
-- all items appear on "الأطباق الرئيسية" screen.
--
-- Fix:
-- 1. Populate menu_items_sync.station using category-based mapping
-- 2. Fix trigger to use menu_items_sync (source of truth), not menu_items
-- 3. Correct order_item_station_status for all existing active orders
-- ============================================================

-- ── 1. Populate menu_items_sync.station ──────────────────────────────────────
UPDATE menu_items_sync
SET station = CASE
  WHEN slug = 'grills-kahramana-mix' THEN 'grill'::kds_station
  WHEN slug = 'grills-ribs' THEN 'grill'::kds_station
  WHEN slug = 'grills-meat-kabab' THEN 'grill'::kds_station
  WHEN slug = 'grills-tikka-meat' THEN 'grill'::kds_station
  WHEN slug = 'grills-grilled-neck' THEN 'grill'::kds_station
  WHEN slug = 'grills-chicken-kabab' THEN 'grill'::kds_station
  WHEN slug = 'grills-chicken-tikka' THEN 'grill'::kds_station
  WHEN slug = 'grills-liver' THEN 'grill'::kds_station
  WHEN slug = 'grills-chicken-wings' THEN 'grill'::kds_station
  WHEN slug = 'grills-arayes' THEN 'grill'::kds_station
  WHEN slug = 'grills-mix-grill' THEN 'grill'::kds_station
  WHEN slug = 'grills-meat-grills' THEN 'grill'::kds_station
  WHEN slug = 'grills-chicken-grills' THEN 'grill'::kds_station
  WHEN slug = 'grills-grilled-chicken' THEN 'grill'::kds_station
  WHEN slug = 'mains-masgouf' THEN 'main'::kds_station
  WHEN slug = 'mains-quzi-iraqi-lamb' THEN 'main'::kds_station
  WHEN slug = 'main-kharof' THEN 'main'::kds_station
  WHEN slug = 'mains-dlemiya' THEN 'main'::kds_station
  WHEN slug = 'mains-dolma' THEN 'main'::kds_station
  WHEN slug = 'mains-lamb-neck-rice' THEN 'main'::kds_station
  WHEN slug = 'mains-quzi-iraqi-chicken' THEN 'main'::kds_station
  WHEN slug = 'mains-meat-thareed' THEN 'main'::kds_station
  WHEN slug = 'mains-biryani-meat' THEN 'main'::kds_station
  WHEN slug = 'mains-machbous-lamb' THEN 'main'::kds_station
  WHEN slug = 'mains-bahraini-quzi-lamb' THEN 'main'::kds_station
  WHEN slug = 'mains-meat-mandi' THEN 'main'::kds_station
  WHEN slug = 'mains-iraqi-shawarma-rice' THEN 'main'::kds_station
  WHEN slug = 'mains-kabab-rice' THEN 'main'::kds_station
  WHEN slug = 'mains-stuffed-onion' THEN 'main'::kds_station
  WHEN slug = 'mains-stuffed-zucchini' THEN 'main'::kds_station
  WHEN slug = 'main-safi-fish-rice' THEN 'main'::kds_station
  WHEN slug = 'mains-biryani-chicken' THEN 'main'::kds_station
  WHEN slug = 'mains-machbous-chicken' THEN 'main'::kds_station
  WHEN slug = 'mains-chicken-mandi' THEN 'main'::kds_station
  WHEN slug = 'mains-bahraini-quzi-chicken' THEN 'main'::kds_station
  WHEN slug = 'main-rotisserie-chicken' THEN 'main'::kds_station
  WHEN slug = 'mains-grilled-chicken-rice' THEN 'main'::kds_station
  WHEN slug = 'mains-iraqi-shawarma-thareed' THEN 'main'::kds_station
  WHEN slug = 'mains-rice' THEN 'main'::kds_station
  WHEN slug = 'cold-apps-mix-appetizer' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-mtabal' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-hummus' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-hummus-meat' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-hummus-shawarma' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-pepper-hummus' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-vine-leaves' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'cold-apps-turshi' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-dolma' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-mosul-kubba' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-halab-kubba' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-burek-cheese' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-oroug' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-hareesa' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-madhroobah' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'hot-apps-french-fries' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'salad-tabbouleh' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'salad-fattoush' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'salad-eggplant' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'salad-rocca' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'salad-jajeek' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'salad-green' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'soup-sour-kubba' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'soup-lentil' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'soup-mushroom' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'soup-red' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'stews-bamih' THEN 'main'::kds_station
  WHEN slug = 'stews-white-beans' THEN 'main'::kds_station
  WHEN slug = 'stews-tabsi' THEN 'main'::kds_station
  WHEN slug = 'breakfast-fattat-vine-leaves' THEN 'main'::kds_station
  WHEN slug = 'breakfast-fattat-eggplant-chickpeas' THEN 'main'::kds_station
  WHEN slug = 'breakfast-fattat-falafel' THEN 'main'::kds_station
  WHEN slug = 'pastry-lahm-bi-ajeen' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-meat-pie' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-meat-shawarma-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-meat-kabab-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-akkawi' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-zaatar-plain' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-iraqi-bread-dozen' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-fatayer-dozen' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-labnah-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-spinach-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-honey-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-zaatar-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-sausage-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-sausage-cheese-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-meat-shawarma-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-chicken-shawarma-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-falafel-labnah' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-spring-pie' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-zaatar-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-sausage-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-chicken-shawarma-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-meat-spinach' THEN 'bakery'::kds_station
  WHEN slug = 'pastry-chicken-spinach' THEN 'bakery'::kds_station
  WHEN slug = 'shawarma-iraqi-meat-plate' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-iraqi-meat' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-iraqi-chicken' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-arabic-mix' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-arabic-meat' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-arabic-chicken' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-samoon-meat' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-lebnani-meat' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-lebnani-chicken' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-saj-meat' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-chapati-meat' THEN 'shawarma'::kds_station
  WHEN slug = 'shawarma-chapati-chicken' THEN 'shawarma'::kds_station
  WHEN slug = 'pizza-kahramana-signature' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-shawarma' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-kabab' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-pepperonata' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-margarita' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-vegetarian' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-pollo' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-spinach' THEN 'bakery'::kds_station
  WHEN slug = 'pizza-jalapeno-chicken' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-meat-kabab' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-meat-tikka' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-chicken-kabab' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-chicken-tikka' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-grilled-liver' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-kubba' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-falafel' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-beef-liver' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-chicken-liver' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-makhlama' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-shakshouka' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-special-shakshouka' THEN 'bakery'::kds_station
  WHEN slug = 'sandwiches-tomato-special' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-bagella-bil-dihen' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-tawat-makhlama' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-fried-eggs' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-shakshouka-special' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-meat' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-basterma' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-tawat-tomato-tawah' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-tawat-chicken-liver' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-tawat-beef-liver' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-halloumi' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-falafel' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-dibis-rashi' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-lablabeh' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-msabaha' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-foul-mdammas' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-labneh' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-debis-dehin' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-plates-bagella' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-tomatoes' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-shakshouka' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-potato' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-cheese' THEN 'bakery'::kds_station
  WHEN slug = 'breakfast-eggs-zaatar' THEN 'bakery'::kds_station
  WHEN slug = 'desserts-umm-ali' THEN 'main'::kds_station
  WHEN slug = 'desserts-fruit-salad' THEN 'main'::kds_station
  WHEN slug = 'drinks-avocado' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-kahramana-cocktail' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-strawberry' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-orange' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-lemon-mint' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-pomegranate' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-mango' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-laban-mint' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-soft-drinks' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-water' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-iraqi-tea' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-karak-tea' THEN 'appetizer_drinks'::kds_station
  WHEN slug = 'drinks-black-lemon-tea' THEN 'appetizer_drinks'::kds_station
  ELSE 'main'::kds_station
END
WHERE station IS NULL OR station = 'main'::kds_station;

-- ── 2. Fix trigger: use menu_items_sync (real source of truth) ───────────────
CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station kds_station;
BEGIN
  -- menu_items_sync.slug is the canonical station source (synced from menu.json)
  SELECT station INTO v_station
  FROM menu_items_sync
  WHERE slug = NEW.menu_item_slug;

  -- Hard fallback: anything unmapped goes to packing so nothing is lost
  IF v_station IS NULL THEN
    v_station := 'main'::kds_station;
  END IF;

  INSERT INTO order_item_station_status (order_id, item_id, station)
  VALUES (NEW.order_id, NEW.id, v_station)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_item_station_status ON order_items;
CREATE TRIGGER trg_order_item_station_status
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION on_order_item_created();

-- ── 3. Correct existing order_item_station_status rows ───────────────────────
-- Delete wrong 'main' assignments and re-insert with correct station
-- Only for active orders (accepted / preparing / ready)
DELETE FROM order_item_station_status oss
USING order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_items_sync mis ON mis.slug = oi.menu_item_slug
WHERE oss.item_id = oi.id
  AND oss.station = 'main'::kds_station
  AND mis.station != 'main'::kds_station
  AND o.status IN ('accepted', 'preparing', 'ready');

-- Re-insert with correct station
INSERT INTO order_item_station_status (order_id, item_id, station, status)
SELECT
  oi.order_id,
  oi.id,
  mis.station,
  'pending'::kds_item_status
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_items_sync mis ON mis.slug = oi.menu_item_slug
WHERE o.status IN ('accepted', 'preparing', 'ready')
  AND mis.station IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM order_item_station_status oss
    WHERE oss.item_id = oi.id AND oss.station = mis.station
  );
