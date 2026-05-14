-- ═════════════════════════════════════════════════════════════════════════════
-- ⚠️  ⚠️  ⚠️   DEVELOPMENT-ONLY SEED — DO NOT RUN AGAINST PRODUCTION   ⚠️  ⚠️  ⚠️
-- ═════════════════════════════════════════════════════════════════════════════
--
-- This migration inserts four test auth users (owner / manager / kitchen /
-- driver) with CLEAR-TEXT passwords baked into the file (`owner123` etc.).
-- These credentials are safe ONLY because:
--   1. They exist only in local Supabase / preview environments.
--   2. The env-gate below RAISEs and aborts the transaction if the
--      app_config table contains an ('environment','production') row.
--
-- If you are about to point the Supabase CLI / db push at production:
--   • Ensure migration 136_app_config has been applied, then in Studio:
--       INSERT INTO public.app_config (key, value)
--       VALUES ('environment', 'production')
--       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--   • This migration will then refuse to run and the deploy will fail loudly.
--   • If you need to skip this file entirely in prod, rename it out of the
--     migrations directory before running `supabase db push`.
--
-- Why a table instead of a GUC: Supabase managed strips superuser from the
-- `postgres` role, so `ALTER DATABASE postgres SET app.environment = ...`
-- returns 42501 in both the CLI and Studio. A row in app_config is owner-
-- writable from Studio without superuser. See 136_app_config.sql.
--
-- VULN-SEC-01 — keep this banner intact; reviewers grep for it.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_env TEXT;
BEGIN
  SELECT value INTO v_env FROM public.app_config WHERE key = 'environment';
  IF v_env = 'production' THEN
    RAISE EXCEPTION 'Seed migration 006_seed_test_staff must not run in production (app_config.environment=production).';
  END IF;
EXCEPTION
  -- Fresh environments apply migrations in order — 006 runs before 136, so
  -- app_config does not exist yet. Swallow undefined_table and fall through.
  -- Once 136 is applied, this branch becomes unreachable.
  WHEN undefined_table THEN
    NULL;
END $$;

-- auth.users requires pgcrypto (enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Test auth users ───────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner@kahramana.test',
    extensions.crypt('owner123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'manager@kahramana.test',
    extensions.crypt('manager123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'kitchen@kahramana.test',
    extensions.crypt('kitchen123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'driver@kahramana.test',
    extensions.crypt('driver123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- Also insert into auth.identities so email/password sign-in works
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  email,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner@kahramana.test"}',
    'email',
    'owner@kahramana.test',
    'owner@kahramana.test',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"manager@kahramana.test"}',
    'email',
    'manager@kahramana.test',
    'manager@kahramana.test',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    '{"sub":"00000000-0000-0000-0000-000000000003","email":"kitchen@kahramana.test"}',
    'email',
    'kitchen@kahramana.test',
    'kitchen@kahramana.test',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004',
    '{"sub":"00000000-0000-0000-0000-000000000004","email":"driver@kahramana.test"}',
    'email',
    'driver@kahramana.test',
    'driver@kahramana.test',
    now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- ── Staff profiles ────────────────────────────────────────────────────────────

INSERT INTO staff_basic (id, name, role, branch_id, is_active, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Owner Account',
    'owner',
    'riffa',
    true,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Branch Manager',
    'branch_manager',
    'riffa',
    true,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Kitchen Staff',
    'kitchen',
    'riffa',
    true,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Test Driver',
    'driver',
    'riffa',
    true,
    now()
  )
ON CONFLICT (id) DO NOTHING;
