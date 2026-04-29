-- ⚠️  DEVELOPMENT ONLY — do NOT run on production
-- Creates test auth users + staff_basic rows for local dashboard testing.
-- Safe to re-run: ON CONFLICT DO NOTHING on all inserts.

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
