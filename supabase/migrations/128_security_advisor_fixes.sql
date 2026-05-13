-- 128_security_advisor_fixes.sql
-- Resolves all Supabase Security Advisor warnings (86 warnings across 3 categories):
--   1. Function Search Path Mutable  → SET search_path on 21 functions
--   2. Public Can Execute SECURITY DEFINER → REVOKE EXECUTE on 11 functions
--   3. Materialized View in API → REVOKE SELECT on 6 internal analytics views
--
-- Per Supabase policy change (May/October 2026): new tables in public schema
-- require explicit GRANTs. This migration enforces the same discipline on
-- functions and views created before that policy.
--
-- Functions already correct — no changes:
--   rpc_create_purchase_order       mig 124 + 125 ✓
--   rpc_update_staff                mig 126 ✓
--   rpc_create_order                mig 062/083 ✓
--   rpc_create_reservation          mig 114/117 ✓
--   rpc_find_available_tables       mig 114 ✓
--   recall_station_order, bump_station_order,
--   update_order_item_station_status, get_station_daily_count   KDS hardening ✓

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP A  SECURITY DEFINER + no SET search_path  (high risk)
-- ─────────────────────────────────────────────────────────────────────────────

-- A1. Trigger functions — RETURNS TRIGGER, no parameters.
--     PostgREST does not expose RETURNS TRIGGER functions, but explicit REVOKE
--     silences the advisor and prevents direct SQL invocation by clients.

ALTER FUNCTION award_loyalty_points_on_completion()   SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION award_loyalty_points_on_completion() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION award_loyalty_points_on_completion() FROM authenticated;

ALTER FUNCTION fn_inventory_reserve()                 SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION fn_inventory_reserve() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION fn_inventory_reserve() FROM authenticated;

ALTER FUNCTION fn_inventory_finalize_or_release()     SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION fn_inventory_finalize_or_release() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION fn_inventory_finalize_or_release() FROM authenticated;

ALTER FUNCTION fn_waste_deduct()                      SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION fn_waste_deduct() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION fn_waste_deduct() FROM authenticated;

ALTER FUNCTION fn_po_receive_create_lot()             SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION fn_po_receive_create_lot() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION fn_po_receive_create_lot() FROM authenticated;

-- A2. Callable SECURITY DEFINER functions — service_role only.

ALTER FUNCTION process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID)
  SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID) FROM authenticated;

GRANT  EXECUTE ON FUNCTION process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID) TO service_role;

ALTER FUNCTION get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM authenticated;

GRANT  EXECUTE ON FUNCTION get_labor_cost_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;

ALTER FUNCTION get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM authenticated;

GRANT  EXECUTE ON FUNCTION get_menu_engineering_matrix(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;

ALTER FUNCTION increment_coupon_usage(UUID)           SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION increment_coupon_usage(UUID) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION increment_coupon_usage(UUID) FROM authenticated;

GRANT  EXECUTE ON FUNCTION increment_coupon_usage(UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP B  SECURITY DEFINER with search_path, but missing REVOKE  (medium risk)
-- ─────────────────────────────────────────────────────────────────────────────

-- pg_cron job functions — invoked by the scheduler under the postgres superuser.
-- REVOKE from PUBLIC + authenticated prevents direct REST/SQL calls by clients.
-- The cron execution itself is unaffected (postgres role bypasses object grants).

REVOKE EXECUTE ON FUNCTION cleanup_driver_locations() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION cleanup_driver_locations() FROM authenticated;

GRANT  EXECUTE ON FUNCTION cleanup_driver_locations() TO service_role;

REVOKE EXECUTE ON FUNCTION refresh_analytics_views()  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION refresh_analytics_views()  FROM authenticated;

GRANT  EXECUTE ON FUNCTION refresh_analytics_views()  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP C  Plain functions (no SECURITY DEFINER) with mutable search_path
-- No privilege escalation risk; SET search_path silences the advisor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION set_updated_at()                          SET search_path = public, pg_catalog;

ALTER FUNCTION fn_set_updated_at()                       SET search_path = public, pg_catalog;

ALTER FUNCTION sync_order_status_on_payment()            SET search_path = public, pg_catalog;

ALTER FUNCTION update_restaurant_profile_updated_at()    SET search_path = public, pg_catalog;

ALTER FUNCTION restaurant_tables_set_updated_at()        SET search_path = public, pg_catalog;

ALTER FUNCTION promotions_set_updated_at()               SET search_path = public, pg_catalog;

ALTER FUNCTION reservations_set_updated_at()             SET search_path = public, pg_catalog;

ALTER FUNCTION on_order_item_created()                   SET search_path = public, pg_catalog;

ALTER FUNCTION cancel_expired_pending_payment_orders()   SET search_path = public, pg_catalog;

ALTER FUNCTION normalize_bahrain_phone(TEXT)             SET search_path = public, pg_catalog;

ALTER FUNCTION calculate_loyalty_tier(INT, NUMERIC)      SET search_path = public, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP D  Materialized views in public schema (Materialized View in API)
-- All 6 are internal analytics queried exclusively via service_role clients.
-- REVOKE from anon + authenticated; service_role bypasses object privileges.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE SELECT ON mv_variance_report        FROM anon, authenticated;

REVOKE SELECT ON customer_lifetime_value   FROM anon, authenticated;

REVOKE SELECT ON daily_sales               FROM anon, authenticated;

REVOKE SELECT ON top_menu_items            FROM anon, authenticated;

REVOKE SELECT ON hourly_order_distribution FROM anon, authenticated;

REVOKE SELECT ON menu_item_performance     FROM anon, authenticated;
