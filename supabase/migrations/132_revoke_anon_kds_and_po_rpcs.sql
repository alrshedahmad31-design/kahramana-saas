-- 132_revoke_anon_kds_and_po_rpcs.sql
-- Closes the anon/PUBLIC EXECUTE gaps left over after migrations 125/131.
--
-- Findings (verified live before this migration):
--   - bump_station_order(uuid, text):                      PUBLIC + anon + authenticated EXECUTE
--   - recall_station_order(uuid, kds_station):             anon + authenticated EXECUTE (no PUBLIC)
--   - recall_station_order(uuid, text):                    PUBLIC + anon + authenticated EXECUTE
--   - rpc_create_purchase_order(uuid,text,uuid,jsonb,date,text):
--                                                          anon + authenticated EXECUTE (migration 124 omitted REVOKE)
--
-- KDS RPCs (bump/recall) keep `authenticated` because cashier/kitchen
-- staff sessions use the authenticated role. PO creation drops
-- `authenticated` because the only call site is a server action using
-- the service_role client (assertInventoryWriteAccess enforces scope
-- inside that server action).
--
-- Note: per `feedback_supabase_revoke_anon`, REVOKE FROM PUBLIC is a
-- no-op against Supabase's explicit anon grants. Both REVOKEs are
-- required for the role-then-PUBLIC pair.

-- bump_station_order — kitchen UI (authenticated)
REVOKE EXECUTE ON FUNCTION bump_station_order(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION bump_station_order(uuid, text) FROM anon;

-- recall_station_order — both overloads
REVOKE EXECUTE ON FUNCTION recall_station_order(uuid, kds_station) FROM anon;
REVOKE EXECUTE ON FUNCTION recall_station_order(uuid, text)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recall_station_order(uuid, text)        FROM anon;

-- rpc_create_purchase_order — server-action / service-role only
REVOKE EXECUTE ON FUNCTION rpc_create_purchase_order(
  uuid, text, uuid, jsonb, date, text
) FROM anon;
REVOKE EXECUTE ON FUNCTION rpc_create_purchase_order(
  uuid, text, uuid, jsonb, date, text
) FROM authenticated;
