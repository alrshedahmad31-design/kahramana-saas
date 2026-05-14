-- 143_move_samoon_meat_to_pastries.sql
--
-- Move "صمون عراقي لحم (كص)" / "Meat Shawarma in Samoon" from
-- the-shawarma-suite-kaas → baghdadi-tandoor-selection.
--
-- The item is conceptually a stuffed bread (samoon), so it belongs with
-- the tandoor / pastries selection rather than the shawarma plates. The
-- menu.json fixture has been updated to match in the same commit.
--
-- Item id is intentionally preserved (`shawarma-samoon-meat`) so that any
-- existing order_items, cart entries in localStorage, and SEO URLs keep
-- working. The slug-prefix is informational only — the source of truth for
-- which section an item appears in is `menu_items.category`.

UPDATE menu_items
SET category = 'baghdadi-tandoor-selection'
WHERE id = 'shawarma-samoon-meat'
  AND category = 'the-shawarma-suite-kaas';
