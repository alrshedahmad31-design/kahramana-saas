-- ============================================================
-- Kahramana Baghdad — Restore Dashboard Views
-- Migration: 044_restore_dashboard_views.sql
-- Description: Restores full functionality to v_dish_cogs and 
-- adds bilingual support to v_inventory_valuation.
-- ============================================================

-- 1. Restore v_dish_cogs with all fields needed by the dashboard
CREATE OR REPLACE VIEW v_dish_cogs
WITH (security_invoker = true) AS
WITH ingredient_costs AS (
  SELECT
    r.menu_item_slug,
    SUM(
      r.quantity * COALESCE(r.yield_factor, i.default_yield_factor, 1.000) * i.cost_per_unit
    ) AS cost_bhd
  FROM recipes r
  JOIN ingredients i ON i.id = r.ingredient_id
  WHERE r.ingredient_id IS NOT NULL
  GROUP BY r.menu_item_slug
),
prep_costs AS (
  SELECT
    r.menu_item_slug,
    SUM(
      r.quantity * COALESCE(r.yield_factor, 1.000)
      * (
        SELECT COALESCE(
          SUM(pii.quantity * COALESCE(pii.yield_factor, ing.default_yield_factor, 1.000) * ing.cost_per_unit),
          0
        )
        FROM prep_item_ingredients pii
        JOIN ingredients ing ON ing.id = pii.ingredient_id
        WHERE pii.prep_item_id = r.prep_item_id
      ) / NULLIF(p.batch_yield_qty, 0)
    ) AS cost_bhd
  FROM recipes r
  JOIN prep_items p ON p.id = r.prep_item_id
  WHERE r.prep_item_id IS NOT NULL
  GROUP BY r.menu_item_slug
),
total_costs AS (
  SELECT menu_item_slug, SUM(cost_bhd) AS cost_bhd
  FROM (
    SELECT menu_item_slug, cost_bhd FROM ingredient_costs
    UNION ALL
    SELECT menu_item_slug, cost_bhd FROM prep_costs
  ) combined
  GROUP BY menu_item_slug
)
SELECT
  m.slug,
  m.name_ar,
  m.name_en,
  m.price_bhd                                                     AS selling_price,
  ROUND(COALESCE(tc.cost_bhd, 0), 4)                              AS cost_bhd,
  ROUND(COALESCE(m.price_bhd, 0) - COALESCE(tc.cost_bhd, 0), 4)  AS profit_bhd,
  CASE
    WHEN m.price_bhd > 0
    THEN ROUND(
      (COALESCE(m.price_bhd, 0) - COALESCE(tc.cost_bhd, 0)) / m.price_bhd * 100,
      2
    )
    ELSE NULL
  END                                                              AS margin_pct
FROM menu_items_sync m
LEFT JOIN total_costs tc ON tc.menu_item_slug = m.slug;

-- 2. Update v_inventory_valuation for bilingual branch names
CREATE OR REPLACE VIEW v_inventory_valuation
WITH (security_invoker = true) AS
SELECT
  b.id                                                   AS branch_id,
  b.name_ar                                              AS branch_name_ar,
  b.name_en                                              AS branch_name_en,
  i.category,
  COUNT(DISTINCT s.ingredient_id)                        AS ingredient_count,
  ROUND(SUM(s.on_hand * i.cost_per_unit), 3)             AS total_value_bhd,
  ROUND(SUM(s.reserved * i.cost_per_unit), 3)            AS reserved_value_bhd
FROM inventory_stock s
JOIN ingredients i ON i.id = s.ingredient_id
JOIN branches b ON b.id = s.branch_id
WHERE i.is_active = true
GROUP BY b.id, b.name_ar, b.name_en, i.category;
