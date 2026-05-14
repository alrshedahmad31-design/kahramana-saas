-- ============================================================
-- Kahramana Baghdad
-- Migration: 139_verify_tap_amount.sql
--
-- VULN-101 (PCI / PSP integrity).
--
-- Tap's webhook hashstring covers id + amount + currency + status, so an
-- attacker who controls the Tap-facing tunnel cannot forge an arbitrary
-- amount. However we still must guard against an authorized-but-misrouted
-- capture event reaching us with an amount that does NOT match what was
-- charged at order creation:
--   - Tap API returning a partially-captured amount (gateway misconfig).
--   - Reused charge_id whose amount differs from the persisted payment row.
--   - Stripped/mutated payload reaching us from a future Tap API change.
--
-- This migration adds `p_amount` to process_tap_webhook. Before flipping
-- payments.status to a captured-class state, we now:
--   1. Locate the target payment row (gateway_transaction_id, then fall back
--      to order_id pending-state, matching the prior 050/133 fallback).
--   2. If p_status implies money received (=completed) AND p_amount is set,
--      ABS(p_amount - payments.amount_bhd) > 0.001 BHD => audit + raise.
--   3. Otherwise proceed (failed/cancelled events skip the amount check).
--
-- p_amount is the normalized scalar from extractAmountScalar() in
-- src/lib/payments/tap-client.ts. Tap's webhook returns BHD amounts as the
-- major-currency decimal (e.g. 5.000 BHD), NOT fils — verified against the
-- payments.amount_bhd numeric(10,2) column scale.
--
-- ACL preserved from migration 128: service_role only.
--
-- ROLLBACK: see bottom.
-- ============================================================

-- CREATE OR REPLACE cannot add a parameter — DROP + CREATE.
DROP FUNCTION IF EXISTS public.process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID);

