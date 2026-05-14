-- ============================================================
-- Kahramana Baghdad
-- Migration: 137_harden_kds_text_overloads.sql
--
-- KAH-2026-05-04 close-out / VULN-RBAC-05.
--
-- Live JS callers (kds/actions.ts) invoke bump_station_order and
-- recall_station_order via supabase-js, which serializes the station
-- parameter as JSON text — PostgreSQL therefore resolves to the
-- (uuid, text) overload, NOT the kds_station sibling.
--
-- The text overloads carried only a branch-mismatch check (with a
-- NULL-caller-branch bypass). They lacked:
--   • staff_role allowlist (kitchen / branch_manager / general_manager / owner)
--   • 60-second recall window enforcement
--   • bumped_at validity check
--
-- The kds_station overload of recall_station_order had all three but was
-- unreachable from the JS surface. Net effect: any authenticated session
-- (driver / marketing / support / cashier / waiter) could call the RPC
-- directly and revert completed orders at any age — bypassing the JS
-- wrapper that does enforce these guards.
--
-- Fix:
--   1. Rewrite bump_station_order(uuid, text) with role + branch checks
--      mirroring the kds_station body (no recall window — bump is one-way).
--   2. Rewrite recall_station_order(uuid, text) with full role + branch +
--      60s window + bumped_at checks (mirror of the kds_station body).
--   3. DROP recall_station_order(uuid, kds_station) — now redundant; the
--      text overload carries identical semantics and is the sole reachable
--      path from supabase-js.
--
-- ACL: CREATE OR REPLACE preserves the EXECUTE grants set by migration 132
-- (anon REVOKE'd, authenticated + service_role retained). The DROPped
-- kds_station overload's grants vanish with the function.
--
-- ROLLBACK:
--   The prior text-overload bodies are reproducible from git blame on
--   pre-migration-137 state; recreate via CREATE OR REPLACE. Not
--   recommended — restoring re-opens the privilege-escalation path.
-- ============================================================

CREATE OR REPLACE FUNCTION public.bump_station_order(
  p_order_id uuid,
  p_station  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
  v_pending_stations INT;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('kitchen', 'branch_manager', 'general_manager', 'owner') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders
  WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  UPDATE order_item_station_status
  SET    status    = 'completed',
         bumped_at = NOW()
  WHERE  order_id = p_order_id
    AND  station::text = p_station
    AND  status <> 'completed';

  SELECT COUNT(*) INTO v_pending_stations
  FROM   order_item_station_status
  WHERE  order_id = p_order_id
    AND  status <> 'completed';

  IF v_pending_stations = 0 THEN
    UPDATE orders
    SET    ready_at = COALESCE(ready_at, NOW())
    WHERE  id = p_order_id;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.recall_station_order(
  p_order_id uuid,
  p_station  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
  v_bumped_at        TIMESTAMPTZ;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('kitchen', 'branch_manager', 'general_manager', 'owner') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders
  WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT MAX(bumped_at) INTO v_bumped_at
  FROM   order_item_station_status
  WHERE  order_id = p_order_id
    AND  station::text = p_station
    AND  status = 'completed';

  IF v_bumped_at IS NULL THEN
    RAISE EXCEPTION 'NOT_BUMPED' USING ERRCODE = 'P0002';
  END IF;

  IF v_bumped_at < (NOW() - INTERVAL '60 seconds') THEN
    RAISE EXCEPTION 'RECALL_WINDOW_EXPIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE order_item_station_status
  SET    status     = 'ready',
         bumped_at  = NULL,
         updated_at = NOW()
  WHERE  order_id = p_order_id
    AND  station::text = p_station
    AND  status = 'completed';
END;
$$;


DROP FUNCTION IF EXISTS public.recall_station_order(uuid, kds_station);
