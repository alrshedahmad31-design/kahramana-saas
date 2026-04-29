-- ============================================================
-- Kahramana Baghdad — Initial Schema
-- Migration: 001_initial_schema.sql
-- Applied: 2026-04-28
-- ROLLBACK: see bottom of file
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid() on older PG

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE order_status AS ENUM (
  'new',
  'under_review',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'payment_failed'
);

CREATE TYPE staff_role AS ENUM (
  'owner',
  'general_manager',
  'branch_manager',
  'cashier',
  'kitchen',
  'driver',
  'inventory',
  'marketing',
  'support'
);

-- ── Tables ────────────────────────────────────────────────────────────────────

-- branches — runtime copy of src/constants/contact.ts
-- TEXT primary key matches BranchId type ('riffa' | 'muharraq')
CREATE TABLE branches (
  id          TEXT        PRIMARY KEY,
  name_ar     TEXT        NOT NULL,
  name_en     TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  whatsapp    TEXT        NOT NULL,
  wa_link     TEXT        NOT NULL,
  maps_url    TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- customers — guest + future registered users
CREATE TABLE customers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        UNIQUE,
  name       TEXT,
  is_guest   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- orders
CREATE TABLE orders (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name    TEXT,
  customer_phone   TEXT,
  branch_id        TEXT         NOT NULL REFERENCES branches(id),
  status           order_status NOT NULL DEFAULT 'new',
  notes            TEXT,
  total_bhd        NUMERIC(10,3) NOT NULL,
  whatsapp_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- order_items — price snapshot at order creation time
CREATE TABLE order_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_slug    TEXT          NOT NULL,
  name_ar           TEXT          NOT NULL,
  name_en           TEXT          NOT NULL,
  selected_size     TEXT,
  selected_variant  TEXT,
  quantity          INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price_bhd    NUMERIC(10,3) NOT NULL,  -- IMMUTABLE after insert
  item_total_bhd    NUMERIC(10,3) NOT NULL,  -- = unit_price_bhd * quantity
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- menu_items_sync — Sanity/JSON snapshot for price lookups
CREATE TABLE menu_items_sync (
  slug           TEXT          PRIMARY KEY,
  name_ar        TEXT          NOT NULL,
  name_en        TEXT          NOT NULL,
  price_bhd      NUMERIC(10,3),              -- null = has sizes/variants
  sync_source    TEXT          NOT NULL DEFAULT 'menu.json',
  last_synced_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- staff_basic — Phase 1 simple staff profiles
-- id matches Supabase auth.users.id for staff accounts
CREATE TABLE staff_basic (
  id         UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT       NOT NULL,
  role       staff_role NOT NULL,
  branch_id  TEXT       REFERENCES branches(id),   -- null = all branches
  is_active  BOOLEAN    NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_logs — immutable action log
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  user_id     UUID,
  record_id   TEXT,
  changes     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_orders_branch_id    ON orders(branch_id);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_staff_branch        ON staff_basic(branch_id);
CREATE INDEX idx_audit_table         ON audit_logs(table_name);
CREATE INDEX idx_audit_created       ON audit_logs(created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE branches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_basic    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;

-- branches: anyone can read, only authenticated staff can write
CREATE POLICY "branches_select_public"
  ON branches FOR SELECT USING (true);

CREATE POLICY "branches_write_staff"
  ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- menu_items_sync: public read, authenticated write
CREATE POLICY "menu_sync_select_public"
  ON menu_items_sync FOR SELECT USING (true);

CREATE POLICY "menu_sync_write_authenticated"
  ON menu_items_sync FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- orders: anon can INSERT (guest checkout); staff can SELECT + UPDATE
CREATE POLICY "orders_insert_anon"
  ON orders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "orders_select_authenticated"
  ON orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "orders_update_authenticated"
  ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- order_items: anon can INSERT; staff can SELECT
CREATE POLICY "order_items_insert_anon"
  ON order_items FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "order_items_select_authenticated"
  ON order_items FOR SELECT TO authenticated USING (true);

-- customers: own record only (or service_role for server reads)
CREATE POLICY "customers_insert_anon"
  ON customers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "customers_select_own"
  ON customers FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- staff_basic: own record + authenticated read (manager views team in Phase 1D+)
CREATE POLICY "staff_select_authenticated"
  ON staff_basic FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff_write_authenticated"
  ON staff_basic FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- audit_logs: service_role only (server-side writes, no client access)
-- No policies = effectively blocked for anon + authenticated via RLS
-- Server components use service_role key which bypasses RLS

-- ── Seed data — branches ──────────────────────────────────────────────────────

INSERT INTO branches (id, name_ar, name_en, phone, whatsapp, wa_link, maps_url, is_active) VALUES
  (
    'riffa',
    'فرع الرفاع — الحجيات',
    'Riffa Branch — Al-Hijiyat',
    '+97317131413',
    '+97317131413',
    'https://wa.me/97317131413',
    'https://maps.app.goo.gl/J3CMk9AnhSqSBsGQA',
    TRUE
  ),
  (
    'muharraq',
    'فرع المحرق — قلالي',
    'Muharraq Branch — Qallali',
    '+97317131213',
    '+97317131213',
    'https://wa.me/97317131213',
    'https://maps.app.goo.gl/cVsYGpibZxy2rPEV8',
    TRUE
  );

-- ============================================================
-- ROLLBACK (run in reverse order if you need to undo):
--
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS staff_basic CASCADE;
-- DROP TABLE IF EXISTS menu_items_sync CASCADE;
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS branches CASCADE;
-- DROP FUNCTION IF EXISTS set_updated_at;
-- DROP TYPE IF EXISTS staff_role;
-- DROP TYPE IF EXISTS order_status;
-- ============================================================
