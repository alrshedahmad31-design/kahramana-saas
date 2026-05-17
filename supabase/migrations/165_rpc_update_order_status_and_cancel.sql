-- ============================================================
-- Kahramana Baghdad
-- Migration: 165_rpc_update_order_status_and_cancel.sql
--
-- Closes RPC-PENDING markers in src/app/[locale]/dashboard/orders
-- /actions.ts:
--   • updateOrderStatus       — direct UPDATE orders SET status
--   • updateOrderWithReason   — direct UPDATE + audit_logs INSERT
--
-- Two new RPCs replace the JS-level writes so the status change AND
-- the audit row commit (or roll back) atomically:
--
--   rpc_update_order_status(p_order_id, p_new_status, p_expected_status)
--     — Lifecycle transitions for non-terminal moves (accepted →
--       preparing → ready → out_for_delivery → delivered → completed,
--       and the recovery edges in src/lib/auth/permissions.ts).
--     — Roles allowed are enforced per-status via the same map the
--       JS canUpdateOrderStatus() helper uses (rbac.ts).
--     — Refund block: a captured payment row blocks cancel/return
--       (those paths must go through rpc_cancel_order which uses
--       updated_notes, not this RPC).
--     — Optimistic concurrency: p_expected_status must equal the
--       current row status. NULL row_count from UPDATE -> CONFLICT.
--
--   rpc_cancel_order(p_order_id, p_target_status, p_reason)
--     — Terminal cancel / return transitions only.
--     — Same role gate as rpc_update_order_status for the target.
--     — Captured-payment guard: blocks until payment is refunded.
--     — Appends a "[CANCELLED|RETURNED <ts>]: <reason>" suffix to
--       orders.notes (mirrors the prior JS behaviour).
--     — CAS on status; conflict short-circuits before the audit row.
--
-- Both RPCs:
--   • SECURITY DEFINER, search_path = public
--   • Re-assert auth.uid() + role + branch in the body (RLS doubles
--     as defense-in-depth)
--   • Insert into audit_logs with actor_role + branch_id derived from
--     the caller's session (NOT the input), matching the
--     audit_insert_own_actions WITH CHECK on migration 004.
--
-- Return shape: TEXT error code on guarded failure (so the server
-- action can map to a typed OrderActionErrorCode), and a SETOF row
-- shape on success containing { ok, status, conflict, code }.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_update_order_status(uuid, order_status, order_status);
--   DROP FUNCTION IF EXISTS rpc_cancel_order(uuid, order_status, text);
-- ============================================================

-- ── 1. Helper: role allowed for a given target status ──────────
-- Mirrors STATUS_ALLOWED_ROLES in src/lib/auth/rbac.ts. Kept inside
-- the migration body for self-containment; future edits must touch
-- both this map and the TS helper.

CREATE OR REPLACE FUNCTION _order_status_role_allowed(
  p_role    staff_role,
  p_status  order_status
)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'under_review'     THEN p_role IN ('owner', 'general_manager', 'branch_manager', 'cashier')
    WHEN 'accepted'         THEN p_role IN ('owner', 'general_manager', 'branch_manager', 'cashier')
    WHEN 'preparing'        THEN p_role IN ('owner', 'general_manager', 'branch_manager', 'kitchen')
    WHEN 'ready'            THEN p_role IN ('owner', 'general_manager', 'branch_manager', 'kitchen')
    WHEN 'out_for_delivery' THEN p_role IN ('owner', 'general_manager', 'branch_manager', 'driver')
    WHEN 'delivered'        THEN p_role IN ('owner', 'general_manager', 'branch_manager', 'driver')
    WHEN 'completed'        THEN p_role IN ('owner', 'general_manager', 'branch_manager')
    WHEN 'cancelled'        THEN p_role IN ('owner', 'general_manager', 'branch_manager')
    WHEN 'returned'         THEN p_role IN ('owner', 'general_manager', 'branch_manager')
    ELSE FALSE
  END
$$;

-- ── 2. Helper: transition allowed for a given prev/next ────────
-- Mirrors ALLOWED_TRANSITIONS in src/lib/auth/permissions.ts.

