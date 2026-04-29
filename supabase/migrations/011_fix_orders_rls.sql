-- ============================================================
-- Kahramana Baghdad — Fix orders RLS for authenticated users
-- Migration: 011_fix_orders_rls.sql
-- Applied: 2026-04-28
--
-- Problem: orders_insert_anon only covers the `anon` role.
-- Logged-in customers (role = `authenticated`) had no INSERT
-- policy on orders or order_items, causing RLS violations.
--
-- Fix: add INSERT policies for `authenticated` role on both tables.
-- The server action path (createOrderWithPoints) now uses
-- service_role and bypasses RLS entirely. These policies cover
-- the client-side checkout path for authenticated users.
--
-- SAFE TO RE-RUN: uses DROP ... IF EXISTS before CREATE
-- ============================================================

-- orders: authenticated users can place orders
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
CREATE POLICY "orders_insert_authenticated"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (true);

-- order_items: authenticated users can insert order items
DROP POLICY IF EXISTS "order_items_insert_authenticated" ON order_items;
CREATE POLICY "order_items_insert_authenticated"
  ON order_items FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "orders_insert_authenticated"      ON orders;
-- DROP POLICY IF EXISTS "order_items_insert_authenticated" ON order_items;
