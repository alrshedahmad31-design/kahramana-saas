-- 119_security_invoker_views.sql
-- BL-003: flip 4 views from SECURITY DEFINER (default) to security_invoker = on.
--
-- Background
-- ----------
-- Postgres views default to running queries with the owner's privileges
-- (SECURITY DEFINER semantics for the underlying-table access check). Under
-- Supabase's security audit policy, any view without an explicit
-- `security_invoker = on` is flagged as DEFINER, because it can bypass RLS
-- on its base tables when read by an authenticated/anon role.
--
-- With `security_invoker = on`, queries against the view run with the
-- *caller's* role, and RLS on the underlying tables is enforced normally.
--
-- Runtime impact
-- --------------
-- All four views are currently read exclusively via the service-role client
-- in application code (src/lib/analytics/queries.ts, src/lib/reports/validator.ts).
-- The service role bypasses RLS regardless of invoker/definer setting, so
-- this change is transparent to the dashboard's analytics and reports paths.
-- `v_kds_station_items` is referenced only in generated types; no app code
-- currently reads it.
--
-- Underlying tables (orders, order_items, order_item_station_status, coupons,
-- customer_lifetime_value) already carry the RLS policies needed for any
-- future caller-scoped access.

ALTER VIEW public.order_source_summary    SET (security_invoker = on);
ALTER VIEW public.customer_segments_view  SET (security_invoker = on);
ALTER VIEW public.coupon_analytics_view   SET (security_invoker = on);
ALTER VIEW public.v_kds_station_items     SET (security_invoker = on);

-- Verification (informational; safe to re-run):
--   SELECT v.viewname, o.option_value
--   FROM pg_views v
--   JOIN pg_class c ON c.relname = v.viewname
--   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = v.schemaname
--   JOIN pg_options_to_table(c.reloptions) o ON o.option_name = 'security_invoker'
--   WHERE v.schemaname = 'public'
--     AND v.viewname IN (
--       'order_source_summary',
--       'customer_segments_view',
--       'coupon_analytics_view',
--       'v_kds_station_items'
--     );
--   -- Expect all four rows with option_value = 'on'.
