-- ============================================================
-- Kahramana Baghdad
-- Migration: 167_rpc_create_leave_request.sql
--
-- Closes the RPC-PENDING marker in src/app/[locale]/dashboard
-- /staff/[id]/actions.ts:
--   • createLeaveRequest — direct INSERT into leave_requests
--
-- rpc_create_leave_request(p_leave_type, p_start_date, p_end_date,
--                          p_days_count, p_reason?)
--   — Self-id enforcement: staff_id is *always* auth.uid().
--     The legacy JS layer accepted input.staff_id and only checked
--     equality with caller.id; this RPC removes the input field
--     entirely so the column is filled from the session.
--   — Date sanity checks mirror the JS window
--     (LEAVE_PAST_DAYS = 30, LEAVE_FUTURE_DAYS = 180, max 60 days).
--   — Inserts the leave row and an audit_logs row in one txn so the
--     audit trail never lags behind the leave row.
--   — Returns jsonb { ok, leave_request_id?, code? }.
--
-- Constants are duplicated here from src/app/[locale]/dashboard
-- /staff/[id]/actions.ts so the RPC self-validates without a join.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_create_leave_request(text, date, date, integer, text);
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_create_leave_request(
  p_leave_type TEXT,
  p_start_date DATE,
  p_end_date   DATE,
  p_days_count INT,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid     UUID;
  v_caller_role    staff_role;
  v_caller_branch  TEXT;
  v_today          DATE;
  v_min_start      DATE;
  v_max_start      DATE;
  v_days_in_range  INT;
  v_new_id         UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Active staff check + role/branch snapshot for the audit row.
  SELECT role, branch_id
    INTO v_caller_role, v_caller_branch
  FROM   staff_basic
  WHERE  id = v_caller_uid
    AND  is_active = TRUE;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Input validation (mirrors actions.ts schema).
  IF p_leave_type NOT IN ('annual', 'sick', 'emergency', 'unpaid', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_leave_type');
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_date');
  END IF;

  v_today     := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_min_start := v_today - 30;
  v_max_start := v_today + 180;

  IF p_start_date < v_min_start THEN
    RETURN jsonb_build_object('ok', false, 'code', 'start_too_early');
  END IF;
  IF p_start_date > v_max_start THEN
    RETURN jsonb_build_object('ok', false, 'code', 'start_too_late');
  END IF;
  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_range');
  END IF;

  v_days_in_range := (p_end_date - p_start_date) + 1;
  IF p_days_count IS NULL OR p_days_count < 1 OR p_days_count <> v_days_in_range THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_days_count');
  END IF;
  IF v_days_in_range > 60 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'duration_exceeded');
  END IF;

  -- Self-id enforcement: staff_id is *always* the caller. There is no
  -- p_staff_id param so this RPC cannot be redirected to another staff.
  INSERT INTO leave_requests (
    staff_id, leave_type, start_date, end_date, days_count, reason, status
  ) VALUES (
    v_caller_uid, p_leave_type, p_start_date, p_end_date,
    v_days_in_range,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    'pending'
  )
  RETURNING id INTO v_new_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'leave_requests', 'INSERT',
    v_caller_uid,
    v_new_id::TEXT,
    jsonb_build_object(
      'leave_type', p_leave_type,
      'start_date', p_start_date,
      'end_date',   p_end_date,
      'days_count', v_days_in_range
    ),
    v_caller_branch,
    v_caller_role
  );

  RETURN jsonb_build_object('ok', true, 'leave_request_id', v_new_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_create_leave_request(TEXT, DATE, DATE, INT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_create_leave_request(TEXT, DATE, DATE, INT, TEXT) TO authenticated, service_role;
