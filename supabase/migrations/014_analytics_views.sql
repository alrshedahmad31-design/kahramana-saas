-- ============================================================
-- Kahramana Baghdad — Analytics Materialized Views (Phase 7)
-- Migration: 014_analytics_views.sql
-- Applied: 2026-04-28
--
-- NOTE: Materialized views do not support RLS.
-- Access exclusively via service_role client; RBAC enforced at application layer.
--
-- Refresh: SELECT refresh_analytics_views();
-- Auto-refresh: Requires pg_cron extension (Supabase: Dashboard > Extensions > pg_cron)
--   SELECT cron.schedule('analytics-refresh', '0 * * * *', 'SELECT refresh_analytics_views();');
--
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── daily_sales ───────────────────────────────────────────────────────────────
-- Aggregates order totals by calendar date (Bahrain timezone UTC+3) and branch.
-- Excludes cancelled and payment_failed orders.

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales AS
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Bahrain')  AS order_date,
  branch_id,
  COUNT(*)                                       AS order_count,
  COALESCE(SUM(total_bhd),  0)                  AS total_revenue_bhd,
  COALESCE(AVG(total_bhd),  0)                  AS avg_order_value_bhd
FROM orders
WHERE status NOT IN ('cancelled', 'payment_failed')
GROUP BY
  DATE(created_at AT TIME ZONE 'Asia/Bahrain'),
  branch_id
ORDER BY order_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_pk
  ON daily_sales (order_date, branch_id);

CREATE INDEX IF NOT EXISTS idx_daily_sales_date
  ON daily_sales (order_date DESC);

-- ── top_menu_items ────────────────────────────────────────────────────────────
-- All-time top sellers by quantity.
-- Excludes items from cancelled / payment_failed orders.

CREATE MATERIALIZED VIEW IF NOT EXISTS top_menu_items AS
SELECT
  oi.menu_item_slug,
  oi.name_ar,
  oi.name_en,
  SUM(oi.quantity)::INTEGER                   AS total_quantity,
  COALESCE(SUM(oi.item_total_bhd), 0)         AS total_revenue_bhd,
  COUNT(DISTINCT oi.order_id)::INTEGER         AS order_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'payment_failed')
GROUP BY oi.menu_item_slug, oi.name_ar, oi.name_en
ORDER BY total_quantity DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_top_items_slug
  ON top_menu_items (menu_item_slug);

-- ── customer_lifetime_value ───────────────────────────────────────────────────
-- Total spend per customer (phone-identified only; anonymous guests excluded).

CREATE MATERIALIZED VIEW IF NOT EXISTS customer_lifetime_value AS
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
  AND o.status NOT IN ('cancelled', 'payment_failed')
GROUP BY o.customer_phone
ORDER BY total_spent_bhd DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clv_phone
  ON customer_lifetime_value (customer_phone);

-- ── hourly_order_distribution ─────────────────────────────────────────────────
-- Orders grouped by hour of day (Bahrain time, 0–23) — all-time.

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_order_distribution AS
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bahrain')::INTEGER  AS hour_of_day,
  COUNT(*)::INTEGER                                                    AS order_count,
  COALESCE(SUM(total_bhd), 0)                                         AS total_revenue_bhd,
  COALESCE(AVG(total_bhd), 0)                                         AS avg_order_value_bhd
FROM orders
WHERE status NOT IN ('cancelled', 'payment_failed')
GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bahrain')
ORDER BY hour_of_day;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_dist_hour
  ON hourly_order_distribution (hour_of_day);

-- ── Refresh function ──────────────────────────────────────────────────────────

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
END;
$$;

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP FUNCTION  IF EXISTS refresh_analytics_views();
-- DROP MATERIALIZED VIEW IF EXISTS hourly_order_distribution;
-- DROP MATERIALIZED VIEW IF EXISTS customer_lifetime_value;
-- DROP MATERIALIZED VIEW IF EXISTS top_menu_items;
-- DROP MATERIALIZED VIEW IF EXISTS daily_sales;
