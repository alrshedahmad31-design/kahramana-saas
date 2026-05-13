-- 130_customer_registration_trigger.sql
-- Eliminate the registration FK race that surfaced in Sentry
-- (`customer_profiles_id_fkey` violated during POST /account/register —
-- 2 events / 1 real user as of 2026-05-13).
--
-- Why a trigger: today registerAction does (a) supabase.auth.signUp, then
-- (b) a service-role INSERT into customer_profiles using the user.id from
-- signUp's response. On the happy path this is fine, but the service-role
-- client lands on a different pgbouncer connection than auth.signUp used —
-- it can see a momentarily-stale view of auth.users where the row hasn't
-- replicated yet, producing FK violation 23503.
--
-- A trigger AFTER INSERT ON auth.users creates the customer_profiles row
-- inside the same transaction as the auth.users INSERT, so the FK target
-- is guaranteed to be visible. No replication race possible.
--
-- Scoping via raw_user_meta_data->>'flow' = 'customer_register' is
-- critical — without it the trigger would also fire for staff users
-- created via authAdmin.createUser, polluting customer_profiles with
-- stray rows for owner / general_manager / cashier / driver. The
-- registerAction passes this flag explicitly; nothing else does.
--
-- customer_profiles.phone is NOT NULL, so the trigger must read phone from
-- raw_user_meta_data; if metadata is incomplete the trigger does nothing
-- and the actions.ts service-role UPSERT fallback handles it (with
-- retry-on-23503 for the original race case).

CREATE OR REPLACE FUNCTION public.handle_customer_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only fire for customer self-registration. Staff users get raw_user_meta_data
  -- from createStaffFull (which sets {name, role}) and never include 'flow'.
  IF NEW.raw_user_meta_data->>'flow' <> 'customer_register' THEN
    RETURN NEW;
  END IF;

  -- phone is NOT NULL on customer_profiles. If metadata is incomplete,
  -- skip the insert and let the actions.ts fallback handle it (with the
  -- correct phone and retry-on-23503). Throwing here would break signUp.
  IF NEW.raw_user_meta_data->>'phone' IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO customer_profiles (id, phone, name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_customer_registration() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_customer_registration() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_customer_registration() FROM authenticated;
-- Only the auth.users trigger context invokes this; postgres owner has
-- implicit access regardless of grants.

DROP TRIGGER IF EXISTS on_customer_registered ON auth.users;
CREATE TRIGGER on_customer_registered
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_registration();

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS on_customer_registered ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_customer_registration();
-- (Re-introduces the FK race; the actions.ts retry path will partially
-- mitigate but won't eliminate it.)
