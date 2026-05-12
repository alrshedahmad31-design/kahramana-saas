-- Migration 109: Comprehensive Backfill
-- Final mapping of all 13 legacy stations to the new 5-station architecture.

UPDATE order_item_station_status oiss
SET station = (
  CASE
    -- 1. Mains
    WHEN station::text IN ('main', 'mains') THEN 'mains'::kds_station
    WHEN LOWER(oi.menu_item_slug) LIKE 'mains-%' OR oi.name_ar LIKE '%مرق%' OR oi.name_ar LIKE '%تبسي%' THEN 'mains'::kds_station
    
    -- 2. Grill
    WHEN station::text IN ('grill') THEN 'grill'::kds_station
    
    -- 3. Shawarma
    WHEN station::text IN ('shawarma', 'sandwiches') THEN 'shawarma'::kds_station
    WHEN LOWER(oi.menu_item_slug) LIKE 'shawarma-%' OR oi.name_ar LIKE '%شاورما%' THEN 'shawarma'::kds_station
    
    -- 4. Pizza
    WHEN station::text IN ('bakery', 'pizza', 'pastry') THEN 'pizza'::kds_station
    WHEN LOWER(oi.menu_item_slug) LIKE 'pizza-%' OR LOWER(oi.menu_item_slug) LIKE 'fatayer-%' THEN 'pizza'::kds_station
    
    -- 5. Cold (Catch-all for everything else)
    WHEN station::text IN ('fry', 'fryer', 'salads', 'desserts', 'drinks', 'packing', 'appetizer_drinks', 'cold') THEN 'cold'::kds_station
    
    ELSE 'cold'::kds_station -- Default to cold for remaining legacy items
  END
)
FROM order_items oi
WHERE oiss.item_id = oi.id;
