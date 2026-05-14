-- 144_seed_egg_sandwiches.sql
--
-- Seeds the 7 egg-sandwich items that already live in src/data/menu.json
-- (added in commit c8964ba) but were never inserted into menu_items, so
-- they didn't render to customers (the menu loader is DB-first).
--
-- Each row carries premium Arabic/English copy authored for this seed,
-- plus the existing price + image_url from the JSON fixture so visuals
-- stay in sync.
--
-- Idempotent via ON CONFLICT (id) DO NOTHING — safe to re-run.
--
-- Category: 'traditional-sandwiches' (rolls up under السندويشات in the
-- main nav). Station defaults to 'main' per table default.

INSERT INTO menu_items (
  id, name_ar, name_en, description_ar, description_en,
  price_bhd, category, image_url, is_available
) VALUES
  (
    'sandwiches-egg',
    'سندويش البيض الكلاسيكي',
    'The Classic Egg Sandwich',
    'بيض طازج مخفوق بإتقان، محاط بخبز طري ذهبي — بساطة تحكي فن الفطور البغدادي',
    'Freshly whisked eggs folded to perfection in golden soft bread — simplicity that speaks the art of Baghdadi breakfast',
    1.000,
    'traditional-sandwiches',
    '/assets/gallery/egg-sandwich.webp',
    true
  ),
  (
    'sandwiches-egg-zaatar',
    'سندويش البيض بالزعتر البلدي',
    'Egg & Wild Za''atar Sandwich',
    'توليفة عراقية أصيلة بين البيض الطازج وعبق الزعتر البلدي، في كل لقمة نكهة الأرض',
    'An authentic Iraqi pairing of fresh eggs and aromatic wild za''atar — every bite carries the soul of the land',
    1.200,
    'traditional-sandwiches',
    '/assets/gallery/egg-zaatar-sandwich.webp',
    true
  ),
  (
    'sandwiches-egg-meat',
    'سندويش البيض باللحم المفروم',
    'Egg & Spiced Minced Meat Sandwich',
    'لحم مفروم متبّل بالبهارات العراقية مع بيض طازج — ثنائي فاخر يشبع الروح قبل الجسد',
    'Seasoned minced meat with fresh eggs — a hearty duo rich in Iraqi spice tradition',
    1.500,
    'traditional-sandwiches',
    '/assets/gallery/egg-meat-sandwich.webp',
    true
  ),
  (
    'sandwiches-egg-potato',
    'سندويش البيض بالبطاطس المقرمشة',
    'Egg & Crispy Potato Sandwich',
    'شرائح بطاطس مقرمشة مع بيض طري — تناقض رائع في الملمس يجعل كل قضمة مغامرة',
    'Golden crispy potato slices nestled with soft eggs — a delightful contrast in every bite',
    1.200,
    'traditional-sandwiches',
    '/assets/gallery/egg-potato-sandwich.webp',
    true
  ),
  (
    'sandwiches-egg-pastrami',
    'سندويش البيض بالباسترما الفاخرة',
    'Egg & Premium Basterma Sandwich',
    'باسترما مشرقية عريقة مع بيض طازج — نكهة مركّزة وعميقة تليق بذواقة الطعام الرفيع',
    'Aged Levantine basterma with fresh eggs — an intense, layered flavor worthy of the finest table',
    1.500,
    'traditional-sandwiches',
    '/assets/gallery/egg-pastrami-sandwich.webp',
    true
  ),
  (
    'sandwiches-egg-cheese',
    'سندويش البيض بالجبن الذائب',
    'Egg & Melted Cheese Sandwich',
    'جبن طري ذائب يغلّف البيض الطازج بدفء الحنين — الكلاسيكية في أبهى صورها',
    'Creamy melted cheese embracing fresh eggs in warm, nostalgic perfection — a timeless classic',
    1.500,
    'traditional-sandwiches',
    '/assets/gallery/egg-cheese-sandwich.webp',
    true
  ),
  (
    'sandwiches-egg-tomato',
    'سندويش البيض بالطماطم الطازجة',
    'Egg & Fresh Tomato Sandwich',
    'طماطم طازجة حمراء ناضجة مع بيض محضّر بعناية — خفّة صحية وإشباع حقيقي',
    'Ripe, juicy tomatoes paired with carefully prepared eggs — light, wholesome, and deeply satisfying',
    1.200,
    'traditional-sandwiches',
    '/assets/gallery/egg-tomato-sandwich.webp',
    true
  )
ON CONFLICT (id) DO NOTHING;
