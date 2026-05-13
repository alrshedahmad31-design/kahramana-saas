-- ============================================================
-- Kahramana Baghdad — BL-004 P2 RLS hardening
-- Migration: 122_rls_bl004_p2.sql
-- Date: 2026-05-13
--
-- Closes the four remaining low-severity BL-004 findings from the
-- 2026-05-13 audit. Migrations 120 + 121 handled the high-severity
-- and customers anon INSERT; this finishes the bucket.
--
-- Pattern: auth_user_role()::text IN (…) — the ::text cast is the
-- established convention (see 035 line 484 + 046, 120, 121) and
-- side-steps any enum-comparison friction in policy planning.
-- ============================================================

-- ── 1. contact_messages anon INSERT — shape guard ─────────────────────────────
-- Previously WITH CHECK (true). The form schema requires name + message;
-- the table forces email NOT NULL at the column level, so the
-- IS NULL branch in the email predicate never fires — kept for
-- symmetry with the form contract.

DROP POLICY IF EXISTS "contact_messages_insert_anon" ON contact_messages;

CREATE POLICY "contact_messages_insert_anon"
  ON contact_messages FOR INSERT TO anon
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 120
    AND char_length(message) BETWEEN 1 AND 2000
    AND (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$')
  );

-- ── 2. ingredient_allergens SELECT — staff only ──────────────────────────────
-- Reference allergen data. Wider staff set (incl. cashier + waiter)
-- because front-of-house roles may need allergen info when handling
-- customer queries.

DROP POLICY IF EXISTS "allergens_select_authenticated" ON ingredient_allergens;

CREATE POLICY "allergens_select_staff"
  ON ingredient_allergens FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN
      ('owner','general_manager','branch_manager','inventory_manager','kitchen','cashier','waiter')
  );

-- ── 3. restaurant_profile SELECT — admin only ────────────────────────────────
-- Internal config. Narrow scope: owner / GM / branch_manager.

DROP POLICY IF EXISTS "rp_select" ON restaurant_profile;

CREATE POLICY "rp_select_staff"
  ON restaurant_profile FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager')
  );

-- ── 4. unit_conversions SELECT — staff only ──────────────────────────────────
-- Reference data for inventory + kitchen workflows.

DROP POLICY IF EXISTS "unit_conversions_select_authenticated" ON unit_conversions;

CREATE POLICY "unit_conversions_select_staff"
  ON unit_conversions FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN
      ('owner','general_manager','branch_manager','inventory_manager','kitchen')
  );

-- ============================================================
-- ROLLBACK (restores pre-122 wide-open policies):
--
--   DROP POLICY IF EXISTS "contact_messages_insert_anon" ON contact_messages;
--   CREATE POLICY "contact_messages_insert_anon"
--     ON contact_messages FOR INSERT TO anon WITH CHECK (true);
--
--   DROP POLICY IF EXISTS "allergens_select_staff" ON ingredient_allergens;
--   CREATE POLICY "allergens_select_authenticated"
--     ON ingredient_allergens FOR SELECT TO authenticated USING (true);
--
--   DROP POLICY IF EXISTS "rp_select_staff" ON restaurant_profile;
--   CREATE POLICY "rp_select"
--     ON restaurant_profile FOR SELECT TO authenticated USING (true);
--
--   DROP POLICY IF EXISTS "unit_conversions_select_staff" ON unit_conversions;
--   CREATE POLICY "unit_conversions_select_authenticated"
--     ON unit_conversions FOR SELECT TO authenticated USING (true);
-- ============================================================
