-- 181_fix_egg_sandwich_station.sql
--
-- Cosmetic alignment of menu_items.station for the 7 egg-sandwich rows
-- seeded by migration 144. Those rows were inserted without specifying
-- the station column and picked up the column default 'main' (singular,
-- legacy enum value). All other rows in the table carry 'mains' (plural,
-- the canonical UI key in STATION_CONFIG / src/constants/kds.ts).
--
-- KDS routing impact: NONE. The live KDS router (fn_kds_enqueue_item)
-- reads menu_items_sync.station, not menu_items.station. This is purely
-- a data-consistency fix on menu_items so the column reflects one value
-- across the whole table.
--
-- Idempotent — re-running is a no-op once all rows are 'mains'.

UPDATE menu_items
SET station = 'mains'
WHERE station = 'main';
