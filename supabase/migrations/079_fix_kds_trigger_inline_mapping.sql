-- ============================================================
-- Kahramana Baghdad — KDS trigger with inline station mapping
-- Migration: 079_fix_kds_trigger_inline_mapping.sql
-- Date: 2026-05-09
--
-- Supersedes: 077 (menu_items lookup — table empty)
--             078 (menu_items_sync lookup — table empty)
--
-- Root cause: both menu_items and menu_items_sync tables are empty.
-- Solution: embed the full 168-slug station mapping inside the trigger
-- function itself — no external table dependency, always correct.
--
-- Applied manually in Supabase SQL Editor on 2026-05-09. ✅
-- ============================================================

CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station kds_station;
BEGIN
  v_station := CASE NEW.menu_item_slug
    WHEN 'grills-kahramana-mix'       THEN 'grill'
    WHEN 'grills-ribs'                THEN 'grill'
    WHEN 'grills-meat-kabab'          THEN 'grill'
    WHEN 'grills-tikka-meat'          THEN 'grill'
    WHEN 'grills-grilled-neck'        THEN 'grill'
    WHEN 'grills-chicken-kabab'       THEN 'grill'
    WHEN 'grills-chicken-tikka'       THEN 'grill'
    WHEN 'grills-liver'               THEN 'grill'
    WHEN 'grills-chicken-wings'       THEN 'grill'
    WHEN 'grills-arayes'              THEN 'grill'
    WHEN 'grills-mix-grill'           THEN 'grill'
    WHEN 'grills-meat-grills'         THEN 'grill'
    WHEN 'grills-chicken-grills'      THEN 'grill'
    WHEN 'grills-grilled-chicken'     THEN 'grill'
    WHEN 'shawarma-iraqi-meat-plate'  THEN 'shawarma'
    WHEN 'shawarma-iraqi-meat'        THEN 'shawarma'
    WHEN 'shawarma-iraqi-chicken'     THEN 'shawarma'
    WHEN 'shawarma-arabic-mix'        THEN 'shawarma'
    WHEN 'shawarma-arabic-meat'       THEN 'shawarma'
    WHEN 'shawarma-arabic-chicken'    THEN 'shawarma'
    WHEN 'shawarma-samoon-meat'       THEN 'shawarma'
    WHEN 'shawarma-lebnani-meat'      THEN 'shawarma'
    WHEN 'shawarma-lebnani-chicken'   THEN 'shawarma'
    WHEN 'shawarma-saj-meat'          THEN 'shawarma'
    WHEN 'shawarma-chapati-meat'      THEN 'shawarma'
    WHEN 'shawarma-chapati-chicken'   THEN 'shawarma'
    WHEN 'cold-apps-mix-appetizer'    THEN 'appetizer_drinks'
    WHEN 'cold-apps-mtabal'           THEN 'appetizer_drinks'
    WHEN 'cold-apps-hummus'           THEN 'appetizer_drinks'
    WHEN 'cold-apps-hummus-meat'      THEN 'appetizer_drinks'
    WHEN 'cold-apps-hummus-shawarma'  THEN 'appetizer_drinks'
    WHEN 'cold-apps-pepper-hummus'    THEN 'appetizer_drinks'
    WHEN 'cold-apps-vine-leaves'      THEN 'appetizer_drinks'
    WHEN 'cold-apps-turshi'           THEN 'appetizer_drinks'
    WHEN 'hot-apps-dolma'             THEN 'appetizer_drinks'
    WHEN 'hot-apps-mosul-kubba'       THEN 'appetizer_drinks'
    WHEN 'hot-apps-halab-kubba'       THEN 'appetizer_drinks'
    WHEN 'hot-apps-burek-cheese'      THEN 'appetizer_drinks'
    WHEN 'hot-apps-oroug'             THEN 'appetizer_drinks'
    WHEN 'hot-apps-hareesa'           THEN 'appetizer_drinks'
    WHEN 'hot-apps-madhroobah'        THEN 'appetizer_drinks'
    WHEN 'hot-apps-french-fries'      THEN 'appetizer_drinks'
    WHEN 'salad-tabbouleh'            THEN 'appetizer_drinks'
    WHEN 'salad-fattoush'             THEN 'appetizer_drinks'
    WHEN 'salad-eggplant'             THEN 'appetizer_drinks'
    WHEN 'salad-rocca'                THEN 'appetizer_drinks'
    WHEN 'salad-jajeek'               THEN 'appetizer_drinks'
    WHEN 'salad-green'                THEN 'appetizer_drinks'
    WHEN 'soup-sour-kubba'            THEN 'appetizer_drinks'
    WHEN 'soup-lentil'                THEN 'appetizer_drinks'
    WHEN 'soup-mushroom'              THEN 'appetizer_drinks'
    WHEN 'soup-red'                   THEN 'appetizer_drinks'
    WHEN 'drinks-avocado'             THEN 'appetizer_drinks'
    WHEN 'drinks-kahramana-cocktail'  THEN 'appetizer_drinks'
    WHEN 'drinks-strawberry'          THEN 'appetizer_drinks'
    WHEN 'drinks-orange'              THEN 'appetizer_drinks'
    WHEN 'drinks-lemon-mint'          THEN 'appetizer_drinks'
    WHEN 'drinks-pomegranate'         THEN 'appetizer_drinks'
    WHEN 'drinks-mango'               THEN 'appetizer_drinks'
    WHEN 'drinks-laban-mint'          THEN 'appetizer_drinks'
    WHEN 'drinks-soft-drinks'         THEN 'appetizer_drinks'
    WHEN 'drinks-water'               THEN 'appetizer_drinks'
    WHEN 'drinks-iraqi-tea'           THEN 'appetizer_drinks'
    WHEN 'drinks-karak-tea'           THEN 'appetizer_drinks'
    WHEN 'drinks-black-lemon-tea'     THEN 'appetizer_drinks'
    WHEN 'pastry-lahm-bi-ajeen'           THEN 'bakery'
    WHEN 'pastry-meat-pie'                THEN 'bakery'
    WHEN 'pastry-meat-shawarma-cheese'    THEN 'bakery'
    WHEN 'pastry-meat-kabab-cheese'       THEN 'bakery'
    WHEN 'pastry-akkawi'                  THEN 'bakery'
    WHEN 'pastry-zaatar-plain'            THEN 'bakery'
    WHEN 'pastry-iraqi-bread-dozen'       THEN 'bakery'
    WHEN 'pastry-fatayer-dozen'           THEN 'bakery'
    WHEN 'pastry-labnah'                  THEN 'bakery'
    WHEN 'pastry-labnah-cheese'           THEN 'bakery'
    WHEN 'pastry-spinach-labnah'          THEN 'bakery'
    WHEN 'pastry-honey-labnah'            THEN 'bakery'
    WHEN 'pastry-zaatar-labnah'           THEN 'bakery'
    WHEN 'pastry-sausage-labnah'          THEN 'bakery'
    WHEN 'pastry-sausage-cheese-labnah'   THEN 'bakery'
    WHEN 'pastry-meat-shawarma-labnah'    THEN 'bakery'
    WHEN 'pastry-chicken-shawarma-labnah' THEN 'bakery'
    WHEN 'pastry-falafel-labnah'          THEN 'bakery'
    WHEN 'pastry-spring-pie'              THEN 'bakery'
    WHEN 'pastry-cheese'                  THEN 'bakery'
    WHEN 'pastry-zaatar-cheese'           THEN 'bakery'
    WHEN 'pastry-sausage-cheese'          THEN 'bakery'
    WHEN 'pastry-chicken-shawarma-cheese' THEN 'bakery'
    WHEN 'pastry-meat-spinach'            THEN 'bakery'
    WHEN 'pastry-chicken-spinach'         THEN 'bakery'
    WHEN 'pizza-kahramana-signature'  THEN 'bakery'
    WHEN 'pizza-shawarma'             THEN 'bakery'
    WHEN 'pizza-kabab'                THEN 'bakery'
    WHEN 'pizza-pepperonata'          THEN 'bakery'
    WHEN 'pizza-margarita'            THEN 'bakery'
    WHEN 'pizza-vegetarian'           THEN 'bakery'
    WHEN 'pizza-pollo'                THEN 'bakery'
    WHEN 'pizza-spinach'              THEN 'bakery'
    WHEN 'pizza-jalapeno-chicken'     THEN 'bakery'
    WHEN 'sandwiches-meat-kabab'          THEN 'bakery'
    WHEN 'sandwiches-meat-tikka'          THEN 'bakery'
    WHEN 'sandwiches-chicken-kabab'       THEN 'bakery'
    WHEN 'sandwiches-chicken-tikka'       THEN 'bakery'
    WHEN 'sandwiches-grilled-liver'       THEN 'bakery'
    WHEN 'sandwiches-kubba'               THEN 'bakery'
    WHEN 'sandwiches-falafel'             THEN 'bakery'
    WHEN 'sandwiches-beef-liver'          THEN 'bakery'
    WHEN 'sandwiches-chicken-liver'       THEN 'bakery'
    WHEN 'sandwiches-makhlama'            THEN 'bakery'
    WHEN 'sandwiches-shakshouka'          THEN 'bakery'
    WHEN 'sandwiches-special-shakshouka'  THEN 'bakery'
    WHEN 'sandwiches-tomato-special'      THEN 'bakery'
    WHEN 'breakfast-plates-bagella-bil-dihen'    THEN 'bakery'
    WHEN 'breakfast-tawat-makhlama'              THEN 'bakery'
    WHEN 'breakfast-eggs-fried-eggs'             THEN 'bakery'
    WHEN 'breakfast-eggs-shakshouka-special'     THEN 'bakery'
    WHEN 'breakfast-eggs-meat'                   THEN 'bakery'
    WHEN 'breakfast-eggs-basterma'               THEN 'bakery'
    WHEN 'breakfast-tawat-tomato-tawah'          THEN 'bakery'
    WHEN 'breakfast-tawat-chicken-liver'         THEN 'bakery'
    WHEN 'breakfast-tawat-beef-liver'            THEN 'bakery'
    WHEN 'breakfast-plates-halloumi'             THEN 'bakery'
    WHEN 'breakfast-plates-falafel'              THEN 'bakery'
    WHEN 'breakfast-plates-dibis-rashi'          THEN 'bakery'
    WHEN 'breakfast-plates-lablabeh'             THEN 'bakery'
    WHEN 'breakfast-plates-msabaha'              THEN 'bakery'
    WHEN 'breakfast-plates-foul-mdammas'         THEN 'bakery'
    WHEN 'breakfast-plates-labneh'               THEN 'bakery'
    WHEN 'breakfast-plates-debis-dehin'          THEN 'bakery'
    WHEN 'breakfast-plates-bagella'              THEN 'bakery'
    WHEN 'breakfast-eggs-tomatoes'               THEN 'bakery'
    WHEN 'breakfast-eggs-shakshouka'             THEN 'bakery'
    WHEN 'breakfast-eggs-potato'                 THEN 'bakery'
    WHEN 'breakfast-eggs-cheese'                 THEN 'bakery'
    WHEN 'breakfast-eggs-zaatar'                 THEN 'bakery'
    ELSE 'main'
  END::kds_station;

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