CREATE OR REPLACE FUNCTION public.process_tap_webhook(
  p_payload         JSONB,
  p_event_type      TEXT,
  p_gateway_id      TEXT,
  p_status          payment_status,
  p_order_reference UUID,
  p_amount          NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_webhook_id         UUID;
  v_updated_count      INTEGER := 0;
  v_existing_processed BOOLEAN;
  v_stripped           JSONB;
  v_amount_value       JSONB;
  v_amount_currency    TEXT;
  v_reference          TEXT;
  v_payment_row        payments%ROWTYPE;
  v_payment_found      BOOLEAN := false;
BEGIN
  -- ── Build the stripped JSON object (unchanged from migration 133) ─────────
  IF jsonb_typeof(p_payload -> 'amount') = 'object' THEN
    v_amount_value    := p_payload -> 'amount' -> 'value';
    v_amount_currency := COALESCE(
      p_payload -> 'amount' ->> 'currency',
      p_payload ->> 'currency'
    );
  ELSE
    v_amount_value    := p_payload -> 'amount';
    v_amount_currency := p_payload ->> 'currency';
  END IF;

  IF jsonb_typeof(p_payload -> 'reference') = 'object' THEN
    v_reference := p_payload -> 'reference' ->> 'order';
  ELSIF jsonb_typeof(p_payload -> 'reference') = 'string' THEN
    v_reference := p_payload ->> 'reference';
  ELSE
    v_reference := NULL;
  END IF;

  v_stripped := jsonb_build_object(
    'id',        p_payload ->> 'id',
    'status',    p_payload ->> 'status',
    'amount',    jsonb_build_object(
      'value',    v_amount_value,
      'currency', v_amount_currency
    ),
    'reference', v_reference,
    'card',      jsonb_build_object(
      'brand',     p_payload -> 'card' ->> 'brand',
      'last_four', p_payload -> 'card' ->> 'last_four'
    )
  );

  -- ── Dedupe check (unchanged) ──────────────────────────────────────────────
  IF p_gateway_id IS NOT NULL AND p_gateway_id <> '' THEN
    SELECT processed
    INTO v_existing_processed
    FROM payment_webhooks
    WHERE payload @> jsonb_build_object('id', p_gateway_id)
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_processed THEN
      RETURN jsonb_build_object('processed', true, 'duplicate', true, 'updated_count', 0);
    END IF;
  END IF;

  INSERT INTO payment_webhooks (provider, event_type, payload, processed)
  VALUES ('tap', p_event_type, p_payload, false)
  RETURNING id INTO v_webhook_id;

  -- Non-status events (e.g. unrelated object types) — log webhook and exit.
  IF p_status IS NULL THEN
    UPDATE payment_webhooks
    SET processed = true,
        processed_at = NOW()
    WHERE id = v_webhook_id;

    RETURN jsonb_build_object('processed', true, 'webhook_id', v_webhook_id, 'updated_count', 0);
  END IF;

  -- ── Locate target payment row (binding-first, order_id fallback) ──────────
  SELECT * INTO v_payment_row
  FROM payments
  WHERE gateway_transaction_id = p_gateway_id;
  v_payment_found := FOUND;

  IF NOT v_payment_found AND p_order_reference IS NOT NULL THEN
    SELECT * INTO v_payment_row
    FROM payments
    WHERE order_id = p_order_reference
      AND status IN ('pending', 'processing');
    v_payment_found := FOUND;
  END IF;

  IF NOT v_payment_found THEN
    INSERT INTO webhook_errors (provider, gateway_id, order_id, reason, payload)
    VALUES ('tap', p_gateway_id, p_order_reference, 'payment_not_found', p_payload);

    RETURN jsonb_build_object('processed', false, 'webhook_id', v_webhook_id, 'updated_count', 0);
  END IF;

  -- ── VULN-101: amount verification before captured-class status flip ───────
  -- Only enforced for money-received events. Tap's BHD webhook amount is in
  -- major units (decimal BHD); we compare directly against payments.amount_bhd
  -- with a 0.001 BHD tolerance (= 1 fils, smallest BHD subunit).
  IF p_amount IS NOT NULL AND p_status = 'completed' THEN
    IF ABS(p_amount - v_payment_row.amount_bhd) > 0.001 THEN
      INSERT INTO audit_logs (
        table_name, action, user_id, record_id, changes, branch_id, actor_role
      ) VALUES (
        'payments',
        'PAYMENT_AMOUNT_MISMATCH',
        NULL,
        v_payment_row.id::text,
        jsonb_build_object(
          'gateway_id',      p_gateway_id,
          'expected_bhd',    v_payment_row.amount_bhd,
          'received_amount', p_amount,
          'order_id',        v_payment_row.order_id,
          'event_type',      p_event_type
        ),
        NULL,
        NULL
      );
      RAISE EXCEPTION 'AMOUNT_MISMATCH' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ── Apply status update to the located row ────────────────────────────────
  UPDATE payments
  SET status                 = p_status,
      gateway_transaction_id = p_gateway_id,
      gateway_response       = v_stripped,
      updated_at             = NOW()
  WHERE id = v_payment_row.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    INSERT INTO webhook_errors (provider, gateway_id, order_id, reason, payload)
    VALUES ('tap', p_gateway_id, p_order_reference, 'payment_not_found', p_payload);

    RETURN jsonb_build_object('processed', false, 'webhook_id', v_webhook_id, 'updated_count', 0);
  END IF;

  UPDATE payment_webhooks
  SET processed = true,
      processed_at = NOW()
  WHERE id = v_webhook_id;

  RETURN jsonb_build_object('processed', true, 'webhook_id', v_webhook_id, 'updated_count', v_updated_count);
END;
$$;

REVOKE ALL ON FUNCTION public.process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID, NUMERIC) TO service_role;

-- ============================================================
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.process_tap_webhook(JSONB, TEXT, TEXT, payment_status, UUID, NUMERIC);
--   -- then re-apply migration 133 to restore the previous 5-arg signature.
-- ============================================================
