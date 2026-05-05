-- ============================================================
-- Kahramana Baghdad — Update Analytics & Inventory for 'returned'
-- Migration: 055_update_analytics_for_returned.sql
-- ============================================================

-- 1. Update Materialized Views (Analytics)
-- We need to DROP and RECREATE them because the WHERE clause is part of the definition.

-- daily_sales
DROP MATERIALIZED VIEW IF EXISTS daily_sales CASCADE;
CREATE MATERIALIZED VIEW daily_sales AS
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Bahrain')  AS order_date,
  branch_id,
  COUNT(*)                                       AS order_count,
  COALESCE(SUM(total_bhd),  0)                  AS total_revenue_bhd,
  COALESCE(AVG(total_bhd),  0)                  AS avg_order_value_bhd
FROM orders
WHERE status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY
  DATE(created_at AT TIME ZONE 'Asia/Bahrain'),
  branch_id
ORDER BY order_date DESC;

CREATE UNIQUE INDEX idx_daily_sales_pk ON daily_sales (order_date, branch_id);
CREATE INDEX idx_daily_sales_date ON daily_sales (order_date DESC);

-- top_menu_items
DROP MATERIALIZED VIEW IF EXISTS top_menu_items CASCADE;
CREATE MATERIALIZED VIEW top_menu_items AS
SELECT
  oi.menu_item_slug,
  oi.name_ar,
  oi.name_en,
  SUM(oi.quantity)::INTEGER                   AS total_quantity,
  COALESCE(SUM(oi.item_total_bhd), 0)         AS total_revenue_bhd,
  COUNT(DISTINCT oi.order_id)::INTEGER         AS order_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY oi.menu_item_slug, oi.name_ar, oi.name_en
ORDER BY total_quantity DESC;

CREATE UNIQUE INDEX idx_top_items_slug ON top_menu_items (menu_item_slug);

-- customer_lifetime_value
DROP MATERIALIZED VIEW IF EXISTS customer_lifetime_value CASCADE;
CREATE MATERIALIZED VIEW customer_lifetime_value AS
SELECT
  o.customer_phone,
  MAX(o.customer_name)                          AS customer_name,
  COUNT(*)::INTEGER                             AS order_count,
  COALESCE(SUM(o.total_bhd),  0)               AS total_spent_bhd,
  COALESCE(AVG(o.total_bhd),  0)               AS avg_order_value_bhd,
  MIN(o.created_at)                             AS first_order_at,
  MAX(o.created_at)                             AS last_order_at
FROM orders o
WHERE
  o.customer_phone IS NOT NULL
  AND o.status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY o.customer_phone
ORDER BY total_spent_bhd DESC;

CREATE UNIQUE INDEX idx_clv_phone ON customer_lifetime_value (customer_phone);

-- hourly_order_distribution
DROP MATERIALIZED VIEW IF EXISTS hourly_order_distribution CASCADE;
CREATE MATERIALIZED VIEW hourly_order_distribution AS
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bahrain')::INTEGER  AS hour_of_day,
  COUNT(*)::INTEGER                                                    AS order_count,
  COALESCE(SUM(total_bhd), 0)                                         AS total_revenue_bhd,
  COALESCE(AVG(total_bhd), 0)                                         AS avg_order_value_bhd
FROM orders
WHERE status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bahrain')
ORDER BY hour_of_day;

CREATE UNIQUE INDEX idx_hourly_dist_hour ON hourly_order_distribution (hour_of_day);

-- menu_item_performance
DROP MATERIALIZED VIEW IF EXISTS menu_item_performance CASCADE;
CREATE MATERIALIZED VIEW menu_item_performance AS
SELECT
  oi.menu_item_slug                              AS item_id,
  oi.name_ar,
  oi.name_en,
  SUM(oi.quantity)::INTEGER                      AS total_quantity,
  COUNT(DISTINCT oi.order_id)::INTEGER           AS order_count,
  COALESCE(SUM(oi.item_total_bhd),  0)           AS total_revenue,
  COALESCE(AVG(oi.unit_price_bhd),  0)           AS avg_price,
  COALESCE(SUM(oi.item_total_bhd),  0) * 0.65   AS estimated_profit
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.id
WHERE o.status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY oi.menu_item_slug, oi.name_ar, oi.name_en;

CREATE UNIQUE INDEX idx_menu_perf_slug ON menu_item_performance(item_id);

-- 2. Update Regular Views
-- customer_segments_view (depends on customer_lifetime_value, recreated by CASCADE above)
CREATE OR REPLACE VIEW customer_segments_view AS
SELECT
  customer_phone,
  customer_name,
  order_count,
  total_spent_bhd,
  avg_order_value_bhd,
  first_order_at,
  last_order_at,
  CASE
    WHEN order_count >= 20 THEN 'vip'
    WHEN order_count >= 5  THEN 'regular'
    WHEN order_count >= 2  THEN 'occasional'
    ELSE                        'one_time'
  END AS segment
