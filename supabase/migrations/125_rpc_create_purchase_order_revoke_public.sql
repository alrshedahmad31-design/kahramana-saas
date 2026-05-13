-- Revoke public execute on rpc_create_purchase_order.
-- Migration 124 created the function and granted service_role; PostgreSQL grants EXECUTE to PUBLIC
-- by default on new functions, so this migration explicitly revokes that before re-granting.
REVOKE EXECUTE ON FUNCTION rpc_create_purchase_order(UUID, TEXT, UUID, JSONB, DATE, TEXT)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rpc_create_purchase_order(UUID, TEXT, UUID, JSONB, DATE, TEXT)
  TO service_role;
