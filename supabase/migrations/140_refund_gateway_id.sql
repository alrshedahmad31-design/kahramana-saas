-- ============================================================
-- Kahramana Baghdad
-- Migration: 140_refund_gateway_id.sql
--
-- VULN-102 (PCI / refund integrity).
--
-- The previous refund path (migration 138, rpc_refund_payment) marked the
-- payment as refunded in our DB without ever calling Tap's refund API. The
-- customer's money was never returned; the staff dashboard simply lied.
--
-- This migration:
--   1. Adds payments.gateway_refund_id TEXT — the Tap refund object id
--      returned by POST /v2/refunds. NULL for pre-VULN-102 rows and any
--      future cash-method refund flows.
--   2. Rebuilds rpc_refund_payment to require:
--        - p_gateway_refund_id TEXT  (Tap refund id from JS call)
--      and persist it alongside the existing CAS update + audit row.
--   3. Adds a guard: refuses to flip when gateway_transaction_id IS NULL
--      (no Tap charge to reverse → caller error, not a refund).
--
-- The JS caller (src/app/[locale]/dashboard/payments/actions.ts) now calls
-- tapClient.refundCharge() FIRST, and only on Tap success invokes this RPC.
-- A Tap failure short-circuits before any DB mutation.
--
-- CREATE OR REPLACE cannot change parameter list — DROP + CREATE.
-- ACL: revoked from anon, granted to authenticated + service_role.
-- ============================================================

-- ─── 1. Column ───────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_gateway_refund_id
  ON public.payments(gateway_refund_id)
  WHERE gateway_refund_id IS NOT NULL;

COMMENT ON COLUMN public.payments.gateway_refund_id IS
  'Tap refund object id returned by POST /v2/refunds. NULL for cash refunds and pre-VULN-102 rows.';


-- ─── 2. RPC ──────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.rpc_refund_payment(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.rpc_refund_payment(
  p_payment_id        uuid,
  p_gateway_refund_id text,
  p_actor_id          uuid,
  p_actor_role        text,
  p_actor_branch_id   text
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

  IF p_gateway_refund_id IS NULL OR p_gateway_refund_id = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_REFUND_ID');
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND');
  END IF;

  IF v_payment.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_REFUNDABLE',
                              'current_status', v_payment.status);
  END IF;

  -- VULN-102: refusing the DB flip when there is no real charge to reverse.
  IF v_payment.gateway_transaction_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_GATEWAY_CHARGE');
  END IF;

  UPDATE payments
  SET    status            = 'refunded',
         refunded_at       = NOW(),
         refund_amount_bhd = v_payment.amount_bhd,
         gateway_refund_id = p_gateway_refund_id,
         updated_at        = NOW()
  WHERE  id     = p_payment_id
    AND  status = 'completed';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'CONCURRENT_CHANGE');
  END IF;

  -- Audit insert in same transaction — failure rolls back the UPDATE.
  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'payments', 'PAYMENT_REFUNDED', p_actor_id, p_payment_id::text,
    jsonb_build_object(
      'operation',         'refund',
      'previous_status',   v_payment.status,
      'new_status',        'refunded',
      'refund_amount_bhd', v_payment.amount_bhd,
      'order_id',          v_payment.order_id,
      'gateway_refund_id', p_gateway_refund_id
    ),
    p_actor_branch_id, p_actor_role::staff_role
  );

  RETURN jsonb_build_object(
    'success',           true,
    'order_id',          v_payment.order_id,
    'gateway_refund_id', p_gateway_refund_id,
    'refund_amount_bhd', v_payment.amount_bhd
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_refund_payment(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_refund_payment(uuid, text, uuid, text, text) TO authenticated, service_role;


-- ============================================================
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.rpc_refund_payment(uuid, text, uuid, text, text);
--   ALTER TABLE public.payments DROP COLUMN IF EXISTS gateway_refund_id;
--   -- then re-apply migration 138 to restore the previous 4-arg signature.
-- ============================================================
