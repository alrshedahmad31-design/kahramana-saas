-- 146_fix_orphaned_auth_users_phone_conflict.sql
--
-- One-time cleanup of orphaned auth.users rows caused by the phone-uniqueness
-- conflict bug documented in migration 145.
--
-- Root cause recap:
--   Migration 145 changed the trigger to ON CONFLICT DO NOTHING (no target),
--   so a phone clash silently skipped the customer_profiles INSERT — leaving the
--   auth.users row committed but no matching customer_profiles row (orphan).
--   The actions.ts fallback UPSERT then hit a 23505 on phone, exited the retry
--   loop (only 23503 was retried), and returned signup_error to the user. On
--   the next attempt the user got email_exists, permanently locking them out.
--
-- Going forward, actions.ts (registerAction) now catches 23505 explicitly and
-- calls admin.auth.admin.deleteUser() to clean up before returning generic
-- success. This migration handles any orphans that accrued before that fix.
--
-- Safety constraints:
--   • Only targets flow = 'customer_register' users (not staff accounts)
--   • Only users created in the last 24 hours (tight window — avoids touching
--     accounts whose profiles were lost for unrelated reasons)
--   • Only users with no matching customer_profiles row
--
-- ROLLBACK: No DDL changes were made; there is nothing to undo.
--           Deleted auth.users rows cannot be recovered automatically —
--           affected users simply re-register (they were previously locked out
--           anyway, so this restores them to the pre-conflict state).

DO $$
DECLARE
  orphan_count INT;
BEGIN
  DELETE FROM auth.users
  WHERE id IN (
    SELECT au.id
    FROM auth.users au
    LEFT JOIN public.customer_profiles cp ON cp.id = au.id
    WHERE cp.id IS NULL
      AND (au.raw_user_meta_data->>'flow') = 'customer_register'
      AND au.created_at > NOW() - INTERVAL '24 hours'
  );
  GET DIAGNOSTICS orphan_count = ROW_COUNT;
  RAISE NOTICE 'C3 cleanup: deleted % orphaned auth.users row(s)', orphan_count;
END $$;
