-- ============================================================
-- Kahramana Baghdad
-- Migration: 151_grant_authenticated_analytics.sql
--
-- AUD-V3-012 close-out. Sessions 117 + 119 swapped 9/16 analytics
-- queries from createServiceClient() to createClient() (anon/auth
-- via RLS). Remaining 7 functions stayed on service-role because
-- the matviews + RPCs they hit had no `authenticated` grant.
--
-- Probe (session 120) confirmed:
--   matviews:
--     hourly_order_distribution  — authenticated: no SELECT
--     menu_item_performance      — authenticated: no SELECT
--     customer_lifetime_value    — authenticated: no SELECT
--   views:
--     customer_segments_view     — authenticated: SELECT ok, BUT
--                                  reloption security_invoker=on
--                                  → reads route through the matview
--                                  customer_lifetime_value (above)
--                                  and still fail for authenticated.
--   RPCs:
--     get_labor_cost_metrics     — authenticated: no EXECUTE
--     get_menu_engineering_matrix — authenticated: no EXECUTE
--     refresh_analytics_views    — authenticated: no EXECUTE (KEEP)
--
-- This migration grants:
--   - SELECT on the 3 matviews to authenticated
--   - EXECUTE on the 2 branch-scoped RPCs to authenticated
--
-- Branch scoping note: matviews are snapshots and have no RLS.
-- The RPCs accept p_branch_id and filter internally but default
-- NULL = all branches. Branch scope is enforced at the JS layer
-- in src/lib/analytics/queries.ts — same caller-trust pattern as
-- session 96 (matches the dashboard/page.tsx Forbidden guard for
-- non-global users without a branch_id).
--
-- refresh_analytics_views is NOT granted: it refreshes every
-- analytics matview (admin maintenance) and has no caller-side
-- branch scoping. Stays service-role only.
-- ============================================================

-- ── 1. Matview SELECT grants ────────────────────────────────────────────────

GRANT SELECT ON public.hourly_order_distribution TO authenticated;
GRANT SELECT ON public.menu_item_performance     TO authenticated;
GRANT SELECT ON public.customer_lifetime_value   TO authenticated;

-- ── 2. RPC EXECUTE grants ───────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_labor_cost_metrics(
  timestamptz, timestamptz, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_menu_engineering_matrix(
  timestamptz, timestamptz, text
) TO authenticated;

-- ── Rollback (manual, not run by db push) ───────────────────────────────────
--
-- REVOKE SELECT ON public.hourly_order_distribution FROM authenticated;
-- REVOKE SELECT ON public.menu_item_performance     FROM authenticated;
-- REVOKE SELECT ON public.customer_lifetime_value   FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.get_labor_cost_metrics(
--   timestamptz, timestamptz, text
-- ) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.get_menu_engineering_matrix(
--   timestamptz, timestamptz, text
-- ) FROM authenticated;