FROM customer_lifetime_value;

-- coupon_analytics_view
CREATE OR REPLACE VIEW coupon_analytics_view AS
SELECT
  c.id,
  c.code,
  c.type,
  c.value,
  c.campaign_name,
  c.usage_count,
  c.usage_limit,
  c.is_active,
  COALESCE(SUM(o.total_bhd),              0) AS revenue_with_coupon,
  COALESCE(SUM(o.coupon_discount_bhd),    0) AS total_discount_given,
  COUNT(o.id)::INTEGER                       AS order_count_from_coupon,
  COALESCE(SUM(o.total_bhd), 0)
    - COALESCE(SUM(o.coupon_discount_bhd), 0) AS net_revenue,
  CASE
    WHEN COALESCE(SUM(o.coupon_discount_bhd), 0) = 0 THEN NULL
    ELSE ROUND(
      ((COALESCE(SUM(o.total_bhd), 0) - COALESCE(SUM(o.coupon_discount_bhd), 0))
        / NULLIF(COALESCE(SUM(o.coupon_discount_bhd), 0), 0)) * 100, 1
    )
  END AS roi_percent
FROM coupons c
LEFT JOIN orders o
  ON o.coupon_id = c.id
  AND o.status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY c.id, c.code, c.type, c.value, c.campaign_name,
         c.usage_count, c.usage_limit, c.is_active
ORDER BY revenue_with_coupon DESC;

-- order_source_summary
CREATE OR REPLACE VIEW order_source_summary AS
SELECT
  COALESCE(NULLIF(TRIM(source), ''), 'web') AS source,
  COUNT(*)::INTEGER                          AS order_count,
  COALESCE(SUM(total_bhd), 0)               AS revenue
FROM orders
WHERE status NOT IN ('cancelled', 'payment_failed', 'returned')
GROUP BY COALESCE(NULLIF(TRIM(source), ''), 'web')
ORDER BY revenue DESC;

-- 3. Update Refresh Function
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_menu_items;
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_lifetime_value;
  REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_order_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY menu_item_performance;
END;
$$;

-- 4. Harden Inventory Trigger Logic
-- Fix: Prevent double-consumption and handle 'returned' as terminal state.
CREATE OR REPLACE FUNCTION fn_inventory_finalize_or_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type  inventory_movement_type;
  rec     RECORD;
BEGIN
  -- Determine action: consumption for success/return, release for cancellation.
  IF NEW.status IN ('delivered','completed','returned') THEN
    v_type := 'consumption';
  ELSE
    v_type := 'release';
  END IF;

  -- CRITICAL: Check if this order has ALREADY been finalized (consumption or release).
  -- This prevents double-deduction when moving from 'delivered' -> 'completed' or 'returned'.
  IF EXISTS (
    SELECT 1 FROM inventory_movements 
    WHERE order_id = NEW.id 
    AND movement_type IN ('consumption', 'release')
  ) THEN
    RETURN NEW;
  END IF;

  FOR rec IN
    SELECT ingredient_id, SUM(quantity) AS total_qty
    FROM inventory_movements
    WHERE order_id = NEW.id
      AND movement_type = 'reservation'
    GROUP BY ingredient_id
  LOOP
    IF v_type = 'consumption' THEN
      UPDATE inventory_stock
      SET
        reserved         = GREATEST(0, reserved - rec.total_qty),
        on_hand          = GREATEST(0, on_hand  - rec.total_qty),
        last_movement_at = NOW()
      WHERE branch_id     = NEW.branch_id
        AND ingredient_id = rec.ingredient_id;
    ELSE
      UPDATE inventory_stock
      SET
        reserved         = GREATEST(0, reserved - rec.total_qty),
        last_movement_at = NOW()
      WHERE branch_id     = NEW.branch_id
        AND ingredient_id = rec.ingredient_id;
    END IF;

    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity, order_id, performed_at
    ) VALUES (
      NEW.branch_id, rec.ingredient_id, v_type, rec.total_qty, NEW.id, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Update trigger condition to include 'returned'
DROP TRIGGER IF EXISTS trg_inventory_finalize ON orders;
CREATE TRIGGER trg_inventory_finalize
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (
    NEW.status IN ('delivered','completed','cancelled','returned')
    AND NEW.status IS DISTINCT FROM OLD.status
  )
  EXECUTE FUNCTION fn_inventory_finalize_or_release();

-- 5. Refresh All Data
SELECT refresh_analytics_views();
