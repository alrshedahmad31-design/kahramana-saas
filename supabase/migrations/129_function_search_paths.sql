-- 129_function_search_paths.sql
-- Pin search_path on the 4 SECURITY DEFINER overloads that currently have
-- proconfig = NULL on remote prod. Closes the "Function Search Path Mutable"
-- Supabase advisor warning from the 2026-05-13 pre-launch audit.
--
-- Why this matters: a SECURITY DEFINER function with a mutable search_path
-- can be hijacked if an attacker controls a schema earlier in search_path
-- (e.g. pg_temp). They can shadow a function or table the SECDEF body uses
-- and run code as the function owner (postgres in our case).
--
-- The matching overloads that ALREADY had search_path
-- (recall_station_order(kds_station) + rpc_receive_purchase_order 3-arg)
-- are not touched here.
--
-- Migration numbers 126/127/128 are taken on remote by sibling-agent
-- security-hardening work that hasn't been pulled into this repo; this
-- migration uses 129 to avoid collision. Applied via `supabase db query`
-- directly until the 126-128 drift is reconciled.

ALTER FUNCTION public.bump_station_order(uuid, text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.recall_station_order(uuid, text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.rpc_receive_purchase_order(uuid, jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_order_item_station_status(uuid, uuid, text, text, text)
  SET search_path = public, pg_catalog;

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- ALTER FUNCTION public.bump_station_order(uuid, text)               RESET search_path;
-- ALTER FUNCTION public.recall_station_order(uuid, text)             RESET search_path;
-- ALTER FUNCTION public.rpc_receive_purchase_order(uuid, jsonb)      RESET search_path;
-- ALTER FUNCTION public.update_order_item_station_status(uuid, uuid, text, text, text) RESET search_path;
-- (Not recommended — re-opens the mutable-search-path attack surface.)
