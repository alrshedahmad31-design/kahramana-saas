-- ============================================================
-- Kahramana Baghdad
-- Migration: 178_rpc_coupon_toggles.sql
--
-- Closes the 2 remaining direct writes in dashboard/coupons/actions.ts
-- (toggleCouponActive, toggleCouponPause). Migration 170 added the
-- create/update/delete RPCs but left the toggles JS-side because the
-- caller's branch-scope check (assertCouponScope) was simpler to keep
-- in TypeScript. Folding it into SQL closes the audit-row split-
-- transaction window -- same rationale as the rest of the 170 sweep.
--
-- Both RPCs reuse migration 170's helper:
--   _coupon_role_allowed(staff_role)
--
-- The existing-row scope check (created_by OR caller.branch_id is
-- member of applicable_branches) is inlined here because
-- rpc_update_coupon does the same inline -- extracting a shared helper
-- would be a 170 refactor.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_set_coupon_active(UUID, BOOLEAN);
--   DROP FUNCTION IF EXISTS rpc_set_coupon_paused(UUID, BOOLEAN);
-- ============================================================

-- -- rpc_set_coupon_active ---------------------------------------

CREATE OR REPLACE FUNCTION rpc_set_coupon_active(p_id UUID, p_is_active BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_role     staff_role;
  v_branch   TEXT;
  v_existing coupons%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NOT _coupon_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM coupons WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF NOT (
      v_existing.created_by = v_uid
      OR (v_existing.applicable_branches IS NOT NULL
          AND v_branch = ANY(v_existing.applicable_branches))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  UPDATE coupons SET is_active = p_is_active WHERE id = p_id;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('coupons', 'UPDATE', v_uid, p_id::TEXT,
          jsonb_build_object('is_active', p_is_active),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_set_coupon_active(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_set_coupon_active(UUID, BOOLEAN) TO authenticated, service_role;

-- -- rpc_set_coupon_paused ---------------------------------------

CREATE OR REPLACE FUNCTION rpc_set_coupon_paused(p_id UUID, p_is_paused BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_role     staff_role;
  v_branch   TEXT;
  v_existing coupons%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NOT _coupon_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM coupons WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager') THEN
    IF NOT (
      v_existing.created_by = v_uid
      OR (v_existing.applicable_branches IS NOT NULL
          AND v_branch = ANY(v_existing.applicable_branches))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  UPDATE coupons SET
    paused    = p_is_paused,
    paused_at = CASE WHEN p_is_paused THEN NOW() ELSE NULL END
   WHERE id = p_id;

  INSERT INTO audit_logs (table_name, action, user_id, record_id, changes, branch_id, actor_role)
  VALUES ('coupons', 'UPDATE', v_uid, p_id::TEXT,
          jsonb_build_object('paused', p_is_paused),
          v_branch, v_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_set_coupon_paused(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_set_coupon_paused(UUID, BOOLEAN) TO authenticated, service_role;
