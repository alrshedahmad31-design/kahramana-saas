-- VULN-013: prevent a driver from being assigned to two concurrent active
-- deliveries. The driver-bump action and the manager assignment paths both
-- check JS-side that the driver is "free", but those reads + writes are not
-- transactional and can race on the dispatcher dashboard. Enforce the
-- invariant at the storage layer with a partial unique index.
--
-- Indexed columns: assigned_driver_id only.
-- WHERE clause: status IN ('out_for_delivery', 'arrived') AND
--               assigned_driver_id IS NOT NULL.
--
-- Rows in any other status (ready, delivered, cancelled, …) or with a NULL
-- driver assignment are excluded from the uniqueness predicate, so the index
-- stays small and only fires when it should.

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_active_delivery_per_driver
  ON public.orders (assigned_driver_id)
  WHERE status IN ('out_for_delivery', 'arrived')
    AND assigned_driver_id IS NOT NULL;
