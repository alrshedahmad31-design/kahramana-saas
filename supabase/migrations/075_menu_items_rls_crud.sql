-- ============================================================
-- Kahramana Baghdad — Menu Items CRUD RLS
-- Migration: 075_menu_items_rls_crud.sql
-- ============================================================

-- Expand RLS to allow full CRUD for authorized staff
-- The previous migration 070 only allowed SELECT and UPDATE.

-- 1. DROP old narrow update policy
DROP POLICY IF EXISTS "staff_update_menu_availability" ON menu_items;

-- 2. CREATE new broad policy for staff
DROP POLICY IF EXISTS "staff_manage_menu_items" ON menu_items;
CREATE POLICY "staff_manage_menu_items" ON menu_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner', 'general_manager', 'branch_manager', 'inventory_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner', 'general_manager', 'branch_manager', 'inventory_manager')
    )
  );

-- 3. Ensure SELECT is still public (already in 070 but safe to keep)
DROP POLICY IF EXISTS "public_read_menu_items" ON menu_items;
CREATE POLICY "public_read_menu_items" ON menu_items
  FOR SELECT TO public
  USING (true);
