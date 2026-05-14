-- ============================================================
-- Kahramana Baghdad
-- Migration: 138_atomic_audit_events.sql
--
-- KAH-2026-05-06 / AUD-V3-014.
--
-- Three financial-event server actions previously did fire-and-forget
-- audit_logs.insert() AFTER the state mutation, so an audit insert failure
-- left the operation persisted with no audit row:
--   • refundPayment  (payments.status flip + audit)
--   • closeShift     (shift_closings INSERT — currently NO audit at all)
--   • POS order      (orders + payments + audit, three steps)
--
-- Fix: three SECURITY DEFINER PL/pgSQL functions that bundle the state
-- mutation and the audit row in a single transaction. If the audit insert
-- fails, the parent operation rolls back (PL/pgSQL semantics).
--
-- For POS the order itself stays in rpc_create_order — that's already atomic
-- and the orders table is the financial source of truth. rpc_pos_finalize_order
-- atomizes the (payments INSERT + audit INSERT) pair that runs after order
-- creation. Net effect: every POS order either has BOTH a payment row and an
-- audit row, or NEITHER — no more orphan orders with missing audit.
--
-- ACL: all three are revoked from anon. authenticated retained so server
-- actions can invoke under the user's RLS context (the functions are
-- SECURITY DEFINER and re-check role themselves).
--
-- ROLLBACK:
--   DROP FUNCTION rpc_refund_payment, rpc_close_shift, rpc_pos_finalize_order;
--   Revert the corresponding JS callers in payments/shifts/pos actions.ts.
-- ============================================================


-- ─── 1. rpc_refund_payment ───────────────────────────────────────────────────
-- Atomic: CAS-update payments.status from completed→refunded AND insert
-- audit_logs row. Either both commit or both roll back.
--
-- Returns JSONB so the JS caller can pattern-match domain errors without
-- parsing PG error strings. Hard errors (auth, RLS) raise normally.
CREATE OR REPLACE FUNCTION public.rpc_refund_payment(
  p_payment_id      uuid,
  p_actor_id        uuid,
  p_actor_role      text,
  p_actor_branch_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_updated INT;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_actor_role NOT IN ('owner', 'general_manager') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND');
  END IF;

  IF v_payment.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_REFUNDABLE',
                              'current_status', v_payment.status);
  END IF;

  UPDATE payments
  SET    status            = 'refunded',
         refunded_at       = NOW(),
         refund_amount_bhd = v_payment.amount_bhd,
         updated_at        = NOW()
  WHERE  id = p_payment_id
    AND  status = 'completed';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'CONCURRENT_CHANGE');
  END IF;

  -- Audit insert is in the same transaction — failure rolls back the UPDATE.
  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'payments', 'UPDATE', p_actor_id, p_payment_id::text,
    jsonb_build_object(
      'operation',         'refund',
      'previous_status',   v_payment.status,
      'new_status',        'refunded',
      'refund_amount_bhd', v_payment.amount_bhd
    ),
    p_actor_branch_id, p_actor_role::staff_role
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_refund_payment(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_refund_payment(uuid, uuid, text, text) TO authenticated, service_role;


-- ─── 2. rpc_close_shift ──────────────────────────────────────────────────────
-- Atomic: shift_closings INSERT + audit_logs INSERT in one transaction.
-- Previously closeShift in JS did only the shift insert with no audit.
CREATE OR REPLACE FUNCTION public.rpc_close_shift(
  p_branch_id          text,
  p_shift_date         date,
  p_shift_type         text,
  p_actual_cash_bhd    numeric,
  p_expected_cash_bhd  numeric,
  p_total_orders       int,
  p_total_revenue_bhd  numeric,
  p_notes              text,
  p_discrepancy_reason text,
  p_actor_id           uuid,
  p_actor_role         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_shift_id   uuid;
  v_status     text;
  v_discrepancy numeric;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_actor_role NOT IN ('owner', 'general_manager', 'branch_manager') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_shift_type NOT IN ('morning', 'evening', 'night') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_TYPE');
  END IF;

  v_discrepancy := p_actual_cash_bhd - p_expected_cash_bhd;
  v_status      := CASE WHEN abs(v_discrepancy) > 0.005 THEN 'flagged' ELSE 'pending' END;

  INSERT INTO shift_closings (
    branch_id, shift_date, shift_type,
    actual_cash_bhd, expected_cash_bhd,
    total_orders, total_revenue_bhd,
    notes, discrepancy_reason,
    closed_by, status
  ) VALUES (
    p_branch_id, p_shift_date, p_shift_type,
    p_actual_cash_bhd, p_expected_cash_bhd,
    p_total_orders, p_total_revenue_bhd,
    p_notes, p_discrepancy_reason,
    p_actor_id, v_status
  )
  RETURNING id INTO v_shift_id;

  -- Audit in same transaction — failure rolls back the shift close.
  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'shift_closings', 'INSERT', p_actor_id, v_shift_id::text,
    jsonb_build_object(
      'operation',           'close_shift',
      'shift_date',          p_shift_date,
      'shift_type',          p_shift_type,
      'actual_cash_bhd',     p_actual_cash_bhd,
      'expected_cash_bhd',   p_expected_cash_bhd,
      'discrepancy_bhd',     v_discrepancy,
      'total_orders',        p_total_orders,
      'total_revenue_bhd',   p_total_revenue_bhd,
      'status',              v_status
    ),
    p_branch_id, p_actor_role::staff_role
  );

  RETURN jsonb_build_object('success', true, 'shift_id', v_shift_id, 'status', v_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_close_shift(text, date, text, numeric, numeric, int, numeric, text, text, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_close_shift(text, date, text, numeric, numeric, int, numeric, text, text, uuid, text) TO authenticated, service_role;


-- ─── 3. rpc_pos_finalize_order ──────────────────────────────────────────────
-- Atomic: payments INSERT + audit_logs INSERT after a POS rpc_create_order.
-- The order itself stays in rpc_create_order (already atomic + idempotent);
-- this RPC ensures the post-order trail is either fully written or not at all.
CREATE OR REPLACE FUNCTION public.rpc_pos_finalize_order(
  p_order_id        uuid,
  p_amount_bhd      numeric,
  p_method          text,           -- 'cash' | 'tap_card'
  p_payment_status  text,           -- 'pending_cod' | 'pending'
  p_audit_changes   jsonb,
  p_actor_id        uuid,
  p_actor_role      text,
  p_actor_branch_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_payment_id uuid;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_actor_role NOT IN ('owner', 'general_manager', 'branch_manager', 'cashier') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_method NOT IN ('cash', 'tap_card') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_METHOD');
  END IF;

  IF p_payment_status NOT IN ('pending_cod', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYMENT_STATUS');
  END IF;

  INSERT INTO payments (order_id, amount_bhd, method, status)
  VALUES (p_order_id, p_amount_bhd, p_method::payment_method, p_payment_status::payment_status)
  RETURNING id INTO v_payment_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'orders', 'INSERT', p_actor_id, p_order_id::text,
    p_audit_changes, p_actor_branch_id, p_actor_role::staff_role
  );

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_pos_finalize_order(uuid, numeric, text, text, jsonb, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_pos_finalize_order(uuid, numeric, text, text, jsonb, uuid, text, text) TO authenticated, service_role;
