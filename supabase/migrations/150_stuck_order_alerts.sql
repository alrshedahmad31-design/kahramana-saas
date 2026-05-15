-- ============================================================
-- Kahramana Baghdad
-- Migration: 150_stuck_order_alerts.sql
--
-- Session 119 / dashboard ops audit follow-up.
--
-- Problem: orders that never reach a terminal status (e.g. driver leaves
-- delivery at 'arrived', kitchen abandons an order in 'accepted', a payment
-- callback never fires) silently linger. The pre-launch audit found two
-- such cases — one at 27h and one at 76h — with no operational signal
-- pointing managers at them. After session 118's H-2 deploy + 119's driver
-- arrived→delivered fix, this is the remaining gap.
--
-- Solution:
--   1. operations_alerts — generic ops-signal table (independent of
--      inventory_alerts, which is FK-tied to ingredient_id and not a fit
--      for non-inventory signals).
--   2. detect_stuck_orders() — scans for orders in non-terminal status
--      older than 24h, inserts one alert per order. Idempotent on a 24-hour
--      window so a stuck order doesn't generate a new alert every cron tick.
--   3. pg_cron schedule — daily 05:00 UTC = 08:00 Bahrain. Wrapped in
--      EXCEPTION so the table + function still land even if pg_cron isn't
--      enabled on this project (managed-Supabase sometimes requires
--      dashboard-side extension enable).
--
-- Schedule activation fallback: if the DO block at the bottom raises a
-- NOTICE about pg_cron unavailability, enable it in Supabase Dashboard
-- → Database → Extensions → pg_cron, then re-run only the
-- cron.schedule() statement against the linked DB.
--
-- ACL: service_role full; authenticated SELECT (branch-scoped via RLS);
-- anon revoked entirely.
-- ============================================================

-- ── 1. operations_alerts table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operations_alerts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type  text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('info','warn','critical')),
  message     text        NOT NULL,
  ref_table   text,
  ref_id      uuid,
  branch_id   text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_alerts_unread
  ON public.operations_alerts (is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_operations_alerts_ref
  ON public.operations_alerts (ref_table, ref_id, alert_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_alerts_branch
  ON public.operations_alerts (branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

-- ── 2. RLS — branch_manager+ read scope, service_role writes ──────────────────

ALTER TABLE public.operations_alerts ENABLE ROW LEVEL SECURITY;

-- Owner/GM see everything; branch_manager + cashier see their branch only.
CREATE POLICY operations_alerts_staff_select ON public.operations_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_basic s
      WHERE s.id = (SELECT auth.uid())
        AND s.is_active = true
        AND (
          s.role IN ('owner','general_manager')
          OR (s.role IN ('branch_manager','cashier') AND s.branch_id = operations_alerts.branch_id)
        )
    )
  );

-- Branch_manager+ may mark alerts read.
CREATE POLICY operations_alerts_staff_update ON public.operations_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_basic s
      WHERE s.id = (SELECT auth.uid())
        AND s.is_active = true
        AND (
          s.role IN ('owner','general_manager')
          OR (s.role = 'branch_manager' AND s.branch_id = operations_alerts.branch_id)
        )
    )
  );

-- Per session 117 hardening: Supabase default-grants DML to anon. Revoke.
REVOKE ALL          ON public.operations_alerts FROM anon;
REVOKE INSERT, DELETE ON public.operations_alerts FROM authenticated;
GRANT  SELECT, UPDATE ON public.operations_alerts TO authenticated;

-- ── 3. detect_stuck_orders() ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.detect_stuck_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.operations_alerts (
    alert_type, severity, message, ref_table, ref_id, branch_id, metadata
  )
  SELECT
    'stuck_order',
    CASE
      WHEN (NOW() - o.created_at) > INTERVAL '48 hours' THEN 'critical'
      ELSE 'warn'
    END,
    format(
      'Order #%s stuck in %s for %sh',
      upper(substring(o.id::text FROM 1 FOR 8)),
      o.status,
      ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600)::text
    ),
    'orders',
    o.id,
    o.branch_id,
    jsonb_build_object(
      'status',      o.status,
      'source',      o.source,
      'total_bhd',   o.total_bhd,
      'created_at',  o.created_at,
      'hours_stuck', ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600)
    )
  FROM public.orders o
  WHERE o.status NOT IN (
          'completed','delivered','cancelled','delivery_failed',
          'payment_failed','returned'
        )
    AND o.created_at < NOW() - INTERVAL '24 hours'
    -- Idempotency: don't re-alert within 24h of a previous alert for the
    -- same order. Lets ops mark-read without the cron immediately re-creating it.
    AND NOT EXISTS (
      SELECT 1 FROM public.operations_alerts a
      WHERE a.ref_table  = 'orders'
        AND a.ref_id     = o.id
        AND a.alert_type = 'stuck_order'
        AND a.created_at > NOW() - INTERVAL '24 hours'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Trigger function should not be callable from the client tier.
REVOKE EXECUTE ON FUNCTION public.detect_stuck_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.detect_stuck_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_stuck_orders() FROM authenticated;

-- ── 4. pg_cron schedule (defensive) ───────────────────────────────────────────
-- 05:00 UTC every day = 08:00 Asia/Bahrain (UTC+3, no DST in Bahrain).

DO $$
BEGIN
  -- Enable pg_cron if it isn't already. On managed Supabase this may require
  -- dashboard-side enablement; if so, swallow the error and surface a notice.
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pg_cron extension could not be enabled by this role. Enable it via Supabase Dashboard → Database → Extensions, then run: SELECT cron.schedule(''stuck-order-scan'', ''0 5 * * *'', $cron$ SELECT public.detect_stuck_orders(); $cron$);';
    RETURN;
  END;

  -- Schedule (or replace) the daily scan.
  BEGIN
    PERFORM cron.unschedule('stuck-order-scan');
  EXCEPTION WHEN OTHERS THEN
    -- No prior schedule — first run.
    NULL;
  END;

  PERFORM cron.schedule(
    'stuck-order-scan',
    '0 5 * * *',
    $cron$ SELECT public.detect_stuck_orders(); $cron$
  );
END
$$;
