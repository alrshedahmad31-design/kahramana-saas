-- ============================================================
-- Kahramana Baghdad
-- Migration: 169_rpc_approve_shift.sql
--
-- Closes the last direct write on shift_closings in
-- src/app/[locale]/dashboard/shifts/actions.ts:
--
--   • approveShift — direct UPDATE shift_closings SET status='approved',
--                    approved_by = caller, approved_at = now()
--
-- One new RPC replaces the JS-level write so the status transition AND
-- the audit_logs row commit (or roll back) atomically:
--
--   rpc_approve_shift(p_shift_id)
--     — Role gate: owner / general_manager only (mirrors the JS gate
--       isGlobalDashboardAdmin). branch_manager who closed the shift
--       cannot self-approve.
--     — Status CAS: pin UPDATE to status='pending'; returns
--       { ok=false, code='conflict' } if the row was already approved
--       or rejected between the JS pre-check and the RPC call.
--     — approved_by stamped from auth.uid() (NOT the input) so a forged
--       payload cannot misattribute the approval.
--     — Audit row carries the prior status + the approver in one txn.
--
-- The sibling rpc_close_shift (migration 138) is unchanged — this
-- migration only adds the approve path.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_approve_shift(UUID);
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_approve_shift(
  p_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    UUID;
  v_role          staff_role;
  v_shift         shift_closings%ROWTYPE;
  v_updated_count INT;
  v_now           TIMESTAMPTZ := NOW();
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
    -- Approval is a financial sign-off — owner / GM only.
    IF v_role NOT IN ('owner', 'general_manager') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_shift FROM shift_closings WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_shift.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
  END IF;

  UPDATE shift_closings
     SET status      = 'approved',
         approved_by = COALESCE(v_caller_uid, approved_by),
         approved_at = v_now
   WHERE id = p_shift_id
     AND status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict');
  END IF;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'shift_closings', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_shift_id::TEXT,
    jsonb_build_object(
      'status',      'approved',
      'prev_status', v_shift.status,
      'approved_at', v_now
    ),
    v_shift.branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'status', 'approved');
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_approve_shift(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_approve_shift(UUID) TO authenticated, service_role;
