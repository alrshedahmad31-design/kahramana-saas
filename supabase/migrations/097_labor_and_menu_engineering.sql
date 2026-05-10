-- ============================================================
-- Kahramana Baghdad — Labor and Menu Engineering Analytics
-- Migration: 097_labor_and_menu_engineering.sql
-- ============================================================

-- 1. Labor Cost vs Revenue RPC
-- Aggregates total labor cost (time_entries.total_hours * staff_basic.hourly_rate)
-- and revenue (orders.total_bhd) for a specific branch or all branches
-- within a date range.
--
-- Note: branches.branch_id is TEXT project-wide (per migration 066_fix_branch_id_type),
-- so p_branch_id must also be TEXT — using UUID would cause silent comparison failure.

CREATE OR REPLACE FUNCTION get_labor_cost_metrics(
  p_from_date TIMESTAMPTZ,
  p_to_date   TIMESTAMPTZ,
  p_branch_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_revenue         NUMERIC,
  total_labor_cost      NUMERIC,
  labor_cost_percentage NUMERIC,
  order_count           BIGINT,
  staff_count           BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revenue NUMERIC;
  v_labor   NUMERIC;
  v_orders  BIGINT;
  v_staff   BIGINT;
BEGIN
  -- 1. Revenue + order count
  SELECT
    COALESCE(SUM(total_bhd), 0),
    COUNT(*)
  INTO v_revenue, v_orders
  FROM orders
  WHERE created_at >= p_from_date AND created_at <= p_to_date
    AND status NOT IN ('cancelled', 'payment_failed', 'returned')
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  -- 2. Labor cost
  -- Prefer the stored total_hours column; fall back to derived clock_out − clock_in
  -- so the function still works for rows where total_hours wasn't backfilled.
  SELECT
    COALESCE(
      SUM(
        COALESCE(
          te.total_hours,
          EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600,
          0
        ) * sb.hourly_rate
      ),
      0
    ),
    COUNT(DISTINCT sb.id)
  INTO v_labor, v_staff
  FROM time_entries te
  JOIN staff_basic  sb ON sb.id = te.staff_id
  WHERE te.clock_in >= p_from_date AND te.clock_in <= p_to_date
    AND te.clock_out IS NOT NULL
    AND (p_branch_id IS NULL OR sb.branch_id = p_branch_id);

  RETURN QUERY SELECT
    v_revenue,
    v_labor,
    CASE WHEN v_revenue > 0 THEN (v_labor / v_revenue) * 100 ELSE 0 END,
    v_orders,
    v_staff;
END;
$$;

-- 2. Menu Engineering Matrix RPC
-- Classifies items into Star, Plowhorse, Puzzle, Dog
-- X-Axis: Popularity (quantity sold relative to average)
-- Y-Axis: Profitability (profit per item relative to average)
--
-- Refactored from CREATE TEMP TABLE to a chained CTE — same query plan,
-- no concurrency edge case, no DROP needed.

CREATE OR REPLACE FUNCTION get_menu_engineering_matrix(
  p_from_date TIMESTAMPTZ,
  p_to_date   TIMESTAMPTZ,
  p_branch_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  slug                 TEXT,
  name_ar              TEXT,
  name_en              TEXT,
  total_quantity       BIGINT,
  total_revenue        NUMERIC,
  profit_per_item      NUMERIC,
  total_profit         NUMERIC,
  popularity_score     NUMERIC,
  profitability_score  NUMERIC,
  classification       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_qty    NUMERIC;
  v_avg_profit NUMERIC;
BEGIN
  -- Pre-compute per-slug performance into a temporary holder so we can
  -- read it twice (once for the averages, once for the joined result).
  -- Using a chained CTE inside a single SELECT achieves the same goal as
  -- a TEMP TABLE without the cross-call session-scope race risk.
  RETURN QUERY
  WITH perf AS (
    SELECT
      oi.menu_item_slug,
      SUM(oi.quantity)::NUMERIC      AS total_qty,
      SUM(oi.item_total_bhd)         AS total_rev,
      COALESCE(vc.profit_bhd, 0)     AS profit_per_unit
    FROM order_items oi
    JOIN orders o            ON o.id = oi.order_id
    LEFT JOIN v_dish_cogs vc ON vc.slug = oi.menu_item_slug
    WHERE o.created_at >= p_from_date AND o.created_at <= p_to_date
      AND o.status NOT IN ('cancelled', 'payment_failed', 'returned')
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
    GROUP BY oi.menu_item_slug, vc.profit_bhd
  ),
  averages AS (
    SELECT
      AVG(total_qty)        AS avg_qty,
      AVG(profit_per_unit)  AS avg_profit
    FROM perf
  )
  SELECT
    m.slug,
    m.name_ar,
    m.name_en,
    p.total_qty::BIGINT,
    p.total_rev,
    p.profit_per_unit,
    (p.total_qty * p.profit_per_unit)::NUMERIC,
    CASE WHEN a.avg_qty    > 0 THEN p.total_qty       / a.avg_qty    ELSE 0 END,
    CASE WHEN a.avg_profit > 0 THEN p.profit_per_unit / a.avg_profit ELSE 0 END,
    CASE
      WHEN p.total_qty       >= COALESCE(a.avg_qty, 0)
       AND p.profit_per_unit >= COALESCE(a.avg_profit, 0) THEN 'Star'
      WHEN p.total_qty       >= COALESCE(a.avg_qty, 0)
       AND p.profit_per_unit <  COALESCE(a.avg_profit, 0) THEN 'Plowhorse'
      WHEN p.total_qty       <  COALESCE(a.avg_qty, 0)
       AND p.profit_per_unit >= COALESCE(a.avg_profit, 0) THEN 'Puzzle'
      ELSE 'Dog'
    END
  -- INNER JOIN: only items with sales in the period (matches the WHERE
  -- t.total_qty > 0 intent from the original LEFT JOIN, without the
  -- contradictory outer-join semantics).
  FROM menu_items_sync m
  INNER JOIN perf p ON p.menu_item_slug = m.slug
  CROSS JOIN averages a
  ORDER BY p.total_qty DESC;
END;
$$;

-- ============================================================
-- Permissions: Supabase strips default PUBLIC EXECUTE on functions,
-- so the dashboard role (`authenticated`) must be granted explicitly
-- or the RPC fails with permission denied.
-- ============================================================

GRANT EXECUTE ON FUNCTION get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)   TO authenticated;

-- ROLLBACK
-- DROP FUNCTION IF EXISTS get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
-- DROP FUNCTION IF EXISTS get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
