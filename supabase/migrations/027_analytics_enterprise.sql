-- ============================================================
-- Kahramana Baghdad — Enterprise Analytics Layer
-- Migration: 018_analytics_enterprise.sql
-- Extends Phase 7 analytics views with BI-grade intelligence.
--
-- Requires: 014_analytics_views.sql already applied.
-- Service-role only — RBAC enforced at application layer.
--
-- Apply: Supabase SQL Editor
-- Rollback: see bottom
-- ============================================================

-- ── menu_item_performance ──────────────────────────────────────────────────────
-- Per-item aggregation with 65% profit margin estimate (replace when COGS known).
-- UNIQUE index on item_id required for CONCURRENTLY refresh.

CREATE MATERIALIZED VIEW IF NOT EXISTS menu_item_performance AS
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
WHERE o.status NOT IN ('cancelled', 'payment_failed')
GROUP BY oi.menu_item_slug, oi.name_ar, oi.name_en;

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_perf_slug ON menu_item_performance(item_id);
CREATE INDEX        IF NOT EXISTS idx_menu_perf_rev  ON menu_item_performance(total_revenue DESC);

-- ── customer_segments_view ────────────────────────────────────────────────────
-- Regular view — always live. Adds business segment to existing CLV matview.

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

-- ── coupon_analytics_view ─────────────────────────────────────────────────────
-- Live join of coupons × orders for ROI calculation.

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
  AND o.status NOT IN ('cancelled', 'payment_failed')
GROUP BY c.id, c.code, c.type, c.value, c.campaign_name,
         c.usage_count, c.usage_limit, c.is_active
ORDER BY revenue_with_coupon DESC;

-- ── order_source_summary ──────────────────────────────────────────────────────
-- Order count + revenue by acquisition channel.

CREATE OR REPLACE VIEW order_source_summary AS
SELECT
  COALESCE(NULLIF(TRIM(source), ''), 'web') AS source,
  COUNT(*)::INTEGER                          AS order_count,
  COALESCE(SUM(total_bhd), 0)               AS revenue
FROM orders
WHERE status NOT IN ('cancelled', 'payment_failed')
GROUP BY COALESCE(NULLIF(TRIM(source), ''), 'web')
ORDER BY revenue DESC;

-- ── Refresh function — adds menu_item_performance to existing schedule ─────────

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

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP VIEW IF EXISTS order_source_summary;
-- DROP VIEW IF EXISTS coupon_analytics_view;
-- DROP VIEW IF EXISTS customer_segments_view;
-- DROP MATERIALIZED VIEW IF EXISTS menu_item_performance;
-- (restore previous refresh_analytics_views that excludes menu_item_performance)
