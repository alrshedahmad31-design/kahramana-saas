-- ============================================================
-- Kahramana Baghdad
-- Migration: 170_rpc_coupons.sql
--
-- Closes the remaining direct writes on coupons in
-- src/app/[locale]/dashboard/coupons/actions.ts (P1-E in the
-- second-audit punch list). The createCoupon / updateCoupon /
-- toggleCouponActive / toggleCouponPause server actions all wrote
-- directly to the coupons table, then INSERTed an audit row from JS
-- — so an audit failure left a silent coupon mutation behind, and
-- the branch-scope clamp lived only in JS (P0 fix).
--
-- Three SECURITY DEFINER RPCs replace the JS-level writes:
--
--   rpc_create_coupon(p_payload jsonb)
--     — Role gate: owner / general_manager / branch_manager / marketing
--     — DB-level branch-scope clamp: branch_manager + marketing get
--       applicable_branches OVERWRITTEN to [auth_user_branch_id()];
--       empty / null / mismatched arrays are REJECTED with code
--       'forbidden_branch_scope'. owner / GM keep cross-branch power.
--     — Business caps re-enforced server-side (max % 30, max BHD 5,
--       usage_limit > 0, percentage CAP required). owner / GM bypass.
--     — created_by stamped from auth.uid() (NOT the input).
--     — Audit row written in the same transaction.
--
--   rpc_update_coupon(p_id uuid, p_payload jsonb)
--     — Same role + branch + business-cap re-checks.
--     — Scope check against the EXISTING row's applicable_branches
--       / created_by so a non-admin can't escalate a coupon out of
--       their branch via the update path.
--
--   rpc_delete_coupon(p_id uuid)
--     — Role gate: owner / general_manager only. Hard-delete blocked
--       if any coupon_usages exist (FK is RESTRICT) — RPC short-
--       circuits with code='in_use' so the UI gets a typed error
--       instead of a Postgres constraint failure.
--
-- Toggle helpers (active/paused) intentionally stay JS-level via the
-- existing assertCouponScope guard — they touch one boolean field and
-- already use the section guard + branch scope check.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_create_coupon(jsonb);
--   DROP FUNCTION IF EXISTS rpc_update_coupon(uuid, jsonb);
--   DROP FUNCTION IF EXISTS rpc_delete_coupon(uuid);
-- ============================================================

