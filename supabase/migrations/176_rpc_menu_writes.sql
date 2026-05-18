-- ============================================================
-- Kahramana Baghdad
-- Migration: 176_rpc_menu_writes.sql
--
-- Closes the 9 direct writes in dashboard/menu/actions.ts. Same
-- pattern as 170 (coupons): SECURITY DEFINER + jsonb result envelope
-- { ok: true } | { ok: false, code: '...' }. Audit row INSERTed in
-- the same transaction so audit failure rolls back the parent mutation.
--
-- Role gates:
--   Toggle availability   -> owner / GM / branch_manager / inventory_manager
--                           (matches RLS policy "staff_update_menu_availability"
--                           from migration 070 -- toggle is the broad surface)
--   Everything else       -> owner / general_manager only
--                           (matches DESTRUCTIVE_ROLES in actions.ts)
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_set_menu_item_available(TEXT, BOOLEAN);
--   DROP FUNCTION IF EXISTS rpc_upsert_menu_items(jsonb);
--   DROP FUNCTION IF EXISTS rpc_create_menu_item(jsonb);
--   DROP FUNCTION IF EXISTS rpc_update_menu_item(TEXT, jsonb);
--   DROP FUNCTION IF EXISTS rpc_delete_menu_item(TEXT);
--   DROP FUNCTION IF EXISTS rpc_upsert_menu_option_group(jsonb);
--   DROP FUNCTION IF EXISTS rpc_delete_menu_option_group(UUID);
--   DROP FUNCTION IF EXISTS rpc_upsert_menu_option(jsonb);
--   DROP FUNCTION IF EXISTS rpc_delete_menu_option(UUID);
--   DROP FUNCTION IF EXISTS _menu_destructive_allowed(staff_role);
--   DROP FUNCTION IF EXISTS _menu_toggle_allowed(staff_role);
-- ============================================================

