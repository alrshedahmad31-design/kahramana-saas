-- ============================================================
-- 087_dine_in_order_type.sql
-- Sprint addendum: Waiter App + QR Ordering both produce dine-in orders.
--
-- The 'dine_in' literal already lived in app code (POS POSClient maps to
-- 'pickup' in DB because the orders.order_type CHECK only allowed
-- ('delivery','pickup')). With table-aware orders we now need a real
-- 'dine_in' value persisted on the row so KDS, analytics and waiter views
-- can filter on it natively.
--
-- SAFE TO RE-RUN.
-- ============================================================

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('delivery', 'pickup', 'dine_in'));
