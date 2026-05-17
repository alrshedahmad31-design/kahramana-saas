-- ============================================================
-- Kahramana Baghdad
-- Migration: 171_rpc_promotions.sql
--
-- Closes the direct INSERT / UPDATE / DELETE on promotions in
-- src/app/[locale]/dashboard/promotions/actions.ts (P1-F in the
-- second-audit punch list). Three SECURITY DEFINER RPCs bundle each
-- mutation with an audit_logs INSERT in one transaction so audit
-- failure rolls back the write, and the branch-scope clamp lives at
-- the DB level instead of being duplicated across JS and RLS.
--
-- Roles allowed: owner, general_manager, branch_manager, marketing
-- (mirrors SECTION_ROLES.promotions). Non-globals can only mutate
-- promotions scoped to their own branch and can never create / edit
-- a global (branch_id NULL) promotion.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_create_promotion(jsonb);
--   DROP FUNCTION IF EXISTS rpc_update_promotion(uuid, jsonb);
--   DROP FUNCTION IF EXISTS rpc_delete_promotion(uuid);
-- ============================================================

CREATE OR REPLACE FUNCTION _promotion_role_allowed(p_role staff_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_role IN (
    'owner', 'general_manager', 'branch_manager', 'marketing'
  )
$$;

-- ── rpc_create_promotion ───────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_create_promotion(p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_branch     TEXT;
  v_target     TEXT;
  v_id         UUID;
  v_type       TEXT;
  v_name_ar    TEXT;
  v_name_en    TEXT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT _promotion_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  v_target  := NULLIF(p_payload->>'branch_id', '');
  v_type    := p_payload->>'type';
  v_name_ar := NULLIF(btrim(p_payload->>'name_ar'), '');
  v_name_en := NULLIF(btrim(p_payload->>'name_en'), '');

  IF v_type NOT IN ('bogo','bundle','time_discount','item_discount','spend_discount')
     OR v_name_ar IS NULL OR v_name_en IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  -- Non-globals: must pick a branch (no global promos) and must pick OWN.
  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF v_target IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'global_forbidden');
    END IF;
    IF v_branch IS NULL OR v_target <> v_branch THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  INSERT INTO promotions (
    branch_id, name_ar, name_en, type, config,
    starts_at, ends_at, is_active, max_uses, created_by
  ) VALUES (
    v_target,
    v_name_ar,
    v_name_en,
    v_type::promotion_type,
    COALESCE(p_payload->'config', '{}'::jsonb),
    NULLIF(p_payload->>'starts_at', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'ends_at', '')::TIMESTAMPTZ,
    COALESCE((p_payload->>'is_active')::BOOLEAN, true),
    NULLIF(p_payload->>'max_uses', '')::INT,
    v_caller_uid
  )
  RETURNING id INTO v_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'promotions', 'INSERT',
    COALESCE(v_caller_uid, NULL),
    v_id::TEXT,
    jsonb_build_object('type', v_type, 'name_en', v_name_en, 'branch_id', v_target),
    v_target,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_create_promotion(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_create_promotion(jsonb) TO authenticated, service_role;

-- ── rpc_update_promotion ───────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_update_promotion(p_id uuid, p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_branch     TEXT;
  v_existing   promotions%ROWTYPE;
  v_target     TEXT;
  v_type       TEXT;
  v_name_ar    TEXT;
  v_name_en    TEXT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT _promotion_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM promotions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Scope: non-globals cannot touch global rows OR rows of another branch
  -- (no escalation via the update path).
  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF v_existing.branch_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'global_forbidden');
    END IF;
    IF v_branch IS NULL OR v_existing.branch_id <> v_branch THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  v_target  := NULLIF(p_payload->>'branch_id', '');
  v_type    := p_payload->>'type';
  v_name_ar := NULLIF(btrim(p_payload->>'name_ar'), '');
  v_name_en := NULLIF(btrim(p_payload->>'name_en'), '');

  IF v_type NOT IN ('bogo','bundle','time_discount','item_discount','spend_discount')
     OR v_name_ar IS NULL OR v_name_en IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  -- Non-globals can't move a row to another branch or to global.
  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF v_target IS NULL OR v_target <> v_branch THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  UPDATE promotions SET
    branch_id = v_target,
    name_ar   = v_name_ar,
    name_en   = v_name_en,
    type      = v_type::promotion_type,
    config    = COALESCE(p_payload->'config', config),
    starts_at = NULLIF(p_payload->>'starts_at', '')::TIMESTAMPTZ,
    ends_at   = NULLIF(p_payload->>'ends_at', '')::TIMESTAMPTZ,
    is_active = COALESCE((p_payload->>'is_active')::BOOLEAN, is_active),
    max_uses  = NULLIF(p_payload->>'max_uses', '')::INT
  WHERE id = p_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'promotions', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_id::TEXT,
    jsonb_build_object(
      'type',      v_type,
      'name_en',   v_name_en,
      'is_active', COALESCE((p_payload->>'is_active')::BOOLEAN, v_existing.is_active),
      'branch_id', v_target
    ),
    v_target,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_promotion(uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_update_promotion(uuid, jsonb) TO authenticated, service_role;

-- ── rpc_delete_promotion ───────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_delete_promotion(p_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_branch     TEXT;
  v_existing   promotions%ROWTYPE;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT _promotion_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM promotions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF v_existing.branch_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'global_forbidden');
    END IF;
    IF v_branch IS NULL OR v_existing.branch_id <> v_branch THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  DELETE FROM promotions WHERE id = p_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'promotions', 'DELETE',
    COALESCE(v_caller_uid, NULL),
    p_id::TEXT,
    jsonb_build_object('name_en', v_existing.name_en, 'type', v_existing.type),
    v_existing.branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_delete_promotion(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_delete_promotion(uuid) TO authenticated, service_role;
