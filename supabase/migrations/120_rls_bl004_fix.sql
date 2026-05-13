-- ============================================================
-- Kahramana Baghdad — BL-004 high-severity RLS fix
-- Migration: 120_rls_bl004_fix.sql
-- Date: 2026-05-13
--
-- BL-004 audit (session 93, 2026-05-13) found 14 policies on public.*
-- with USING (true) or WITH CHECK (true) reachable from anon or
-- authenticated roles. This migration closes the 8 high-severity ones.
--
-- Skipped (low risk, audited separately):
--   - ingredient_allergens select (public-ish data)
--   - restaurant_profile select (internal config)
--   - unit_conversions select (reference data)
--   - contact_messages insert anon (rate-limited spam vector)
--   - customers insert anon (required for guest-checkout flow)
--   - system_settings public read (pending content audit)
--
-- Pattern reused from 046_security_hardening.sql:
--   auth_user_role()::text IN (...)
-- The ::text cast avoids SQLSTATE 55P04 (see comment in 035 line 484).
--
-- Service-role contexts (rpc_create_order, /api/* with service client,
-- Realtime publisher) bypass RLS entirely, so closing the anon /
-- authenticated INSERT policies on orders + order_items does NOT
-- affect the legitimate checkout or POS paths.
-- ============================================================

-- ── FIX 1: orders INSERT — service_role only ─────────────────────────────────
-- Both anon + authenticated INSERT policies bypass rpc_create_order
-- price validation (PRICE_MISMATCH, totals, status forcing). Direct
-- PostgREST insert lets a caller forge any subtotal / status / branch.

DROP POLICY IF EXISTS "orders_insert_anon" ON orders;
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;

CREATE POLICY "orders_insert_service_role"
  ON orders FOR INSERT TO service_role
  WITH CHECK (true);

-- ── FIX 2: order_items INSERT — service_role only ────────────────────────────
-- Same exposure as orders: anon could insert lines with arbitrary
-- unit_price_bhd, breaking the price-snapshot rule.

DROP POLICY IF EXISTS "order_items_insert_anon" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_authenticated" ON order_items;

CREATE POLICY "order_items_insert_service_role"
  ON order_items FOR INSERT TO service_role
  WITH CHECK (true);

-- ── FIX 3: inventory_lots INSERT — staff only ────────────────────────────────
-- Any authenticated user could inject lots, polluting cost basis and
-- expiry tracking. Restrict to managers + inventory_manager.

DROP POLICY IF EXISTS "lots_insert_authenticated" ON inventory_lots;

CREATE POLICY "lots_insert_staff"
  ON inventory_lots FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager')
  );

-- ── FIX 4: supplier_price_history — staff-only SELECT + INSERT ───────────────
-- Wholesale pricing is commercially sensitive. Open SELECT to any
-- authenticated user leaks supplier costs. Open INSERT lets any user
-- poison the price history feeding COGS reports.

DROP POLICY IF EXISTS "sph_select_authenticated" ON supplier_price_history;
DROP POLICY IF EXISTS "sph_insert_authenticated" ON supplier_price_history;

CREATE POLICY "sph_select_staff"
  ON supplier_price_history FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager')
  );

CREATE POLICY "sph_insert_staff"
  ON supplier_price_history FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager')
  );

-- ── FIX 5: prep_items + prep_item_ingredients SELECT — staff only ────────────
-- Recipe BOMs and prep components are proprietary. Kitchen needs read
-- access for prep work; everyone else stays out.

DROP POLICY IF EXISTS "prep_items_select_authenticated" ON prep_items;
DROP POLICY IF EXISTS "prep_item_ingredients_select_authenticated" ON prep_item_ingredients;

CREATE POLICY "prep_items_select_staff"
  ON prep_items FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager','kitchen')
  );

CREATE POLICY "prep_item_ingredients_select_staff"
  ON prep_item_ingredients FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager','kitchen')
  );

-- ============================================================
-- ROLLBACK (restores pre-120 wide-open policies):
--
--   DROP POLICY IF EXISTS "orders_insert_service_role" ON orders;
--   CREATE POLICY "orders_insert_anon" ON orders
--     FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "orders_insert_authenticated" ON orders
--     FOR INSERT TO authenticated WITH CHECK (true);
--
--   DROP POLICY IF EXISTS "order_items_insert_service_role" ON order_items;
--   CREATE POLICY "order_items_insert_anon" ON order_items
--     FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "order_items_insert_authenticated" ON order_items
--     FOR INSERT TO authenticated WITH CHECK (true);
--
--   DROP POLICY IF EXISTS "lots_insert_staff" ON inventory_lots;
--   CREATE POLICY "lots_insert_authenticated" ON inventory_lots
--     FOR INSERT TO authenticated WITH CHECK (true);
--
--   DROP POLICY IF EXISTS "sph_select_staff" ON supplier_price_history;
--   DROP POLICY IF EXISTS "sph_insert_staff" ON supplier_price_history;
--   CREATE POLICY "sph_select_authenticated" ON supplier_price_history
--     FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "sph_insert_authenticated" ON supplier_price_history
--     FOR INSERT TO authenticated WITH CHECK (true);
--
--   DROP POLICY IF EXISTS "prep_items_select_staff" ON prep_items;
--   DROP POLICY IF EXISTS "prep_item_ingredients_select_staff" ON prep_item_ingredients;
--   CREATE POLICY "prep_items_select_authenticated" ON prep_items
--     FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "prep_item_ingredients_select_authenticated"
--     ON prep_item_ingredients FOR SELECT TO authenticated USING (true);
-- ============================================================
