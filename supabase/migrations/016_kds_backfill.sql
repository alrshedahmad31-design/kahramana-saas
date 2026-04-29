-- ============================================================
-- Kahramana Baghdad — KDS Queue Backfill
-- Migration: 016_kds_backfill.sql
-- Applied: 2026-04-29
--
-- Purpose:
--   The auto-enqueue trigger (trg_kds_enqueue) fires on order_items INSERT.
--   Any orders placed before migration 005 was applied to production have
--   no kds_queue rows. This migration backfills them.
--
-- Only inserts rows for active orders (pending/under_review/accepted/preparing).
-- Completed, cancelled, and delivered orders are skipped intentionally.
-- Existing kds_queue rows are not touched (NOT EXISTS guard).
-- ============================================================

INSERT INTO kds_queue (order_id, order_item_id, station, status, priority, created_at)
SELECT
  oi.order_id,
  oi.id,
  COALESCE(mis.station, 'packing'),
  -- Mirror the order status into kds status where meaningful
  CASE
    WHEN o.status = 'preparing' THEN 'preparing'
    ELSE 'pending'
  END,
  0,
  COALESCE(o.created_at, NOW())
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN menu_items_sync mis ON mis.slug = oi.menu_item_slug
WHERE o.status IN ('pending', 'under_review', 'accepted', 'preparing')
  AND NOT EXISTS (
    SELECT 1 FROM kds_queue kq WHERE kq.order_item_id = oi.id
  );

-- Report how many rows were inserted
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM kds_queue
  WHERE created_at >= NOW() - INTERVAL '5 seconds';

  RAISE NOTICE 'KDS backfill complete: % rows inserted', v_count;
END $$;
