-- ============================================================
-- Kahramana Baghdad
-- Migration: 172_birthday_point_credits_notified_at.sql
--
-- T2-6: send-idempotency for the daily birthday notification cron.
--
-- The pg_cron job (migration 158) inserts into birthday_point_credits at
-- 05:00 UTC; the Vercel Cron route /api/cron/birthday-notify fires at 06:00
-- UTC and previously filtered by a 2-hour `created_at` lookback window.
-- That window guarantees uniqueness in the happy path but not under retries
-- — a Vercel Cron retry (e.g. function timeout, transient Resend 5xx) re-
-- scans the same rows and re-sends emails customers already received.
--
-- Adding `notified_at` lets the route mark each row exactly once and skip
-- already-sent rows on retry. Column is nullable: existing rows have no
-- send signal recorded and would otherwise behave as "needs sending" on
-- the next deploy window — but the route also continues to apply the
-- created_at lookback, so the back-population is implicit and bounded.
-- ============================================================

ALTER TABLE public.birthday_point_credits
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Partial index to make the "still-pending notifications" scan cheap. The
-- daily batch is small (one row per birthday-on-today customer), so the
-- index stays tiny in practice. Predicate matches the WHERE clause used
-- in src/app/api/cron/birthday-notify/route.ts.
CREATE INDEX IF NOT EXISTS idx_birthday_point_credits_pending_notify
  ON public.birthday_point_credits (created_at DESC)
  WHERE notified_at IS NULL;

-- ── Rollback (manual) ────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS public.idx_birthday_point_credits_pending_notify;
-- ALTER TABLE public.birthday_point_credits DROP COLUMN IF EXISTS notified_at;
