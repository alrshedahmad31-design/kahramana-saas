-- ============================================================
-- Kahramana Baghdad — Production Admin User
-- Migration: 015_production_admin.sql
-- Applied to production: 2026-04-28
--
-- WHY THIS FILE EXISTS IN THE REPO
-- ──────────────────────────────────────────────────────────────
-- This migration was previously gitignored because it originally
-- contained a hardcoded admin password. Fresh clones missed it
-- and hit a migration-numbering gap (014 → 016).
--
-- The hardcoded credential has been replaced with a placeholder
-- and the file is now tracked. Production already has the admin
-- user (see ROLLBACK below), so the branch that INSERTs into
-- auth.users is unreachable in prod and the placeholder is never
-- consumed there. A fresh DB applying this migration from scratch
-- will hit the placeholder, RAISE, and refuse to commit — the
-- operator must supply a real password via the `app.admin_password`
-- runtime setting before running this migration:
--
--   SET LOCAL app.admin_password = '<real-password>';
--   \i supabase/migrations/015_production_admin.sql
--
-- ROLLBACK:
--   DELETE FROM staff_basic
--     WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@kahramanat.com');
--   DELETE FROM auth.identities
--     WHERE provider_id = 'admin@kahramanat.com';
--   DELETE FROM auth.users
--     WHERE email = 'admin@kahramanat.com';
-- ============================================================

DO $$
DECLARE
  v_user_id  uuid;
  v_password text;
BEGIN
  -- Read the operator-supplied password (NULL/empty if unset).
  v_password := current_setting('app.admin_password', true);

  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin@kahramanat.com';

  IF v_user_id IS NULL THEN
    -- Fresh DB path: must have a real password. Refuse to insert
    -- an account whose password is a known placeholder.
    IF v_password IS NULL OR length(v_password) < 12 THEN
      RAISE EXCEPTION
        'Migration 015 requires `app.admin_password` to be set to a strong (>=12 char) password before applying on a fresh database.'
        USING HINT = 'Run: SET LOCAL app.admin_password = ''<real-password>''; before \i this file.';
    END IF;

    -- Create auth user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      is_super_admin
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'admin@kahramanat.com',
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now(),
      false
    ) RETURNING id INTO v_user_id;

    -- Create identity record (required for email login)
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'admin@kahramanat.com',
      format('{"sub":"%s","email":"%s"}', v_user_id, 'admin@kahramanat.com')::jsonb,
      'email',
      now(),
      now(),
      now()
    );

    -- Create staff profile (owner, all branches)
    INSERT INTO staff_basic (
      id,
      name,
      role,
      branch_id,
      is_active
    ) VALUES (
      v_user_id,
      'Ahmed Algburi',
      'owner',
      NULL,
      true
    );

    RAISE NOTICE 'Admin user created: % (id: %)', 'admin@kahramanat.com', v_user_id;
  ELSE
    -- Idempotent re-run path (production already has this user).
    -- No password is needed because we don't touch auth.users here.
    INSERT INTO staff_basic (id, name, role, branch_id, is_active)
    VALUES (v_user_id, 'Ahmed Algburi', 'owner', NULL, true)
    ON CONFLICT (id) DO UPDATE
      SET role = 'owner', is_active = true;

    RAISE NOTICE 'Admin user already exists, staff profile upserted: %', v_user_id;
  END IF;
END $$;
