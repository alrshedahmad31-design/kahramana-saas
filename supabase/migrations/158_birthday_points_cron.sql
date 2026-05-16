-- ============================================================
-- Kahramana Baghdad
-- Migration: 158_birthday_points_cron.sql
--
-- Closes out the birthday gift mechanic started in migration 152 (which
-- only added customer_profiles.birthday). The BirthdayGiftCard UI already
-- ships; this migration adds the actual points credit.
--
-- Three parts:
--   1. loyalty_config.birthday_bonus_points — tunable bonus amount (default
--      50 points). Added as a typed column on the existing normalized
--      loyalty_config table (NOT a key/value insert — the table doesn't
--      have key/value columns).
--   2. birthday_point_credits — idempotency table keyed on
--      (customer_id, year) so re-runs on the same day are safe.
--   3. credit_birthday_points() + pg_cron — daily 05:00 UTC = 08:00
--      Asia/Bahrain (UTC+3, no DST). Matches the 150_stuck_order_alerts
--      cron pattern: defensive CREATE EXTENSION, swallowed-error fallback,
--      unschedule+reschedule for idempotent re-runs.
--
-- Points are credited by inserting a points_transactions row
-- (transaction_type='bonus') and incrementing customer_profiles.points_balance
-- in the same statement. There is no add_loyalty_points RPC — the existing
-- award_loyalty_points_on_completion trigger writes the same table pair, so
-- we follow that pattern directly.
--
-- ACL: service_role only on birthday_point_credits. Customers do NOT need
-- to read this table — the visible signal is the points_transactions
-- 'bonus' row that already shows in their account history.
-- ============================================================

-- ── 1. loyalty_config.birthday_bonus_points ───────────────────────────────────

ALTER TABLE public.loyalty_config
  ADD COLUMN IF NOT EXISTS birthday_bonus_points INT NOT NULL DEFAULT 50
    CHECK (birthday_bonus_points >= 0 AND birthday_bonus_points <= 10000);

-- Existing rows pick up the column default automatically. No backfill needed
-- because the partial unique index on (is_active) keeps a single global row.

-- ── 2. birthday_point_credits (idempotency) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.birthday_point_credits (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID         NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  year            INT          NOT NULL,
  points_credited INT          NOT NULL CHECK (points_credited >= 0),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, year)
);

CREATE INDEX IF NOT EXISTS idx_birthday_point_credits_year
  ON public.birthday_point_credits (year, created_at DESC);

ALTER TABLE public.birthday_point_credits ENABLE ROW LEVEL SECURITY;

-- No client-tier policies. Service role bypasses RLS; everything else is
-- denied. Per session 117 hardening: Supabase default-grants DML to anon
-- and authenticated; revoke explicitly.
REVOKE ALL ON public.birthday_point_credits FROM anon;
REVOKE ALL ON public.birthday_point_credits FROM authenticated;

-- ── 3. credit_birthday_points() ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.credit_birthday_points()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bonus       int;
  v_today_bh    date;
  v_year        int;
  v_inserted    int := 0;
  v_customer_id uuid;
  v_claimed     int;
  v_new_balance int;
BEGIN
  -- Pull the active global bonus amount once per run.
  SELECT birthday_bonus_points
    INTO v_bonus
    FROM public.loyalty_config
   WHERE branch_id IS NULL
     AND is_active  = true
   LIMIT 1;

  IF v_bonus IS NULL OR v_bonus = 0 THEN
    -- No active config row or bonus disabled — nothing to do.
    RETURN 0;
  END IF;

  -- Anchor everything to Bahrain civil date so a 05:00 UTC cron firing on
  -- e.g. 2026-05-16 evaluates "today" against 2026-05-16 in Bahrain (08:00),
  -- not 2026-05-15 in UTC.
  v_today_bh := (NOW() AT TIME ZONE 'Asia/Bahrain')::date;
  v_year     := EXTRACT(year FROM v_today_bh)::int;

  FOR v_customer_id IN
    SELECT cp.id
      FROM public.customer_profiles cp
     WHERE cp.birthday IS NOT NULL
       AND EXTRACT(month FROM cp.birthday) = EXTRACT(month FROM v_today_bh)
       AND EXTRACT(day   FROM cp.birthday) = EXTRACT(day   FROM v_today_bh)
       AND NOT EXISTS (
             SELECT 1
               FROM public.birthday_point_credits bpc
              WHERE bpc.customer_id = cp.id
                AND bpc.year        = v_year
           )
  LOOP
    -- Idempotency claim FIRST. UNIQUE (customer_id, year) means a parallel
    -- run racing this loop will conflict here rather than double-crediting.
    -- ON CONFLICT DO NOTHING + check FOUND, so the claim is the gate.
    INSERT INTO public.birthday_point_credits (customer_id, year, points_credited)
    VALUES (v_customer_id, v_year, v_bonus)
    ON CONFLICT (customer_id, year) DO NOTHING;

    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN
      -- Lost the race to a parallel run. Skip silently.
      CONTINUE;
    END IF;

    -- Credit the points: increment balance + write the transaction row.
    -- Mirrors award_loyalty_points_on_completion (008_loyalty_schema.sql).
    UPDATE public.customer_profiles
       SET points_balance = points_balance + v_bonus
     WHERE id = v_customer_id
    RETURNING points_balance INTO v_new_balance;

    INSERT INTO public.points_transactions (
      customer_id, order_id, points_earned, points_spent,
      balance_after, transaction_type, description
    ) VALUES (
      v_customer_id,
      NULL,
      v_bonus,
      0,
      v_new_balance,
      'bonus',
      'Birthday bonus ' || v_year::text
    );

    -- Audit trail. audit_logs.action CHECK restricts to ('INSERT','UPDATE',
    -- 'DELETE'); the semantic event name lives in changes.event, matching
    -- the pattern used by VULN-011/012 tip + cash-shortfall audits.
    INSERT INTO public.audit_logs (
      table_name, action, user_id, record_id, changes
    ) VALUES (
      'customer_profiles',
      'INSERT',
      NULL,
      v_customer_id::text,
      jsonb_build_object(
        'event',  'birthday_points_credited',
        'year',   v_year,
        'points', v_bonus
      )
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- Client tier MUST NOT call this — it's a cron-only entrypoint and would
-- otherwise let any authenticated user trigger an unbounded scan + write.
REVOKE EXECUTE ON FUNCTION public.credit_birthday_points() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_birthday_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_birthday_points() FROM authenticated;

-- ── 4. pg_cron schedule (defensive — mirrors 150_stuck_order_alerts) ──────────
-- 05:00 UTC every day = 08:00 Asia/Bahrain (UTC+3, no DST in Bahrain).

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pg_cron extension could not be enabled by this role. Enable it via Supabase Dashboard → Database → Extensions, then run: SELECT cron.schedule(''credit-birthday-points'', ''0 5 * * *'', $cron$ SELECT public.credit_birthday_points(); $cron$);';
    RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('credit-birthday-points');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'credit-birthday-points',
    '0 5 * * *',
    $cron$ SELECT public.credit_birthday_points(); $cron$
  );
END
$$;

-- ── Rollback (manual) ────────────────────────────────────────────────────────
--
-- DO $$ BEGIN PERFORM cron.unschedule('credit-birthday-points'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- DROP FUNCTION IF EXISTS public.credit_birthday_points();
-- DROP TABLE    IF EXISTS public.birthday_point_credits;
-- ALTER TABLE   public.loyalty_config DROP COLUMN IF EXISTS birthday_bonus_points;
