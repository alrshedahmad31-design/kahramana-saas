-- 145_fix_customer_registration_phone_conflict.sql
--
-- Bug: handle_customer_registration() uses ON CONFLICT (id) DO NOTHING which
-- only suppresses duplicate-id violations. When a new user registers with a
-- phone number that is already stored in customer_profiles (e.g., two
-- accounts sharing a number), the trigger throws a unique_violation (23505)
-- on the phone column, which rolls back the entire auth.users INSERT and
-- Supabase returns HTTP 500 "Database error saving new user".
--
-- Fix: change to ON CONFLICT DO NOTHING (no target) which suppresses any
-- uniqueness violation — both id and phone — allowing the auth user to be
-- created successfully. The actions.ts service-role UPSERT fallback that
-- runs after signUp will also hit the same conflict and silently skip,
-- leaving the existing customer_profiles row intact.
--
-- Why this is safe: a new auth user whose phone is already taken still gets
-- an account. Their profile row is missing initially (existing profile
-- belongs to the original phone owner). This is a data-quality issue but not
-- a security issue — the user can still log in and the operator can reconcile
-- duplicate phone numbers via the dashboard.

CREATE OR REPLACE FUNCTION public.handle_customer_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'flow' <> 'customer_register' THEN
    RETURN NEW;
  END IF;

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
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