CREATE OR REPLACE FUNCTION _menu_destructive_allowed(p_role staff_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_role IN ('owner', 'general_manager')
$$;

CREATE OR REPLACE FUNCTION _menu_toggle_allowed(p_role staff_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_role IN ('owner', 'general_manager', 'branch_manager', 'inventory_manager')
$$;

-- -- rpc_set_menu_item_available ---------------------------------

CREATE OR REPLACE FUNCTION rpc_set_menu_item_available(
  p_slug      TEXT,
  p_available BOOLEAN
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
    IF NOT _menu_toggle_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  UPDATE menu_items
     SET is_available = p_available,
         updated_at   = NOW()
   WHERE id = p_slug;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_items', 'UPDATE', v_uid, p_slug,
          jsonb_build_object('is_available', p_available),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_set_menu_item_available(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_set_menu_item_available(TEXT, BOOLEAN) TO authenticated, service_role;

-- -- rpc_upsert_menu_items (bulk sync from menu.json) ------------

CREATE OR REPLACE FUNCTION rpc_upsert_menu_items(p_items jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
  v_count  INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  INSERT INTO menu_items (
    id, name_ar, name_en, description_ar, description_en,
    price_bhd, category, image_url, station, updated_at
  )
  SELECT
    e->>'id',
    e->>'name_ar',
    e->>'name_en',
    NULLIF(e->>'description_ar', ''),
    NULLIF(e->>'description_en', ''),
    COALESCE((e->>'price_bhd')::NUMERIC, 0),
    e->>'category',
    NULLIF(e->>'image_url', ''),
    COALESCE(NULLIF(e->>'station', '')::kds_station, 'unassigned'),
    NOW()
  FROM jsonb_array_elements(p_items) AS e
  ON CONFLICT (id) DO UPDATE SET
    name_ar        = EXCLUDED.name_ar,
    name_en        = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en,
    price_bhd      = EXCLUDED.price_bhd,
    category       = EXCLUDED.category,
    image_url      = EXCLUDED.image_url,
    station        = EXCLUDED.station,
    updated_at     = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_items', 'UPDATE', v_uid, 'bulk_sync',
          jsonb_build_object('action', 'menu_sync_executed', 'count', v_count),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_upsert_menu_items(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_upsert_menu_items(jsonb) TO authenticated, service_role;

-- -- rpc_create_menu_item ----------------------------------------

CREATE OR REPLACE FUNCTION rpc_create_menu_item(p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
  v_slug   TEXT;
  v_exists BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  v_slug := NULLIF(btrim(p_payload->>'id'), '');
  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  SELECT EXISTS (SELECT 1 FROM menu_items WHERE id = v_slug) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('ok', false, 'code', 'slug_taken');
  END IF;

  INSERT INTO menu_items (
    id, name_ar, name_en, description_ar, description_en,
    price_bhd, category, image_url, station, is_available, updated_at
  ) VALUES (
    v_slug,
    p_payload->>'name_ar',
    p_payload->>'name_en',
    NULLIF(p_payload->>'description_ar', ''),
    NULLIF(p_payload->>'description_en', ''),
    COALESCE((p_payload->>'price_bhd')::NUMERIC, 0),
    p_payload->>'category',
    NULLIF(p_payload->>'image_url', ''),
    COALESCE(NULLIF(p_payload->>'station', '')::kds_station, 'unassigned'),
    COALESCE((p_payload->>'is_available')::BOOLEAN, true),
    NOW()
  );

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_items', 'INSERT', v_uid, v_slug,
          jsonb_build_object('action', 'menu_item_created') || p_payload,
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true, 'id', v_slug);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_create_menu_item(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_create_menu_item(jsonb) TO authenticated, service_role;

-- -- rpc_update_menu_item ----------------------------------------

CREATE OR REPLACE FUNCTION rpc_update_menu_item(p_slug TEXT, p_payload jsonb)
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
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  UPDATE menu_items SET
    name_ar        = COALESCE(p_payload->>'name_ar', name_ar),
    name_en        = COALESCE(p_payload->>'name_en', name_en),
    description_ar = CASE WHEN p_payload ? 'description_ar'
                          THEN NULLIF(p_payload->>'description_ar', '') ELSE description_ar END,
    description_en = CASE WHEN p_payload ? 'description_en'
                          THEN NULLIF(p_payload->>'description_en', '') ELSE description_en END,
    price_bhd      = COALESCE((p_payload->>'price_bhd')::NUMERIC, price_bhd),
    category       = COALESCE(p_payload->>'category', category),
    image_url      = CASE WHEN p_payload ? 'image_url'
                          THEN NULLIF(p_payload->>'image_url', '') ELSE image_url END,
    station        = COALESCE(NULLIF(p_payload->>'station', '')::kds_station, station),
    updated_at     = NOW()
   WHERE id = p_slug;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_items', 'UPDATE', v_uid, p_slug,
          jsonb_build_object('action', 'menu_item_updated') || p_payload,
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_menu_item(TEXT, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_update_menu_item(TEXT, jsonb) TO authenticated, service_role;

-- -- rpc_delete_menu_item ----------------------------------------

CREATE OR REPLACE FUNCTION rpc_delete_menu_item(p_slug TEXT)
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
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  DELETE FROM menu_items WHERE id = p_slug;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_items', 'DELETE', v_uid, p_slug,
          jsonb_build_object('action', 'menu_item_deleted', 'slug', p_slug),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_delete_menu_item(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_delete_menu_item(TEXT) TO authenticated, service_role;

-- -- rpc_upsert_menu_option_group -------------------------------

CREATE OR REPLACE FUNCTION rpc_upsert_menu_option_group(p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
  v_id     UUID;
  v_rows   INT;
  v_action TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  v_id := NULLIF(p_payload->>'id', '')::UUID;

  IF v_id IS NULL THEN
    INSERT INTO menu_option_groups (
      menu_item_slug, name_ar, name_en, required, multi_select, sort_order
    ) VALUES (
      p_payload->>'menu_item_slug',
      p_payload->>'name_ar',
      p_payload->>'name_en',
      COALESCE((p_payload->>'required')::BOOLEAN, false),
      COALESCE((p_payload->>'multi_select')::BOOLEAN, false),
      COALESCE((p_payload->>'sort_order')::INT, 0)
    )
    RETURNING id INTO v_id;
    v_action := 'INSERT';
  ELSE
    UPDATE menu_option_groups SET
      menu_item_slug = COALESCE(p_payload->>'menu_item_slug', menu_item_slug),
      name_ar        = COALESCE(p_payload->>'name_ar', name_ar),
      name_en        = COALESCE(p_payload->>'name_en', name_en),
      required       = COALESCE((p_payload->>'required')::BOOLEAN, required),
      multi_select   = COALESCE((p_payload->>'multi_select')::BOOLEAN, multi_select),
      sort_order     = COALESCE((p_payload->>'sort_order')::INT, sort_order),
      updated_at     = NOW()
     WHERE id = v_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    v_action := 'UPDATE';
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_option_groups', v_action, v_uid, v_id::TEXT,
          jsonb_build_object('action', 'option_group_upsert') || p_payload,
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_upsert_menu_option_group(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_upsert_menu_option_group(jsonb) TO authenticated, service_role;

-- -- rpc_delete_menu_option_group -------------------------------

CREATE OR REPLACE FUNCTION rpc_delete_menu_option_group(p_id UUID)
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
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  DELETE FROM menu_option_groups WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_option_groups', 'DELETE', v_uid, p_id::TEXT,
          jsonb_build_object('action', 'option_group_deleted'),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_delete_menu_option_group(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_delete_menu_option_group(UUID) TO authenticated, service_role;

-- -- rpc_upsert_menu_option -------------------------------------

CREATE OR REPLACE FUNCTION rpc_upsert_menu_option(p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   staff_role;
  v_branch TEXT;
  v_id     UUID;
  v_rows   INT;
  v_action TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  v_id := NULLIF(p_payload->>'id', '')::UUID;

  IF v_id IS NULL THEN
    INSERT INTO menu_options (
      group_id, name_ar, name_en, price_modifier, is_available, sort_order
    ) VALUES (
      (p_payload->>'group_id')::UUID,
      p_payload->>'name_ar',
      p_payload->>'name_en',
      COALESCE((p_payload->>'price_modifier')::NUMERIC, 0),
      COALESCE((p_payload->>'is_available')::BOOLEAN, true),
      COALESCE((p_payload->>'sort_order')::INT, 0)
    )
    RETURNING id INTO v_id;
    v_action := 'INSERT';
  ELSE
    UPDATE menu_options SET
      group_id       = COALESCE((p_payload->>'group_id')::UUID, group_id),
      name_ar        = COALESCE(p_payload->>'name_ar', name_ar),
      name_en        = COALESCE(p_payload->>'name_en', name_en),
      price_modifier = COALESCE((p_payload->>'price_modifier')::NUMERIC, price_modifier),
      is_available   = COALESCE((p_payload->>'is_available')::BOOLEAN, is_available),
      sort_order     = COALESCE((p_payload->>'sort_order')::INT, sort_order)
     WHERE id = v_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    v_action := 'UPDATE';
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_options', v_action, v_uid, v_id::TEXT,
          jsonb_build_object('action', 'option_upsert') || p_payload,
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_upsert_menu_option(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_upsert_menu_option(jsonb) TO authenticated, service_role;

-- -- rpc_delete_menu_option -------------------------------------

CREATE OR REPLACE FUNCTION rpc_delete_menu_option(p_id UUID)
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
    IF NOT _menu_destructive_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  DELETE FROM menu_options WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('menu_options', 'DELETE', v_uid, p_id::TEXT,
          jsonb_build_object('action', 'option_deleted'),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_delete_menu_option(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_delete_menu_option(UUID) TO authenticated, service_role;
