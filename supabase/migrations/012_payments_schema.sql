-- ============================================================
-- Kahramana Baghdad — Payment Infrastructure
-- Migration: 012_payments_schema.sql
-- Phase 6: Sprint 6A — Payment Infrastructure
-- Applied: 2026-04-28
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE payment_method AS ENUM (
  'cash',
  'benefit_qr',
  'tap_card',
  'tap_knet'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded'
);

-- ── Payments ──────────────────────────────────────────────────────────────────

CREATE TABLE payments (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid           NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  amount_bhd             numeric(10,2)  NOT NULL CHECK (amount_bhd > 0),
  method                 payment_method NOT NULL,
  status                 payment_status NOT NULL DEFAULT 'pending',
  gateway_transaction_id text,
  gateway_response       jsonb,
  paid_at                timestamptz,
  refunded_at            timestamptz,
  refund_amount_bhd      numeric(10,2)  CHECK (refund_amount_bhd > 0),
  refund_reason          text,
  created_at             timestamptz    NOT NULL DEFAULT now(),
  updated_at             timestamptz    NOT NULL DEFAULT now()
);

-- ── Payment Webhooks ──────────────────────────────────────────────────────────

CREATE TABLE payment_webhooks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text        NOT NULL,
  event_type   text,
  payload      jsonb       NOT NULL,
  processed    boolean     NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_payments_order_id   ON payments(order_id);
CREATE INDEX idx_payments_status     ON payments(status);
CREATE INDEX idx_payments_gateway_tx
  ON payments(gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

CREATE INDEX idx_payment_webhooks_unprocessed
  ON payment_webhooks(created_at)
  WHERE processed = false;

-- ── Updated-at trigger ────────────────────────────────────────────────────────
-- set_updated_at() was created in 001_initial_schema.sql

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Order status sync on payment completion / failure ────────────────────────

CREATE OR REPLACE FUNCTION sync_order_status_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Stamp paid_at and advance order to 'accepted' on first completion
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.paid_at := COALESCE(NEW.paid_at, NOW());

    UPDATE orders
    SET status     = 'accepted',
        updated_at = NOW()
    WHERE id     = NEW.order_id
      AND status IN ('new', 'under_review');
  END IF;

  -- Mark order payment_failed when payment fails
  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    UPDATE orders
    SET status     = 'payment_failed',
        updated_at = NOW()
    WHERE id     = NEW.order_id
      AND status IN ('new', 'under_review');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_sync_order_status
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION sync_order_status_on_payment();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Staff: read all payments
CREATE POLICY "staff_select_payments"
  ON payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Customers: read own payments (joined via phone on orders → customer_profiles)
CREATE POLICY "customers_select_own_payments"
  ON payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   orders           o
      JOIN   customer_profiles cp ON cp.phone = o.customer_phone
      WHERE  o.id  = payments.order_id
        AND  cp.id = auth.uid()
    )
  );

-- Webhooks: staff only (service_role bypasses RLS for webhook handler)
CREATE POLICY "staff_manage_webhooks"
  ON payment_webhooks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- ============================================================
-- ROLLBACK (run in reverse order if you need to undo):
--
-- DROP TRIGGER  IF EXISTS payments_sync_order_status ON payments;
-- DROP TRIGGER  IF EXISTS payments_updated_at         ON payments;
-- DROP FUNCTION IF EXISTS sync_order_status_on_payment;
-- DROP TABLE    IF EXISTS payment_webhooks CASCADE;
-- DROP TABLE    IF EXISTS payments CASCADE;
-- DROP TYPE     IF EXISTS payment_status;
-- DROP TYPE     IF EXISTS payment_method;
-- ============================================================
