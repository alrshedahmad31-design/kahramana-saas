-- 183_kds_unassigned_fallback.sql
--
-- Aligns the live KDS router's fallback station with the UI taxonomy.
--
-- Before: fn_kds_enqueue_item() wrote `'packing'` into kds_queue.station
-- when an order item's slug was missing from menu_items_sync. `'packing'`
-- is a legacy enum value that has no entry in src/constants/kds.ts
-- STATION_CONFIG, so getStationConfig() cosmetically remapped it to
-- the Unassigned screen at render time. The DB column and the UI screen
-- thus disagreed for 82 historical rows, making any station-based query,
-- dashboard, or future migration fragile.
--
-- After: the trigger writes `'unassigned'` directly (the canonical UI
-- key already present in STATION_CONFIG). One pass of cosmetic backfill
-- realigns the 82 existing `'packing'` rows + any other legacy values
-- still on disk so the column matches what the kitchen already sees.
--
-- Affected paths:
--   * fn_kds_enqueue_item — only the fallback branch; mapped-slug routing
--     is unchanged.
--   * kds_queue — UPDATE touches rows whose station is one of the abandoned
--     legacy enum values (packing, fryer, bakery, appetizer_drinks, main,
--     fry, salads, drinks, desserts). All current data lives in either the
--     canonical 5 or `packing`; the wider IN-list is defensive against
--     forgotten in-flight rows from older trigger generations.
--
-- KDSStation TS union keeps the legacy values (per session-154 decision)
-- so any historical export still type-checks. No client code change here.
--
-- Idempotent — running again is a no-op once all rows are canonical.

CREATE OR REPLACE FUNCTION public.fn_kds_enqueue_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_station kds_station;
BEGIN
  SELECT station INTO v_station
  FROM menu_items_sync
  WHERE slug = NEW.menu_item_slug;

  -- Unmapped slugs land on the Unassigned UI screen; the DB column now
  -- agrees instead of saying 'packing' and relying on a render-time alias.
  IF v_station IS NULL THEN
    v_station := 'unassigned';
  END IF;

  INSERT INTO kds_queue (order_id, order_item_id, station, status, priority, created_at)
  VALUES (NEW.order_id, NEW.id, v_station, 'pending', 0, NOW());

  RETURN NEW;
END;
$function$;

UPDATE kds_queue
SET    station = 'unassigned'
WHERE  station IN (
         'packing',
         'fryer',
         'bakery',
         'appetizer_drinks',
         'main',
         'fry',
         'salads',
         'drinks',
         'desserts'
       );
