-- Migration 106: KDS Backfill
-- Goal: Update existing items to match the new 5-station routing.
-- Now safe because the enum values were committed in previous migrations.

UPDATE order_item_station_status oiss
SET station = (
  CASE
    WHEN LOWER(oi.menu_item_slug) LIKE 'shawarma-%' OR oi.name_ar LIKE '%شاورما%' OR oi.name_ar LIKE '%صاج%' OR oi.name_ar LIKE '%شباتي%' THEN 'shawarma'::kds_station
    WHEN LOWER(oi.menu_item_slug) LIKE 'sandwiches-%' OR LOWER(oi.menu_item_slug) LIKE '%sandwich%' THEN 'shawarma'::kds_station
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'stews-%' OR oi.name_ar LIKE '%مرق%' OR oi.name_ar LIKE '%تبسي%' THEN 'mains'::kds_station
    WHEN LOWER(oi.menu_item_slug) LIKE 'main-%' OR LOWER(oi.menu_item_slug) LIKE 'mains-%' OR LOWER(oi.menu_item_slug) LIKE 'rice-%' THEN 'mains'::kds_station
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'grills-%' OR LOWER(oi.menu_item_slug) LIKE 'bbq-%' THEN 'grill'::kds_station
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'pizza-%' OR LOWER(oi.menu_item_slug) LIKE 'pastry-%' OR LOWER(oi.menu_item_slug) LIKE 'fatayer-%' OR LOWER(oi.menu_item_slug) LIKE 'bread-%' THEN 'pizza'::kds_station
    
    WHEN LOWER(oi.menu_item_slug) LIKE 'cold-%' OR LOWER(oi.menu_item_slug) LIKE 'hot-%' OR LOWER(oi.menu_item_slug) LIKE 'drinks-%' 
      OR LOWER(oi.menu_item_slug) LIKE 'dessert%' OR LOWER(oi.menu_item_slug) LIKE 'breakfast-%' OR LOWER(oi.menu_item_slug) LIKE 'salad-%' 
      OR LOWER(oi.menu_item_slug) LIKE 'soup-%' OR LOWER(oi.menu_item_slug) LIKE 'appetizers-%' THEN 'cold'::kds_station
      
    ELSE oiss.station
  END
)
FROM order_items oi
WHERE oiss.item_id = oi.id;
