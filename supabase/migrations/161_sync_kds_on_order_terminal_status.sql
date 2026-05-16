-- ============================================================
-- Kahramana Baghdad
-- Migration: 161_sync_kds_on_order_terminal_status.sql
-- Date: 2026-05-16
--
-- Root-cause fix for ghost counts on the KDS station selector.
--
-- The KDS selector (src/app/[locale]/dashboard/kds/page.tsx) counts every
-- `order_item_station_status` row whose `status IN ('pending','preparing')`.
-- The inner station board only renders orders whose `orders.status IN
-- ('accepted','preparing','ready')`. When an order transitions to a
-- terminal status (delivered / completed / cancelled), nothing in the DB
-- cascades that to the item-level station-status rows — so they stay in
-- 'pending'/'preparing' forever, inflate the selector chips, and lead
-- staff to "phantom" stations that turn out to be empty when entered.
--
-- bump_station_order propagates items→order (stamps orders.ready_at when
-- all items go 'completed'). The order→items direction was never wired.
--
-- This migration adds the missing edge:
--   When orders.status flips to a terminal value, every non-completed
--   item_station_status row for that order is force-completed.
--
-- Trigger fires AFTER UPDATE OF status, only when the new value is
-- terminal AND was not already terminal (prevents pointless re-runs).
--
-- bumped_at is intentionally NOT touched: a true KDS bump and an
-- order-terminal force-complete are semantically different. Daily
-- station-completion counters (get_station_daily_count) gate on
-- `bumped_at IS NOT NULL`, so leaving bumped_at NULL on auto-completed
-- rows keeps those counters honest (cancelled orders don't show up as
-- kitchen completions for the day).
--
-- SAFE TO RE-RUN: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_kds_on_order_terminal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status IN ('delivered', 'completed', 'cancelled')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'completed', 'cancelled'))
  THEN
    UPDATE public.order_item_station_status
    SET    status     = 'completed',
           updated_at = NOW()
    WHERE  order_id = NEW.id
      AND  status <> 'completed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_kds_on_order_terminal_status ON public.orders;
CREATE TRIGGER trg_sync_kds_on_order_terminal_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_kds_on_order_terminal_status();

-- One-shot backfill: existing orders that already sit in a terminal status
-- but still own pending/preparing/ready item_station_status rows. This is
-- what produces the current 6 / 3 / 1 ghost counts. Without this, the
-- trigger only fixes orders going forward.
UPDATE public.order_item_station_status oiss
SET    status     = 'completed',
       updated_at = NOW()
FROM   public.orders o
WHERE  o.id = oiss.order_id
  AND  o.status IN ('delivered', 'completed', 'cancelled')
  AND  oiss.status <> 'completed';

-- ============================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_sync_kds_on_order_terminal_status ON public.orders;
--   DROP FUNCTION IF EXISTS public.fn_sync_kds_on_order_terminal_status();
--   (Backfilled rows cannot be reversed — they had no legitimate KDS state.)
-- ============================================================
