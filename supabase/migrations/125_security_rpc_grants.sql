-- 125_security_rpc_grants.sql
-- Revoke anonymous (anon role / PUBLIC) EXECUTE on 3 sensitive RPCs.
--
-- Background:
--   - Migration 064 originally REVOKE'd PUBLIC and GRANT'd authenticated on
--     rpc_get_driver_location.
--   - Migration 094 did the same for update_order_item_station_status.
--   - Both functions were later redefined with DIFFERENT signatures
--     (kds_station / kds_item_status enum args -> text args, in migrations
--     105/107/108). PostgreSQL treats signature-changed CREATE as a new
--     function and grants the default PUBLIC=EXECUTE. The revoke was lost.
--   - rpc_update_staff was introduced by an out-of-band Dashboard change
--     and never had a migration in this repo. Live remote ACL had PUBLIC=X.
--
-- Verified remote drift at session start (2026-05-13):
--   anon=X on all 3 functions. This migration closes that.

-- ── 1. Recapture rpc_update_staff in version control (drift fix) ──────────────
-- Same body as live remote; CREATE OR REPLACE is a no-op on prod and the
-- definitive source on a fresh DB. SECURITY DEFINER preserved; search_path
-- pinned (consistent with 064/094/123/124 patterns).
CREATE OR REPLACE FUNCTION public.rpc_update_staff(
  p_id        UUID,
  p_name      TEXT,
  p_role      staff_role,
  p_branch_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE staff_basic
  SET    name      = p_name,
         role      = p_role,
         branch_id = p_branch_id
  WHERE  id = p_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'staff_not_found: %', p_id;
  END IF;
END;
$$;

-- ── 2. Revoke from anon (and PUBLIC for belt-and-suspenders) ──────────────────
-- Supabase grants EXECUTE explicitly to the `anon` role on every new function,
-- so `REVOKE FROM PUBLIC` alone is a no-op — we have to name the role.
REVOKE EXECUTE ON FUNCTION public.rpc_get_driver_location(UUID)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_update_staff(UUID, TEXT, staff_role, TEXT)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_order_item_station_status(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;

REVOKE EXECUTE ON FUNCTION public.rpc_get_driver_location(UUID)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_update_staff(UUID, TEXT, staff_role, TEXT)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_item_station_status(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_get_driver_location(UUID)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_staff(UUID, TEXT, staff_role, TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_item_station_status(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- service_role keeps EXECUTE (default Supabase grant). No explicit grant
-- needed; service_role also bypasses RLS so it would work either way.

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- GRANT EXECUTE ON FUNCTION public.rpc_get_driver_location(UUID)            TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.rpc_update_staff(UUID, TEXT, staff_role, TEXT) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.update_order_item_station_status(UUID, UUID, TEXT, TEXT, TEXT) TO PUBLIC;
-- (Not recommended — re-opens anon access.)
