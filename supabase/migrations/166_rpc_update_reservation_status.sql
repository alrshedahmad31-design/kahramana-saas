-- ============================================================
-- Kahramana Baghdad
-- Migration: 166_rpc_update_reservation_status.sql
--
-- Closes the RPC-PENDING marker in src/app/[locale]/dashboard
-- /reservations/actions.ts:
--   • updateReservationStatus — direct UPDATE reservations SET status
--
-- rpc_update_reservation_status(p_reservation_id, p_new_status,
--                               p_expected_status)
--   — Lifecycle transitions for reservations:
--       pending   → confirmed | cancelled | no_show
--       confirmed → seated    | cancelled | no_show
--       seated    → completed | cancelled
--       no_show, cancelled, completed → terminal
--   — Role gate: same set as INSERT (114_reservations) —
--       owner / general_manager / branch_manager / cashier / waiter.
--   — Branch gate: non-globals must match the row's branch_id.
--   — CAS predicate on p_expected_status → conflict short-circuits
--     before the audit row.
--   — Stamps confirmed_at / seated_at / cancelled_at / completed_at
--     according to the target status (mirrors the JS patch object).
--   — Writes an audit_logs row inside the same transaction.
--
-- Return shape: jsonb { ok, status?, code? } so the server action can
-- map to a typed error code.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_update_reservation_status(uuid, text, text);
-- ============================================================

-- ── Helper: role allowed to manage reservations ────────────────
-- Mirrors SECTION_ROLES.reservations in src/lib/auth/rbac-ui.ts.

CREATE OR REPLACE FUNCTION _reservation_role_allowed(p_role staff_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_role IN (
    'owner', 'general_manager', 'branch_manager', 'cashier', 'waiter'
  )
$$;

-- ── Helper: transition allowed for a given prev/next ───────────
-- Mirrors ALLOWED_RESERVATION_TRANSITIONS in actions.ts.

CREATE OR REPLACE FUNCTION _reservation_transition_allowed(
  p_prev TEXT,
  p_next TEXT
)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_prev = p_next THEN TRUE                       -- idempotent re-pin
    WHEN p_prev = 'pending'   THEN p_next IN ('confirmed', 'cancelled', 'no_show')
    WHEN p_prev = 'confirmed' THEN p_next IN ('seated', 'cancelled', 'no_show')
    WHEN p_prev = 'seated'    THEN p_next IN ('completed', 'cancelled')
    WHEN p_prev IN ('no_show', 'cancelled', 'completed') THEN FALSE
    ELSE FALSE
  END
$$;

-- ── rpc_update_reservation_status ──────────────────────────────

CREATE OR REPLACE FUNCTION rpc_update_reservation_status(
  p_reservation_id  UUID,
  p_new_status      TEXT,
  p_expected_status TEXT
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
  v_reservation   reservations%ROWTYPE;
  v_now           TIMESTAMPTZ;
  v_updated_count INT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Input validation (status whitelist matches the CHECK constraint
  -- on reservations.status from migration 114).
  IF p_new_status NOT IN (
    'pending', 'confirmed', 'seated', 'no_show', 'cancelled', 'completed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_expected_status NOT IN (
    'pending', 'confirmed', 'seated', 'no_show', 'cancelled', 'completed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT _reservation_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_reservation FROM reservations
   WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager')
     AND v_reservation.branch_id <> COALESCE(v_branch, '__none__') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
  END IF;

  IF NOT _reservation_transition_allowed(v_reservation.status, p_new_status) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
  END IF;

  v_now := NOW();

  -- CAS pinned UPDATE — short-circuits without a row mutation if
  -- another writer slipped in between the SELECT FOR UPDATE row read
  -- above and this UPDATE (defense in depth on top of the row lock).
  UPDATE reservations
     SET status       = p_new_status,
         confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN v_now ELSE confirmed_at END,
         seated_at    = CASE WHEN p_new_status = 'seated'    THEN v_now ELSE seated_at    END,
         cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN v_now ELSE cancelled_at END,
         completed_at = CASE WHEN p_new_status = 'completed' THEN v_now ELSE completed_at END
   WHERE id = p_reservation_id
     AND status = p_expected_status;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict');
  END IF;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'reservations', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_reservation_id::TEXT,
    jsonb_build_object(
      'status',      p_new_status,
      'prev_status', v_reservation.status
    ),
    v_reservation.branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_reservation_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_update_reservation_status(UUID, TEXT, TEXT) TO authenticated, service_role;