CREATE OR REPLACE FUNCTION _coupon_role_allowed(p_role staff_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_role IN (
    'owner', 'general_manager', 'branch_manager', 'marketing'
  )
$$;

-- Branch-scope helper. Returns NULL when the caller is an admin (no
-- clamp) or the clamped single-element array for non-admins. Raises
-- a sentinel exception via RETURNING column when the caller violates
-- the scope so callers can catch with an error code.
CREATE OR REPLACE FUNCTION _coupon_clamp_branches(
  p_role     staff_role,
  p_branch   TEXT,
  p_submitted TEXT[]
)
RETURNS TEXT[]
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_role IN ('owner', 'general_manager') THEN
    RETURN p_submitted;
  END IF;
  -- Non-admin path: must include exactly the caller's own branch.
  IF p_branch IS NULL THEN
    RAISE EXCEPTION 'COUPON_BRANCH_REQUIRED';
  END IF;
  IF p_submitted IS NULL OR array_length(p_submitted, 1) IS NULL THEN
    RAISE EXCEPTION 'COUPON_BRANCH_SCOPE_REQUIRED';
  END IF;
  IF array_length(p_submitted, 1) <> 1 OR p_submitted[1] <> p_branch THEN
    RAISE EXCEPTION 'COUPON_BRANCH_SCOPE_VIOLATION';
  END IF;
  RETURN ARRAY[p_branch];
END;
$$;

-- Business-cap helper. Returns NULL on success or an error code string.
CREATE OR REPLACE FUNCTION _coupon_check_caps(
  p_role             staff_role,
  p_type             TEXT,
  p_value            NUMERIC,
  p_max_discount_bhd NUMERIC,
  p_usage_limit      INT
)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role IN ('owner', 'general_manager') THEN NULL
    WHEN p_type = 'percentage' AND p_value > 30                            THEN 'COUPON_VALUE_EXCEEDS_LIMIT'
    WHEN p_type = 'percentage' AND (p_max_discount_bhd IS NULL OR p_max_discount_bhd <= 0) THEN 'COUPON_REQUIRES_CAP'
    WHEN p_type = 'fixed_amount' AND p_value > 5                           THEN 'COUPON_VALUE_EXCEEDS_LIMIT'
    WHEN p_usage_limit IS NULL OR p_usage_limit <= 0                       THEN 'COUPON_REQUIRES_USAGE_LIMIT'
    ELSE NULL
  END
$$;

-- ── rpc_create_coupon ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_create_coupon(p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_branch     TEXT;
  v_branches   TEXT[];
  v_cap_err    TEXT;
  v_id         UUID;
  v_code       TEXT;
  v_type       TEXT;
  v_value      NUMERIC;
  v_max_cap    NUMERIC;
  v_usage_lim  INT;
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
    IF NOT _coupon_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  v_code      := UPPER(COALESCE(NULLIF(btrim(p_payload->>'code'), ''), ''));
  v_type      := p_payload->>'type';
  v_value     := (p_payload->>'value')::NUMERIC;
  v_max_cap   := NULLIF(p_payload->>'max_discount_bhd', '')::NUMERIC;
  v_usage_lim := NULLIF(p_payload->>'usage_limit', '')::INT;

  IF v_code = '' OR v_type NOT IN ('percentage', 'fixed_amount') OR v_value IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  v_cap_err := _coupon_check_caps(v_role, v_type, v_value, v_max_cap, v_usage_lim);
  IF v_cap_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', v_cap_err);
  END IF;

  -- Branch-scope clamp lives here so the JS guard cannot be bypassed.
  BEGIN
    v_branches := _coupon_clamp_branches(
      v_role,
      v_branch,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'applicable_branches', '[]'::jsonb)))
    );
  EXCEPTION
    WHEN raise_exception THEN
      RETURN jsonb_build_object('ok', false, 'code', LOWER(SQLERRM));
  END;

  INSERT INTO coupons (
    code, type, value,
    description_ar, description_en,
    min_order_value_bhd, max_discount_bhd, usage_limit, per_customer_limit,
    valid_from, valid_until, is_active, created_by,
    campaign_name, discount_type, max_discount_amount, min_order_value,
    applicable_branches, applicable_items, applicable_categories,
    customer_segment, days_active, time_start, time_end, auto_apply,
    paused, paused_at
  ) VALUES (
    v_code, v_type::coupon_type, v_value,
    NULLIF(p_payload->>'description_ar', ''),
    NULLIF(p_payload->>'description_en', ''),
    COALESCE((p_payload->>'min_order_value_bhd')::NUMERIC, 0),
    v_max_cap,
    v_usage_lim,
    COALESCE((p_payload->>'per_customer_limit')::INT, 1),
    COALESCE((p_payload->>'valid_from')::TIMESTAMPTZ, NOW()),
    NULLIF(p_payload->>'valid_until', '')::TIMESTAMPTZ,
    COALESCE((p_payload->>'is_active')::BOOLEAN, true),
    v_caller_uid,
    NULLIF(p_payload->>'campaign_name', ''),
    COALESCE(NULLIF(p_payload->>'discount_type', ''), v_type),
    NULLIF(p_payload->>'max_discount_amount', '')::NUMERIC,
    COALESCE(NULLIF(p_payload->>'min_order_value', '')::NUMERIC,
             COALESCE((p_payload->>'min_order_value_bhd')::NUMERIC, 0)),
    v_branches,
    CASE WHEN p_payload ? 'applicable_items'
         THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'applicable_items'))
         ELSE NULL END,
    CASE WHEN p_payload ? 'applicable_categories'
         THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'applicable_categories'))
         ELSE NULL END,
    COALESCE(NULLIF(p_payload->>'customer_segment', ''), 'all'),
    CASE WHEN p_payload ? 'days_active'
         THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'days_active'))::INT)
         ELSE NULL END,
    NULLIF(p_payload->>'time_start', '')::TIME,
    NULLIF(p_payload->>'time_end', '')::TIME,
    COALESCE((p_payload->>'auto_apply')::BOOLEAN, false),
    false,
    NULL
  )
  RETURNING id INTO v_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'coupons', 'INSERT',
    COALESCE(v_caller_uid, NULL),
    v_id::TEXT,
    jsonb_build_object('code', v_code, 'type', v_type, 'value', v_value),
    v_branch,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_create_coupon(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_create_coupon(jsonb) TO authenticated, service_role;

-- ── rpc_update_coupon ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_update_coupon(p_id uuid, p_payload jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_branch     TEXT;
  v_existing   coupons%ROWTYPE;
  v_branches   TEXT[];
  v_cap_err    TEXT;
  v_code       TEXT;
  v_type       TEXT;
  v_value      NUMERIC;
  v_max_cap    NUMERIC;
  v_usage_lim  INT;
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
    IF NOT _coupon_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM coupons WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Scope check against the EXISTING row so a non-admin can't escalate
  -- a coupon out of their branch via the update path.
  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF NOT (
      v_existing.created_by = v_caller_uid
      OR (v_existing.applicable_branches IS NOT NULL
          AND v_branch = ANY(v_existing.applicable_branches))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  v_code      := UPPER(COALESCE(NULLIF(btrim(p_payload->>'code'), ''), ''));
  v_type      := p_payload->>'type';
  v_value     := (p_payload->>'value')::NUMERIC;
  v_max_cap   := NULLIF(p_payload->>'max_discount_bhd', '')::NUMERIC;
  v_usage_lim := NULLIF(p_payload->>'usage_limit', '')::INT;

  IF v_code = '' OR v_type NOT IN ('percentage', 'fixed_amount') OR v_value IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  v_cap_err := _coupon_check_caps(v_role, v_type, v_value, v_max_cap, v_usage_lim);
  IF v_cap_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', v_cap_err);
  END IF;

  BEGIN
    v_branches := _coupon_clamp_branches(
      v_role,
      v_branch,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'applicable_branches', '[]'::jsonb)))
    );
  EXCEPTION
    WHEN raise_exception THEN
      RETURN jsonb_build_object('ok', false, 'code', LOWER(SQLERRM));
  END;

  UPDATE coupons SET
    code                  = v_code,
    type                  = v_type::coupon_type,
    value                 = v_value,
    description_ar        = NULLIF(p_payload->>'description_ar', ''),
    description_en        = NULLIF(p_payload->>'description_en', ''),
    min_order_value_bhd   = COALESCE((p_payload->>'min_order_value_bhd')::NUMERIC, 0),
    max_discount_bhd      = v_max_cap,
    usage_limit           = v_usage_lim,
    per_customer_limit    = COALESCE((p_payload->>'per_customer_limit')::INT, per_customer_limit),
    valid_from            = COALESCE((p_payload->>'valid_from')::TIMESTAMPTZ, valid_from),
    valid_until           = NULLIF(p_payload->>'valid_until', '')::TIMESTAMPTZ,
    is_active             = COALESCE((p_payload->>'is_active')::BOOLEAN, is_active),
    campaign_name         = NULLIF(p_payload->>'campaign_name', ''),
    discount_type         = COALESCE(NULLIF(p_payload->>'discount_type', ''), v_type),
    max_discount_amount   = NULLIF(p_payload->>'max_discount_amount', '')::NUMERIC,
    min_order_value       = COALESCE(NULLIF(p_payload->>'min_order_value', '')::NUMERIC,
                                     COALESCE((p_payload->>'min_order_value_bhd')::NUMERIC, 0)),
    applicable_branches   = v_branches,
    applicable_items      = CASE WHEN p_payload ? 'applicable_items'
                                 THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'applicable_items'))
                                 ELSE NULL END,
    applicable_categories = CASE WHEN p_payload ? 'applicable_categories'
                                 THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'applicable_categories'))
                                 ELSE NULL END,
    customer_segment      = COALESCE(NULLIF(p_payload->>'customer_segment', ''), 'all'),
    days_active           = CASE WHEN p_payload ? 'days_active'
                                 THEN ARRAY(SELECT (jsonb_array_elements_text(p_payload->'days_active'))::INT)
                                 ELSE NULL END,
    time_start            = NULLIF(p_payload->>'time_start', '')::TIME,
    time_end              = NULLIF(p_payload->>'time_end', '')::TIME,
    auto_apply            = COALESCE((p_payload->>'auto_apply')::BOOLEAN, auto_apply)
  WHERE id = p_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'coupons', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_id::TEXT,
    jsonb_build_object(
      'code',      v_code,
      'type',      v_type,
      'value',     v_value,
      'is_active', COALESCE((p_payload->>'is_active')::BOOLEAN, v_existing.is_active)
    ),
    v_branch,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_coupon(uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_update_coupon(uuid, jsonb) TO authenticated, service_role;

-- ── rpc_delete_coupon ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_delete_coupon(p_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_existing   coupons%ROWTYPE;
  v_uses       BIGINT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role := auth_user_role();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    -- Hard-delete is owner / GM only — branch_manager + marketing can
    -- pause but not destroy.
    IF v_role NOT IN ('owner', 'general_manager') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM coupons WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- coupon_usages.coupon_id is ON DELETE RESTRICT — short-circuit so the
  -- UI gets a typed error instead of a Postgres FK violation string.
  SELECT COUNT(*) INTO v_uses FROM coupon_usages WHERE coupon_id = p_id;
  IF v_uses > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'in_use', 'uses', v_uses);
  END IF;

  DELETE FROM coupons WHERE id = p_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'coupons', 'DELETE',
    COALESCE(v_caller_uid, NULL),
    p_id::TEXT,
    jsonb_build_object('code', v_existing.code),
    NULL,
    v_role
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_delete_coupon(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_delete_coupon(uuid) TO authenticated, service_role;
