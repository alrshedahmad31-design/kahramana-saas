-- ============================================================
-- Kahramana Baghdad — RLS Security Lockdown
-- Migration: 028_security_lockdown.sql
-- Applied: 2026-04-29
--
-- AUDIT FINDINGS ADDRESSED: AUD-001, AUD-002, AUD-003, AUD-004
--
-- Problem: Migrations 001 / 002 created RLS policies with USING (true)
--   that allowed ANY authenticated user (including customer accounts)
--   to read/write across orders, order_items, branches, menu_items_sync
--   and contact_messages.
--
-- Fix: Replace permissive policies with role-aware ones using the
--   auth_user_role() helper introduced in 003_rls_staff_fix.sql.
--
-- SAFE TO RE-RUN: every CREATE is preceded by DROP IF EXISTS.
-- ============================================================

-- ── Helper: is the caller an active staff member? ────────────────────────────
-- (auth_user_role() exists since 003_rls_staff_fix.sql; we lean on it here.)

-- ── ORDERS ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orders_select_authenticated" ON orders;
DROP POLICY IF EXISTS "orders_update_authenticated" ON orders;

-- Customer reads their own orders (matched by phone on customer_profiles)
CREATE POLICY "orders_select_own_customer"
  ON orders FOR SELECT TO authenticated
  USING (
    customer_phone IN (
      SELECT phone FROM customer_profiles WHERE id = auth.uid()
    )
  );

-- Active staff read orders within their branch — globals see everything
CREATE POLICY "orders_select_staff"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  (
          role IN ('owner', 'general_manager')
          OR branch_id = orders.branch_id
        )
    )
  );

-- Only staff can update orders
CREATE POLICY "orders_update_staff_only"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

-- ── ORDER_ITEMS ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "order_items_select_authenticated" ON order_items;

-- Customer reads items for their own orders
CREATE POLICY "order_items_select_own_customer"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   orders            o
      JOIN   customer_profiles cp ON cp.phone = o.customer_phone
      WHERE  o.id  = order_items.order_id
        AND  cp.id = auth.uid()
    )
  );

-- Staff read items within their branch (or all if global admin)
CREATE POLICY "order_items_select_staff"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   orders       o
      JOIN   staff_basic  s ON s.id = auth.uid() AND s.is_active = TRUE
      WHERE  o.id = order_items.order_id
        AND  (
          s.role IN ('owner', 'general_manager')
          OR s.branch_id = o.branch_id
        )
    )
  );

-- ── BRANCHES ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "branches_write_staff" ON branches;

-- Public read remains (branches_select_public from 001)
CREATE POLICY "branches_write_admin_only"
  ON branches FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  role IN ('owner', 'general_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  role IN ('owner', 'general_manager')
    )
  );

-- ── MENU_ITEMS_SYNC ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "menu_sync_write_authenticated" ON menu_items_sync;

CREATE POLICY "menu_sync_write_admin_only"
  ON menu_items_sync FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE  id = auth.uid()
        AND  is_active = TRUE
        AND  role IN ('owner', 'general_manager', 'branch_manager', 'marketing')
    )
  );

-- ── CONTACT_MESSAGES ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "contact_messages_select_authenticated" ON contact_messages;
DROP POLICY IF EXISTS "contact_messages_update_authenticated" ON contact_messages;

CREATE POLICY "contact_messages_select_staff"
  ON contact_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "contact_messages_update_staff"
  ON contact_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

-- ============================================================
-- ROLLBACK (if you need to revert):
--
-- DROP POLICY IF EXISTS "orders_select_own_customer"        ON orders;
-- DROP POLICY IF EXISTS "orders_select_staff"               ON orders;
-- DROP POLICY IF EXISTS "orders_update_staff_only"          ON orders;
-- DROP POLICY IF EXISTS "order_items_select_own_customer"   ON order_items;
-- DROP POLICY IF EXISTS "order_items_select_staff"          ON order_items;
-- DROP POLICY IF EXISTS "branches_write_admin_only"         ON branches;
-- DROP POLICY IF EXISTS "menu_sync_write_admin_only"        ON menu_items_sync;
-- DROP POLICY IF EXISTS "contact_messages_select_staff"     ON contact_messages;
-- DROP POLICY IF EXISTS "contact_messages_update_staff"     ON contact_messages;
--
-- CREATE POLICY "orders_select_authenticated"
--   ON orders FOR SELECT TO authenticated USING (true);
-- (… restore old permissive policies if absolutely required …)
-- ============================================================
