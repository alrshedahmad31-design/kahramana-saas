-- 133_strip_tap_payload_to_gateway_response.sql
-- KAH-2026-05-03 (PCI / data retention)
--
-- Reduces `payments.gateway_response` from "entire Tap webhook body" to a
-- whitelisted subset of structured fields. Eliminates the PCI scope-creep
-- risk where Tap-side schema changes could one day push card data into a
-- column visible to all staff via RLS.
--
-- Whitelisted fields persisted into payments.gateway_response (JSONB):
--   id              — Tap charge ID (text)
--   status          — Tap status string (text, e.g. CAPTURED / DECLINED)
--   amount.value    — extracted from `amount.value` if amount is an object,
--                     or from top-level `amount` if Tap sent it as a scalar
--   amount.currency — extracted from `amount.currency` OR top-level `currency`
--   reference       — order reference (text) — preserves `reference.order`
--                     or the raw string if Tap sent reference as a primitive
--   card.brand      — masked card brand (text, e.g. VISA, MASTERCARD)
--   card.last_four  — last-four digits only (text)
--
-- payment_webhooks.payload still receives the full raw payload — that table
-- is staff-only via RLS (migration 050) and is the durable webhook event
-- log for replay/audit. Only the per-payment row gets the stripped subset.
--
-- Verified shape: zod schema in src/app/api/webhooks/tap/route.ts accepts
-- both `amount: number` (current Tap format) and `amount: { value, currency }`
-- (older Tap API responses). This function handles both shapes via the
-- jsonb_typeof check and falls back to the top-level `currency` when the
-- object shape isn't present.

CREATE OR REPLACE FUNCTION process_tap_webhook(
  p_payload         JSONB,
  p_event_type      TEXT,
  p_gateway_id      TEXT,
  p_status          payment_status,
  p_order_reference UUID
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
BEGIN
  -- ── Build the stripped JSON object ────────────────────────────────────────
  -- Amount: object-with-value form takes precedence over scalar form.
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

  -- Reference: object-with-order form or scalar string.
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

  -- ── Dedupe check (unchanged from migration 050) ───────────────────────────
  -- Webhook event log still uses the raw payload for the dedupe lookup so
  -- existing matches keep working.
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

  -- payment_webhooks keeps the full raw payload (staff-only via RLS) so the
  -- webhook event log remains useful for replay/audit. Only the per-payment
  -- gateway_response gets the stripped subset.
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

  -- ── Apply to payments table — write stripped subset to gateway_response ───
  UPDATE payments
  SET status = p_status,
      gateway_transaction_id = p_gateway_id,
      gateway_response = v_stripped,
      updated_at = NOW()
  WHERE gateway_transaction_id = p_gateway_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 AND p_order_reference IS NOT NULL THEN
    UPDATE payments
    SET status = p_status,
        gateway_transaction_id = p_gateway_id,
        gateway_response = v_stripped,
        updated_at = NOW()
    WHERE order_id = p_order_reference
      AND status IN ('pending', 'processing');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  END IF;

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

-- Migration 128 already revoked authenticated EXECUTE and granted service_role.
-- The CREATE OR REPLACE preserves those grants — no re-GRANT needed.
