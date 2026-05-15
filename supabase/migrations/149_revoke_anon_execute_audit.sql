-- 149_revoke_anon_execute_audit.sql
--
-- L4 anon EXECUTE re-audit (session 115).
--
-- Probe found 31 distinct functions with anon EXECUTE in `public`.
-- Most are trigger functions (anon EXECUTE is a no-op for triggers) or
-- legitimately public RPCs (rpc_create_order, rpc_create_reservation,
-- rpc_find_available_tables, rpc_create_customer_profile, normalize_bahrain_phone,
-- calculate_loyalty_tier, auth_user_role, auth_user_branch_id).
--
-- This migration revokes EXECUTE from anon on functions that have NO public
-- use case and DO have a real impact (writes, info disclosure, or DoS).
--
-- ROLLBACK:
--   GRANT EXECUTE ON FUNCTION public.rpc_record_opening_balance(text, uuid, numeric, uuid) TO anon;
--   GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO anon;
--   GRANT EXECUTE ON FUNCTION public.fn_check_price_spike(uuid, numeric, text) TO anon;
--   GRANT EXECUTE ON FUNCTION public.get_labor_cost_metrics(timestamptz, timestamptz, text) TO anon;
--   GRANT EXECUTE ON FUNCTION public.get_menu_engineering_matrix(timestamptz, timestamptz, text) TO anon;
--   GRANT EXECUTE ON FUNCTION public.get_station_daily_count(kds_station, text) TO anon;
--   GRANT EXECUTE ON FUNCTION public.refresh_analytics_views() TO anon;
--   GRANT EXECUTE ON FUNCTION public.cleanup_driver_locations() TO anon;
--   GRANT EXECUTE ON FUNCTION public.cancel_expired_pending_payment_orders() TO anon;

-- ── CRITICAL: writes to internal tables under SECURITY DEFINER ────────────────

-- rpc_record_opening_balance: writes inventory_movements + inventory_stock.
-- Anon caller could rewrite any branch's inventory ledger.
REVOKE EXECUTE ON FUNCTION public.rpc_record_opening_balance(text, uuid, numeric, uuid) FROM anon;

-- increment_coupon_usage: UPDATEs coupons.usage_count. Anon could burn coupon
-- usage to invalidate active codes (DoS coupon system).
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) FROM anon;

-- fn_check_price_spike: INSERTs into inventory_alerts. Anon caller could spam
-- alerts with arbitrary branch / ingredient / change_pct payloads.
REVOKE EXECUTE ON FUNCTION public.fn_check_price_spike(uuid, numeric, text) FROM anon;

-- ── HIGH: information disclosure under SECURITY DEFINER ───────────────────────

-- get_labor_cost_metrics: exposes hourly_rate * hours, staff count, revenue.
-- Reveals labor cost % — internal business metric.
REVOKE EXECUTE ON FUNCTION public.get_labor_cost_metrics(timestamp with time zone, timestamp with time zone, text) FROM anon;

-- get_menu_engineering_matrix: joins v_dish_cogs to expose per-dish profit
-- margins and Star/Plowhorse/Puzzle/Dog classification — competitive intel.
REVOKE EXECUTE ON FUNCTION public.get_menu_engineering_matrix(timestamp with time zone, timestamp with time zone, text) FROM anon;

-- get_station_daily_count: operational KDS throughput per station.
REVOKE EXECUTE ON FUNCTION public.get_station_daily_count(kds_station, text) FROM anon;

-- ── MEDIUM: DoS vectors ────────────────────────────────────────────────────────

-- refresh_analytics_views: REFRESH MATERIALIZED VIEW CONCURRENTLY on 5 views.
-- Each call is expensive; anon could trigger repeatedly.
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_views() FROM anon;

-- cleanup_driver_locations: DELETE FROM driver_locations. Bounded to >7d, but
-- DEFINER + anon = cycle-burn DoS vector with no use case.
REVOKE EXECUTE ON FUNCTION public.cleanup_driver_locations() FROM anon;

-- ── LOW: hygiene (INVOKER so RLS gates it, but no anon use case) ──────────────

REVOKE EXECUTE ON FUNCTION public.cancel_expired_pending_payment_orders() FROM anon;
