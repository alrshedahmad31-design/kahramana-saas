-- 182_backfill_menu_items_sync.sql
--
-- Backfills 8 rows into menu_items_sync that were missed by the original
-- seed loader: 7 egg sandwiches (added by migration 144) and Turkish
-- Coffee (added by migration 180). Without these rows, the live KDS
-- router fn_kds_enqueue_item falls back to 'packing' (which has no entry
-- in STATION_CONFIG and renders as Unassigned in the UI), so the items
-- never reach the right station screen at the kitchen.
--
-- Station choices, matching existing conventions in menu_items_sync:
--   * sandwiches-egg-*   → 'mains'   (9 of 13 sandwiches-* rows in sync
--                                     are 'mains'; the other 4 are the
--                                     kabab/tikka items routed to 'grill')
--   * turkish-coffee     → 'cold'    (all 13 existing drinks-* rows in
--                                     sync use 'cold' — drinks share the
--                                     cold mezza screen at this kitchen)
--
-- Pulls name_ar / name_en / price_bhd directly from menu_items so the
-- sync mirror stays consistent with the source-of-truth row.
--
-- Idempotent — ON CONFLICT (slug) DO NOTHING. Safe to re-run.

INSERT INTO menu_items_sync (slug, name_ar, name_en, price_bhd, station, sync_source)
SELECT id, name_ar, name_en, price_bhd, 'mains'::kds_station, 'menu.json'
FROM menu_items
WHERE id LIKE 'sandwiches-egg%'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO menu_items_sync (slug, name_ar, name_en, price_bhd, station, sync_source)
SELECT id, name_ar, name_en, price_bhd, 'cold'::kds_station, 'menu.json'
FROM menu_items
WHERE id = 'turkish-coffee'
ON CONFLICT (slug) DO NOTHING;
