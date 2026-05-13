-- 127_grant_audit.sql
-- Audit of migrations 114-126: every CREATE TABLE must have an explicit
-- GRANT to service_role. One gap found:
--
--   114_reservations.sql granted SELECT, INSERT, UPDATE, DELETE on
--   reservations to authenticated only. service_role was omitted.
--   BYPASSRLS alone is not sufficient — PostgREST still enforces
--   object-level privileges, so any createServiceClient() caller
--   hitting this table receives "permission denied for table reservations".

GRANT SELECT, INSERT, UPDATE, DELETE ON reservations TO service_role;
