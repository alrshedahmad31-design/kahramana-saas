-- 039_driver_locations_retention.sql
-- Adds a retention cleanup function + pg_cron job for driver_locations.
-- Removes rows older than 7 days daily at 00:00 UTC (03:00 Bahrain time).

CREATE OR REPLACE FUNCTION cleanup_driver_locations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM driver_locations
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Schedule via pg_cron if the extension is available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'driver-locations-cleanup',
      '0 0 * * *',
      $cron$ SELECT cleanup_driver_locations(); $cron$
    );
  END IF;
END;
$$;

-- ROLLBACK:
--   SELECT cron.unschedule('driver-locations-cleanup');
--   DROP FUNCTION IF EXISTS cleanup_driver_locations();
