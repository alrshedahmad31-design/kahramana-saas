-- Atomic Tap webhook processing + reconciliation errors.

CREATE TABLE IF NOT EXISTS webhook_errors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,
  gateway_id   TEXT,
  order_id     UUID,
  reason       TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_webhook_errors"
  ON webhook_errors FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE OR REPLACE FUNCTION process_tap_webhook(
  p_payload JSONB,
  p_event_type TEXT,
  p_gateway_id TEXT,
  p_status payment_status,
  p_order_reference UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_webhook_id UUID;
  v_updated_count INTEGER := 0;
  v_existing_processed BOOLEAN;
BEGIN
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

  UPDATE payments
  SET status = p_status,
      gateway_transaction_id = p_gateway_id,
      gateway_response = p_payload,
      updated_at = NOW()
  WHERE gateway_transaction_id = p_gateway_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 AND p_order_reference IS NOT NULL THEN
    UPDATE payments
    SET status = p_status,
        gateway_transaction_id = p_gateway_id,
        gateway_response = p_payload,
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
