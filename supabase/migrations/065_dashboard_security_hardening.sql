-- ============================================================
-- 065_dashboard_security_hardening.sql
-- Closes 7 critical dashboard security findings (D-C1 .. D-C7).
-- Only DB-level changes for D-C2 are persisted here; the rest of the
-- fixes are application-level (TypeScript) and applied separately.
--
-- D-C2 — coupon_usages INSERT is exposed to any authenticated user via
-- "WITH CHECK (auth.uid() IS NOT NULL)". This permits forging usages
-- for any customer/order/coupon — DoS on per_customer_limit + analytics
-- pollution. Lock it down so only the service role (used by the
-- checkout server action / rpc_create_order) can insert. Customer
-- profiles still need SELECT on their own usages — that policy stays.
-- ============================================================

-- ── D-C2: Remove permissive INSERT, revoke from PostgREST roles ──────────────

DROP POLICY IF EXISTS "authenticated_insert_coupon_usage" ON coupon_usages;
DROP POLICY IF EXISTS "insert_coupon_usage"               ON coupon_usages;

REVOKE INSERT ON coupon_usages FROM anon;
REVOKE INSERT ON coupon_usages FROM authenticated;

-- (UPDATE / DELETE were never exposed; nothing to revoke.)
-- service_role retains full access via Postgres super-grant — it bypasses RLS
-- entirely and is what the checkout server action uses to write usages.

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- GRANT INSERT ON coupon_usages TO authenticated;
-- CREATE POLICY "authenticated_insert_coupon_usage"
--   ON coupon_usages FOR INSERT
--   WITH CHECK (auth.uid() IS NOT NULL);
