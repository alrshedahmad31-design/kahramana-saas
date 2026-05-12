-- Final backfill for Falafel and Shakshouka
UPDATE order_item_station_status
SET station = 'mains'
WHERE item_id IN (
    SELECT id FROM order_items
    WHERE name_ar LIKE '%فلافل%'
       OR name_ar LIKE '%شكشوكة%'
       OR name_ar LIKE '%بيض%'
       OR name_ar LIKE '%طاوة%'
       OR name_ar LIKE '%مخلمة%'
)
AND station != 'mains';
