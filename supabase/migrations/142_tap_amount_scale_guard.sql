-- ============================================================
-- Kahramana Baghdad
-- Migration: 142_tap_amount_scale_guard.sql
--
-- VULN-101 follow-up — Tap BHD amount scale normalization.
--
-- Migration 139 added p_amount verification but assumed Tap echoes BHD in
-- major units (5.000 for 5 BHD). The in-tree evidence is the opposite:
--   - src/lib/payments/tap-client.ts:37 sends amount * 1000 on charge create
--   - the same file comments "amount is the canonical numeric scalar (in fils
--     for BHD)"
--   - tests/unit/tap-client.test.ts uses scalar values 1500, 2500, 5000 for
--     small BHD charges (1.5 / 2.5 / 5 BHD)
--   - production has not seen 1000x overcharges, which it would if Tap
--     interpreted our created-charge amount as major units
-- Conclusion: Tap stores and echoes BHD as fils in our integration. Without
-- normalization, every CAPTURED webhook trips AMOUNT_MISMATCH and blocks
-- legitimate captures.
--
-- This migration adds a scale guard at the top of process_tap_webhook:
--   IF p_amount > 500 THEN p_amount := p_amount / 1000.0; END IF;
--
-- Rationale for the 500 threshold:
--   * Smallest realistic order: ~1 BHD → fils=1000 (>500, divides) or
--     major=1.000 (<=500, untouched). Both resolve to 1.000 BHD.
--   * Largest realistic order: ~500 BHD → fils=500000 (>500, divides to 500)
--     or major=500.000 (<=500, untouched). Both resolve to 500.000 BHD.
--   * Failure mode: a < 0.5 BHD fils-encoded charge (p_amount in (0, 500])
--     would be left as fils and trip the mismatch. Sub-half-BHD restaurant
--     transactions do not occur in practice, but operators should be aware.
--
-- Signature unchanged from migration 139, so CREATE OR REPLACE is sufficient.
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
  v_existing_processed BOOLEAN;
  v_stripped           JSONB;
  v_amount_value       JSONB;
  v_amount_currency    TEXT;
  v_reference          TEXT;
  v_payment_row        payments%ROWTYPE;
  v_payment_found      BOOLEAN := false;
  v_amount_normalized  NUMERIC;
BEGIN
  -- ── VULN-101 fix: scale-normalize Tap's BHD amount ────────────────────────
  -- Tap echoes BHD in fils for our integration (see migration header). Any
  -- value > 500 is presumed fils and divided by 1000 to reach the major
  -- unit used by payments.amount_bhd. Sub-500 values are treated as already
  -- in major units (e.g. a 0.5 BHD test charge → 0.5, kept as-is).
  IF p_amount IS NOT NULL AND p_amount > 500 THEN
    v_amount_normalized := p_amount / 1000.0;
  ELSE
    v_amount_normalized := p_amount;
  END IF;

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
  -- Uses v_amount_normalized (BHD major scale) to compare against
  -- payments.amount_bhd. 0.001 BHD (1 fils) tolerance for FP noise.
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

-- ACL preserved by CREATE OR REPLACE; no re-GRANT needed.

-- ============================================================
-- ROLLBACK:
--   Re-apply migration 139 to restore the pre-normalization body.
-- ============================================================
