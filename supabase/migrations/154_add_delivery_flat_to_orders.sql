-- ============================================================
-- Kahramana Baghdad
-- Migration: 154_add_delivery_flat_to_orders.sql
--
-- Adds a nullable TEXT column `delivery_flat` to the `orders` table to
-- complete the structured delivery address shape (block / road / building
-- / flat) introduced in migration 025. Until now the customer-facing
-- CheckoutForm captured `flat` in local state but folded it into the
-- free-text `delivery_address` line only — the operator-facing surfaces
-- (KDS, driver app, WhatsApp restaurant notification) had no structured
-- access to it. The customer_profiles table already has `default_flat`
-- (migration 147); this brings the per-order shape into parity.
--
-- The column is nullable since not every address has a flat (villas,
-- ground-floor units, etc.), and pickup orders never carry it.
--
-- ROLLBACK:
--   ALTER TABLE orders DROP COLUMN IF EXISTS delivery_flat;
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_flat TEXT;
