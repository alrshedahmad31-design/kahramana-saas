-- ============================================================
-- Kahramana Baghdad — Production Seed
-- Migration: 010_production_seed.sql
-- Applied: 2026-04-28
--
-- PURPOSE: Seed production-ready reference data.
--   - Real branch records (matches src/constants/contact.ts)
--   - ONE bootstrap owner account (change password after first login)
--   - KDS uses station enum (005_kds_schema.sql) — no table to seed
--
-- SAFE TO RE-RUN: all inserts use ON CONFLICT DO NOTHING
-- ============================================================

-- ── Branches ──────────────────────────────────────────────────────────────────
-- Must match BranchId type: 'riffa' | 'qallali' | 'badi'
-- Source of truth: src/constants/contact.ts (last verified 2026-04-27)

INSERT INTO branches (id, name_ar, name_en, phone, whatsapp, wa_link, maps_url, is_active)
VALUES
  (
    'riffa',
    'فرع الرفاع',
    'Riffa Branch',
    '+97317131413',
    '+97317131413',
    'https://wa.me/97317131413',
    'https://maps.app.goo.gl/J3CMk9AnhSqSBsGQA',
    true
  ),
  (
    'qallali',
    'فرع قلالي',
    'Qallali Branch',
    '+97317131213',
    '+97317131213',
    'https://wa.me/97317131213',
    'https://maps.app.goo.gl/cVsYGpibZxy2rPEV8',
    true
  ),
  (
    'badi',
    'فرع البديع',
    'Al-Badi'' Branch',
    '',
    '',
    '',
    NULL,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- ── Bootstrap owner account ───────────────────────────────────────────────────
-- Creates ONE admin user so the dashboard is accessible on day 1.
-- ⚠️  CHANGE THE PASSWORD immediately after first login.
-- Highest role in staff_role enum is 'owner' (super_admin does not exist).
-- auth.identities row is required for email/password sign-in to work.

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email   text := 'admin@kahramanat.com';
BEGIN
  -- Skip if this email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Admin user already exists — skipping.';
    RETURN;
  END IF;

  -- Auth user
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
  ) VALUES (
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(gen_random_uuid()::text, gen_salt('bf')),  -- random; use Supabase Dashboard to set real password
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    now(),
    now()
  );

  -- Identity row — required for email/password sign-in
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
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_email,
    v_email,
    now(),
    now(),
    now()
  );

  -- Staff profile — 'owner' is the highest role in the staff_role enum
  INSERT INTO staff_basic (id, name, role, branch_id, is_active)
  VALUES (v_user_id, 'System Admin', 'owner', 'riffa', true);

  RAISE NOTICE 'Admin user created: % (id: %)', v_email, v_user_id;
END;
$$;

-- ── Post-migration checklist ───────────────────────────────────────────────────
-- 1. Go to Supabase Dashboard → Authentication → Users → admin@kahramanat.com
-- 2. Click "Send password reset" or set a password directly — the seed uses a
--      random unguessable password, so no login is possible until this is done.
-- 3. Update the name 'System Admin' to the real owner name:
--      UPDATE staff_basic SET name = 'Real Name' WHERE role = 'owner';
-- 4. Create remaining staff via Dashboard → Authentication → Users → Add user
--      then: INSERT INTO staff_basic (id, name, role, branch_id, is_active)
--            VALUES ('PASTE_UUID', 'Name', 'branch_manager', 'riffa', true);
--
-- Verify branches:
--   SELECT id, name_en, is_active FROM branches ORDER BY id;
--   → 3 rows: badi (false), qallali (true), riffa (true)
--
-- Verify admin:
--   SELECT sb.name, sb.role, au.email
--   FROM staff_basic sb JOIN auth.users au ON au.id = sb.id
--   WHERE sb.role = 'owner';