CREATE OR REPLACE FUNCTION _order_status_transition_allowed(
  p_prev order_status,
  p_next order_status
)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_prev
    WHEN 'new'              THEN p_next IN ('under_review', 'accepted', 'cancelled')
    WHEN 'under_review'     THEN p_next IN ('accepted', 'cancelled')
    WHEN 'pending_payment'  THEN p_next IN ('cancelled')
    WHEN 'confirmed'        THEN p_next IN ('accepted', 'cancelled')
    WHEN 'accepted'         THEN p_next IN ('preparing', 'cancelled')
    WHEN 'preparing'        THEN p_next IN ('ready', 'cancelled')
    WHEN 'ready'            THEN p_next IN ('out_for_delivery', 'completed', 'cancelled')
    WHEN 'out_for_delivery' THEN p_next IN ('delivered', 'ready', 'cancelled', 'delivery_failed')
    WHEN 'delivery_failed'  THEN p_next IN ('ready', 'cancelled')
    WHEN 'delivered'        THEN p_next IN ('completed', 'cancelled', 'returned')
    WHEN 'completed'        THEN FALSE
    WHEN 'cancelled'        THEN FALSE
    WHEN 'payment_failed'   THEN p_next IN ('new', 'cancelled')
    ELSE FALSE
  END
$$;

-- ── 3. rpc_update_order_status ─────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_update_order_status(
  p_order_id        UUID,
  p_new_status      order_status,
  p_expected_status order_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    UUID;
  v_role          staff_role;
  v_branch        TEXT;
  v_order         orders%ROWTYPE;
  v_paid          BOOLEAN;
  v_updated_count INT;
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
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Branch scope (non-globals can only touch their own branch).
  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager')
     AND v_order.branch_id <> COALESCE(v_branch, '__none__') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
  END IF;

  -- Role + transition gate.
  IF auth.role() <> 'service_role' THEN
    IF NOT _order_status_role_allowed(v_role, p_new_status) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
    END IF;
  END IF;
  IF NOT _order_status_transition_allowed(v_order.status, p_new_status) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
  END IF;

  -- Refund guard: paid orders can't silently flip to cancelled / returned.
  IF p_new_status IN ('cancelled', 'returned') THEN
    SELECT EXISTS (
      SELECT 1 FROM payments
      WHERE order_id = p_order_id AND status = 'completed'
    ) INTO v_paid;
    IF v_paid THEN
      RETURN jsonb_build_object('ok', false, 'code', 'refund_required');
    END IF;
  END IF;

  -- Optimistic concurrency: pin by p_expected_status.
  UPDATE orders
     SET status = p_new_status
   WHERE id = p_order_id
     AND status = p_expected_status;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict');
  END IF;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'orders', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_order_id::TEXT,
    jsonb_build_object(
      'status',      p_new_status,
      'prev_status', v_order.status
    ),
    v_order.branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_order_status(UUID, order_status, order_status) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_update_order_status(UUID, order_status, order_status) TO authenticated, service_role;

-- ── 4. rpc_cancel_order ────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_cancel_order(
  p_order_id      UUID,
  p_target_status order_status,
  p_reason        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    UUID;
  v_role          staff_role;
  v_branch        TEXT;
  v_order         orders%ROWTYPE;
  v_paid          BOOLEAN;
  v_updated_count INT;
  v_timestamp     TEXT;
  v_tag           TEXT;
  v_updated_notes TEXT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_target_status NOT IN ('cancelled', 'returned') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3
     OR char_length(p_reason) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager')
     AND v_order.branch_id <> COALESCE(v_branch, '__none__') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF NOT _order_status_role_allowed(v_role, p_target_status) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
    END IF;
  END IF;
  IF NOT _order_status_transition_allowed(v_order.status, p_target_status) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
  END IF;

  -- Refund guard.
  SELECT EXISTS (
    SELECT 1 FROM payments
    WHERE order_id = p_order_id AND status = 'completed'
  ) INTO v_paid;
  IF v_paid THEN
    RETURN jsonb_build_object('ok', false, 'code', 'refund_required');
  END IF;

  v_timestamp := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_tag := UPPER(p_target_status::TEXT);
  v_updated_notes := CASE
    WHEN v_order.notes IS NULL OR v_order.notes = ''
      THEN format('[%s %s]: %s', v_tag, v_timestamp, p_reason)
    ELSE format('%s' || E'\n' || '[%s %s]: %s', v_order.notes, v_tag, v_timestamp, p_reason)
  END;

  UPDATE orders
     SET status     = p_target_status,
         notes      = v_updated_notes,
         updated_at = NOW()
   WHERE id = p_order_id
     AND status = v_order.status;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict');
  END IF;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'orders', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_order_id::TEXT,
    jsonb_build_object(
      'status',      p_target_status,
      'prev_status', v_order.status,
      'reason',      p_reason
    ),
    v_order.branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'status', p_target_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_cancel_order(UUID, order_status, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_cancel_order(UUID, order_status, TEXT) TO authenticated, service_role;
