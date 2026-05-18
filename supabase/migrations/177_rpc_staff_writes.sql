-- ============================================================
-- Kahramana Baghdad
-- Migration: 177_rpc_staff_writes.sql
--
-- Closes the 4 direct writes in dashboard/staff/actions.ts.
--
-- Auth + DB is a 2-step on the create paths because PG can't call
-- GoTrue (supabase.auth.admin from a DEFINER body is not exposed).
-- The new RPCs cover the post-auth DB half -- staff_basic INSERT +
-- audit row + (for createStaffFull) profile fields -- all inside one
-- transaction so a partial profile drop is impossible. Auth-side
-- rollback stays JS (authAdmin.deleteUser on DB failure).
--
-- rpc_update_staff (migration 126) is replaced in-place via CREATE
-- OR REPLACE so the existing function signature is reused. The new
-- body adds:
--   - SELECT FOR UPDATE pin against concurrent reassignment
--   - CAS check on (role, branch_id, is_active) returning
--     concurrent_change_retry instead of silently overwriting
--   - Audit row in the same transaction
-- Migration 126 file stays on disk as historical record. Return type
-- changes from VOID to JSONB; rpc_update_staff has no live JS caller
-- today (staff/actions.ts does a direct CAS UPDATE) so the signature
-- change is safe.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_after_auth_create_staff(UUID, TEXT, staff_role, TEXT);
--   DROP FUNCTION IF EXISTS rpc_after_auth_create_staff_full(UUID, jsonb);
--   DROP FUNCTION IF EXISTS rpc_set_staff_active(UUID, BOOLEAN, BOOLEAN);
--   -- rpc_update_staff: rerun migration 126 to restore the prior body.
-- ============================================================

-- -- rpc_after_auth_create_staff ---------------------------------
-- Covers staff/actions.ts createStaff() -- INSERT + audit, after the
-- caller has already done supabase.auth.admin.createUser. The auth
-- UUID is passed in as p_id.

CREATE OR REPLACE FUNCTION rpc_after_auth_create_staff(
  p_id        UUID,
  p_name      TEXT,
  p_role      staff_role,
  p_branch_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  END IF;

  INSERT INTO staff_basic (id, name, role, branch_id, is_active)
  VALUES (p_id, btrim(p_name), p_role, p_branch_id, true);

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('staff_basic', 'INSERT', v_uid, p_id::TEXT,
          jsonb_build_object('name', p_name, 'role', p_role, 'branch_id', p_branch_id),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_after_auth_create_staff(UUID, TEXT, staff_role, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION rpc_after_auth_create_staff(UUID, TEXT, staff_role, TEXT) TO service_role;

-- -- rpc_after_auth_create_staff_full ----------------------------
-- Covers staff/actions.ts createStaffFull() -- INSERT (including all
-- profile fields) + single audit row covering the full record. JS no
-- longer fires a second audit row for the profile fields; the
-- post-auth DB half commits or rolls back together.

CREATE OR REPLACE FUNCTION rpc_after_auth_create_staff_full(
  p_id      UUID,
  p_payload jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  END IF;

  INSERT INTO staff_basic (
    id, name, role, branch_id, is_active,
    phone, date_of_birth, id_number, address, profile_photo_url,
    hire_date, employment_type, hourly_rate,
    emergency_contact_name, emergency_contact_phone,
    clock_pin_hash, staff_notes
  ) VALUES (
    p_id,
    btrim(p_payload->>'name'),
    (p_payload->>'role')::staff_role,
    NULLIF(p_payload->>'branch_id', ''),
    true,
    NULLIF(p_payload->>'phone', ''),
    NULLIF(p_payload->>'date_of_birth', '')::DATE,
    NULLIF(p_payload->>'id_number', ''),
    NULLIF(p_payload->>'address', ''),
    NULLIF(p_payload->>'profile_photo_url', ''),
    NULLIF(p_payload->>'hire_date', '')::DATE,
    NULLIF(p_payload->>'employment_type', ''),
    NULLIF(p_payload->>'hourly_rate', '')::NUMERIC,
    NULLIF(p_payload->>'emergency_contact_name', ''),
    NULLIF(p_payload->>'emergency_contact_phone', ''),
    NULLIF(p_payload->>'clock_pin_hash', ''),
    NULLIF(p_payload->>'staff_notes', '')
  );

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('staff_basic', 'INSERT', v_uid, p_id::TEXT,
          jsonb_build_object(
            'name',      p_payload->>'name',
            'role',      p_payload->>'role',
            'branch_id', p_payload->>'branch_id',
            'profile_fields', (
              SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
              FROM jsonb_object_keys(p_payload) AS k
              WHERE k NOT IN ('name', 'role', 'branch_id')
            )
          ),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_after_auth_create_staff_full(UUID, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION rpc_after_auth_create_staff_full(UUID, jsonb) TO service_role;

-- -- rpc_update_staff (DROP + CREATE -- supersedes migration 126) -------
-- Adds SELECT FOR UPDATE pin + CAS + audit. Return type changes
-- VOID -> JSONB so DROP is required (CREATE OR REPLACE cannot alter
-- the return type). Argument types are unchanged. Verified no live JS
-- caller today before applying.

DROP FUNCTION IF EXISTS rpc_update_staff(UUID, TEXT, staff_role, TEXT);

CREATE FUNCTION rpc_update_staff(
  p_id        UUID,
  p_name      TEXT,
  p_role      staff_role,
  p_branch_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid           UUID;
  v_caller_role   staff_role;
  v_caller_branch TEXT;
  v_existing      staff_basic%ROWTYPE;
  v_rows          INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_caller_role   := auth_user_role();
    v_caller_branch := auth_user_branch_id();
    IF v_caller_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  END IF;

  SELECT * INTO v_existing FROM staff_basic WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  UPDATE staff_basic
     SET name      = btrim(p_name),
         role      = p_role,
         branch_id = p_branch_id
   WHERE id = p_id
     AND role      = v_existing.role
     AND is_active = v_existing.is_active
     AND COALESCE(branch_id, '') = COALESCE(v_existing.branch_id, '');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'concurrent_change_retry');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('staff_basic', 'UPDATE', v_uid, p_id::TEXT,
          jsonb_build_object('name', p_name, 'role', p_role, 'branch_id', p_branch_id),
          v_caller_branch, v_caller_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- DROP removed the 126 GRANT; re-grant identically (service_role only).
REVOKE EXECUTE ON FUNCTION rpc_update_staff(UUID, TEXT, staff_role, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION rpc_update_staff(UUID, TEXT, staff_role, TEXT) TO service_role;

-- -- rpc_set_staff_active ----------------------------------------
-- Covers staff/actions.ts toggleStaffActive() -- flip with CAS + audit.

CREATE OR REPLACE FUNCTION rpc_set_staff_active(
  p_id             UUID,
  p_activate       BOOLEAN,
  p_expected_state BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
  v_rows   INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  END IF;

  UPDATE staff_basic
     SET is_active = p_activate
   WHERE id = p_id
     AND is_active = p_expected_state;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    IF NOT EXISTS (SELECT 1 FROM staff_basic WHERE id = p_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'concurrent_change_retry');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('staff_basic', 'UPDATE', v_uid, p_id::TEXT,
          jsonb_build_object('is_active', p_activate),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_set_staff_active(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION rpc_set_staff_active(UUID, BOOLEAN, BOOLEAN) TO service_role;
