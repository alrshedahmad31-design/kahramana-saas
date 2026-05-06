-- ============================================================
-- Kahramana Baghdad — Dashboard Audit Remediation
-- Migration: 043_dashboard_audit_remediation.sql
-- Description: Enforce RLS on views via security_invoker and fix bilingual fields.
-- ============================================================

-- 1. v_inventory_valuation (Add security_invoker + name_ar)
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

-- 2. v_dish_cogs (Add security_invoker)
-- Note: This view doesn't have branch_id directly but depends on ingredients/recipes
-- By enabling security_invoker, it will respect RLS on ingredients table if any exists.
CREATE OR REPLACE VIEW v_dish_cogs 
WITH (security_invoker = true) AS
WITH ingredient_costs AS (
  SELECT 
    ri.recipe_id,
    SUM(ri.quantity * i.cost_per_unit) AS total_ingredient_cost
  FROM recipe_ingredients ri
  JOIN ingredients i ON i.id = ri.ingredient_id
  GROUP BY ri.recipe_id
),
prep_item_costs AS (
  SELECT 
    rp.recipe_id,
    SUM(rp.quantity * pi.cost_per_unit) AS total_prep_cost
  FROM recipe_prep_items rp
  JOIN prep_items pi ON pi.id = rp.prep_item_id
  GROUP BY rp.recipe_id
)
SELECT 
  r.id                                     AS recipe_id,
  r.menu_item_slug,
  r.size_key,
  r.variant_key,
  COALESCE(ic.total_ingredient_cost, 0) + 
  COALESCE(pc.total_prep_cost, 0)           AS cogs_bhd,
  r.last_cost_update                       AS last_calculated_at
FROM recipes r
LEFT JOIN ingredient_costs ic ON ic.recipe_id = r.id
LEFT JOIN prep_item_costs pc ON pc.recipe_id = r.id;

-- 3. v_vendor_performance (Add security_invoker)
CREATE OR REPLACE VIEW v_vendor_performance 
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.name_ar,
  s.name_en,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'received')   AS total_orders,
  COALESCE(
    SUM(poi.quantity_received * poi.unit_cost) FILTER (WHERE po.status = 'received'),
    0
  )                                                              AS total_spent_bhd,
  ROUND(
    AVG(
      CASE 
        WHEN poi.quantity_ordered > 0 
        THEN GREATEST(0, (1.0 - ABS(poi.quantity_variance) / poi.quantity_ordered)) * 100
        ELSE 100 
      END
    ) FILTER (WHERE po.status = 'received'),
    2
  )                                                              AS delivery_accuracy_pct,
  ROUND(
    AVG(poi.quality_rating) FILTER (WHERE po.status = 'received' AND poi.quality_rating IS NOT NULL),
    2
  )                                                              AS avg_quality_rating,
  ROUND(
    AVG(
      CASE 
        WHEN po.expected_at IS NOT NULL AND po.received_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (po.received_at - po.expected_at::TIMESTAMPTZ)) / 86400.0
        ELSE 0 
      END
    ) FILTER (WHERE po.status = 'received'),
    2
  )                                                              AS avg_delay_days,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'cancelled')  AS cancelled_orders
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
GROUP BY s.id, s.name_ar, s.name_en;

-- 4. Audit Log
COMMENT ON VIEW v_inventory_valuation IS 'Enforces RLS via security_invoker and provides bilingual branch names.';
COMMENT ON VIEW v_dish_cogs IS 'Enforces RLS via security_invoker for recipe cost analysis.';
COMMENT ON VIEW v_vendor_performance IS 'Enforces RLS via security_invoker for supplier performance metrics.';
