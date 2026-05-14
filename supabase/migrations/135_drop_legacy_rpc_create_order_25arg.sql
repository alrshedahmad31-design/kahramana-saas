-- ============================================================
-- Kahramana Baghdad
-- Migration: 135_drop_legacy_rpc_create_order_25arg.sql
--
-- VULN-104 follow-up: migration 134 inverted the payment_method
-- CASE on the 28-arg signature of rpc_create_order, but the legacy
-- 25-arg overload (lacking p_table_number / p_promotion_id /
-- p_promotion_discount_bhd) was still resident on the DB with the
-- original source-first CASE — a live source='manual' +
-- payment_method='tap' bypass.
--
-- Reachability check (codebase grep, 2026-05-14): every TS caller
--   - src/app/[locale]/waiter/actions.ts
--   - src/app/[locale]/table/actions.ts
--   - src/app/[locale]/checkout/actions.ts
--   - src/app/[locale]/dashboard/pos/actions.ts
--   - src/app/[locale]/dashboard/pos/service/actions.ts
-- passes at least one of {p_table_number, p_promotion_id,
-- p_promotion_discount_bhd}. PostgreSQL named-arg resolution maps
-- every current invocation to the 28-arg overload — the 25-arg
-- overload is unreachable from app code.
--
-- Action: DROP the legacy overload so no future ad-hoc SQL or rogue
-- caller can land on the buggy CASE. The 28-arg signature (patched
-- in migration 134) is unaffected.
--
-- ROLLBACK:
--   Re-create the legacy overload from the prior body. Not
--   recommended — restoring it re-opens VULN-104 on the legacy path.
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_create_order(
  text,                       -- p_idempotency_key
  text,                       -- p_customer_name
  text,                       -- p_customer_phone
  text,                       -- p_branch_id
  text,                       -- p_order_type
  jsonb,                      -- p_items
  numeric,                    -- p_total_bhd
  text,                       -- p_notes
  text,                       -- p_customer_notes
  text,                       -- p_delivery_address
  text,                       -- p_delivery_city
  text,                       -- p_delivery_building
  text,                       -- p_delivery_street
  text,                       -- p_delivery_area
  numeric,                    -- p_delivery_lat
  numeric,                    -- p_delivery_lng
  text,                       -- p_source
  uuid,                       -- p_coupon_id
  numeric,                    -- p_coupon_discount_bhd
  integer,                    -- p_points_to_redeem
  text,                       -- p_payment_method
  text,                       -- p_status
  numeric,                    -- p_loyalty_discount_bhd
  timestamp with time zone,   -- p_expires_at
  uuid                        -- p_customer_id
);
