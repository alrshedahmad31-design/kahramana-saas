-- 175_rpc_replace_recipes.sql
-- Atomic replacement of a menu item's recipe rows.
--
-- Backstory: dashboard/inventory/recipes/[slug]/actions.ts ran a DELETE
-- of all recipe rows for a slug followed by a separate INSERT of the
-- new set. The two statements aren't a transaction, so an insert
-- failure leaves the recipe empty. Fold both into one SECURITY DEFINER
-- body so they commit together.
--
-- Caller is service-role from a server action that has already passed
-- requireDashboardRole(['owner','general_manager']). Function still
-- gates explicitly (defense in depth) and rejects non-managerial
-- roles for users (auth.role() <> 'service_role' path).
--
-- p_rows shape (JSONB array): each element is
--   { ingredient_id: uuid|null, prep_item_id: uuid|null,
--     quantity: numeric, yield_factor: numeric|null,
--     variant_key: text|null, is_optional: boolean }
-- The same shape the JS already builds.
--
-- p_updated_by: the operating staff user's UUID. The server action has
-- already permission-checked the caller; we trust the JS to pass the
-- right value so recipes.updated_by keeps human attribution rather
-- than collapsing to the service-role principal.
--
-- Returns: number of rows inserted.
-- SQLSTATE class KH (see migration 174 for class rationale).
--   KH001 = AUTH_REQUIRED
--   KH002 = FORBIDDEN_ROLE
--   KH015 = INVALID_SLUG
--   KH016 = INVALID_ROWS
--
-- SAFE TO RE-RUN.

CREATE OR REPLACE FUNCTION rpc_replace_recipes(
  p_slug       TEXT,
  p_rows       JSONB,
  p_updated_by UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        TEXT;
  v_caller_uid  UUID;
  v_inserted    INT;
BEGIN
  v_caller_uid := auth.uid();
  IF auth.role() <> 'service_role' THEN
    IF v_caller_uid IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'KH001';
    END IF;
    v_role := auth_user_role();
    IF v_role NOT IN ('owner', 'general_manager') THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE' USING ERRCODE = 'KH002';
    END IF;
  END IF;

  IF p_slug IS NULL OR char_length(btrim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'INVALID_SLUG' USING ERRCODE = 'KH015';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ROWS' USING ERRCODE = 'KH016';
  END IF;

  DELETE FROM recipes WHERE menu_item_slug = p_slug;

  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO recipes (
      menu_item_slug, ingredient_id, prep_item_id, quantity,
      yield_factor, variant_key, is_optional, updated_by, updated_at
    )
    SELECT
      p_slug,
      NULLIF(r->>'ingredient_id', '')::UUID,
      NULLIF(r->>'prep_item_id',  '')::UUID,
      (r->>'quantity')::NUMERIC,
      NULLIF(r->>'yield_factor', '')::NUMERIC,
      NULLIF(r->>'variant_key',  ''),
      COALESCE((r->>'is_optional')::BOOLEAN, FALSE),
      p_updated_by,
      NOW()
    FROM jsonb_array_elements(p_rows) AS r;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  ELSE
    v_inserted := 0;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_replace_recipes(TEXT, JSONB, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION rpc_replace_recipes(TEXT, JSONB, UUID) TO authenticated;
