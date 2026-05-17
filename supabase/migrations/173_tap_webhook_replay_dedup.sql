-- ============================================================
-- Kahramana Baghdad
-- Migration: 173_tap_webhook_replay_dedup.sql
--
-- T2-10: tighten the replay-dedup check inside process_tap_webhook.
--
-- The previous body (migration 142) only short-circuits when a prior
-- payment_webhooks row with the same gateway_transaction_id has
-- processed=true. Unprocessed prior rows (e.g. an earlier delivery that
-- errored before commit, or a still-in-flight retry) slip through and
-- the function re-runs the full state machine: another payment_webhooks
-- INSERT, another payments UPDATE if the prior status was non-terminal,
-- and another audit-log row on amount mismatch. With Tap's at-least-once
-- delivery model this opens a small but real "double-process during
-- recovery" window.
--
-- This migration changes the dedup gate to fire on the presence of ANY
-- prior payment_webhooks row keyed by gateway_id — processed or not.
-- The route-level HMAC + IP + replay-age checks already gate authenticity;
-- once the body lands in payment_webhooks we treat that gateway_id as
-- "delivered" and refuse to re-execute side effects.
--
-- Trade-off: a genuine retry of a previously failed processing run will
-- now be a no-op at the DB layer. Operator visibility comes via the
-- existing webhook_errors / Sentry trail, and reconciliation lives in
-- the staff payments dashboard. This matches the security review's
-- spec ("fire regardless of processed flag").
--
-- Signature unchanged from migration 142, so CREATE OR REPLACE is
-- sufficient and ACLs are preserved.
-- ============================================================

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
  v_existing_id        UUID;
  v_stripped           JSONB;
  v_amount_value       JSONB;
  v_amount_currency    TEXT;
  v_reference          TEXT;
  v_payment_row        payments%ROWTYPE;
  v_payment_found      BOOLEAN := false;
  v_amount_normalized  NUMERIC;
BEGIN
  -- ── VULN-101 fix: scale-normalize Tap's BHD amount ────────────────────────
  -- Unchanged from migration 142.
  IF p_amount IS NOT NULL AND p_amount > 500 THEN
    v_amount_normalized := p_amount / 1000.0;
  ELSE
    v_amount_normalized := p_amount;
  END IF;

  -- ── Build the stripped JSON object (unchanged) ────────────────────────────
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

  -- ── T2-10: dedup on ANY prior delivery, not just processed ones ───────────
  -- The route HMAC + IP allowlist + replay-age gates already authenticate
  -- the payload. Once the gateway_id has appeared in payment_webhooks at
  -- all, refuse to re-run side effects.
  IF p_gateway_id IS NOT NULL AND p_gateway_id <> '' THEN
    SELECT id
    INTO v_existing_id
    FROM payment_webhooks
    WHERE payload @> jsonb_build_object('id', p_gateway_id)
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'processed',     true,
        'duplicate',     true,
        'updated_count', 0,
        'webhook_id',    v_existing_id
      );
    END IF;
  END IF;

  INSERT INTO payment_webhooks (provider, event_type, payload, processed)
  VALUES ('tap', p_event_type, p_payload, false)
  RETURNING id INTO v_webhook_id;

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
  IF v_amount_normalized IS NOT NULL AND p_status = 'completed' THEN
    IF ABS(v_amount_normalized - v_payment_row.amount_bhd) > 0.001 THEN
      INSERT INTO audit_logs (
        table_name, action, user_id, record_id, changes, branch_id, actor_role
      ) VALUES (
        'payments',
        'PAYMENT_AMOUNT_MISMATCH',
        NULL,
        v_payment_row.id::text,
        jsonb_build_object(
          'gateway_id',          p_gateway_id,
          'expected_bhd',        v_payment_row.amount_bhd,
          'received_amount_raw', p_amount,
          'received_amount_bhd', v_amount_normalized,
          'order_id',            v_payment_row.order_id,
          'event_type',          p_event_type
        ),
        NULL,
        NULL
      );
      RAISE EXCEPTION 'AMOUNT_MISMATCH' USING ERRCODE = '22023';
    END IF;
  END IF;

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

-- ACL preserved by CREATE OR REPLACE; no re-GRANT needed.

-- ============================================================
-- ROLLBACK:
--   Re-apply migration 142 to restore the processed-flag-gated dedup.
-- ============================================================
