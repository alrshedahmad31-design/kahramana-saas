-- Payment status split for COD vs online checkout.
-- Delivery remains free and available across all Bahrain.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending_cod';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'awaiting_manual_review';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE payments
  ALTER COLUMN method DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sync_order_status_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.paid_at := COALESCE(NEW.paid_at, NOW());

    UPDATE orders
    SET status     = 'confirmed',
        expires_at = NULL,
        updated_at = NOW()
    WHERE id     = NEW.order_id
      AND status IN ('new', 'under_review', 'pending_payment');
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    UPDATE orders
    SET status     = 'payment_failed',
        updated_at = NOW()
    WHERE id     = NEW.order_id
      AND status IN ('new', 'under_review', 'pending_payment');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_expired_pending_payment_orders()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE payments p
  SET status = 'failed',
      updated_at = NOW()
  FROM orders o
  WHERE p.order_id = o.id
    AND o.status = 'pending_payment'
    AND o.expires_at IS NOT NULL
    AND o.expires_at < NOW()
    AND p.status IN ('pending', 'processing');

  UPDATE orders
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE status = 'pending_payment'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cancel-expired-pending-payment-orders',
      '*/5 * * * *',
      'SELECT cancel_expired_pending_payment_orders();'
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cancel-expired-pending-payment-orders'
    );
  END IF;
END $$;
