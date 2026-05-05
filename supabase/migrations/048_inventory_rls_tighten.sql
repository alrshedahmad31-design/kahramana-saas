-- 048_inventory_rls_tighten.sql
-- Restrict USING(true) policies on sensitive inventory/catering tables

-- Ingredients
DROP POLICY IF EXISTS "ingredients_select_authenticated" ON ingredients;
DROP POLICY IF EXISTS "ingredients_all_authenticated" ON ingredients;
CREATE POLICY "ingredients_role_scoped"
  ON ingredients FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN (
      'owner','general_manager','branch_manager',
      'inventory_manager','kitchen'
    )
  );

-- Recipes
DROP POLICY IF EXISTS "recipes_select_authenticated" ON recipes;
DROP POLICY IF EXISTS "recipes_all_authenticated" ON recipes;
CREATE POLICY "recipes_role_scoped"
  ON recipes FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN (
      'owner','general_manager','branch_manager',
      'inventory_manager','kitchen'
    )
  );

-- Suppliers
DROP POLICY IF EXISTS "suppliers_select_authenticated" ON suppliers;
DROP POLICY IF EXISTS "suppliers_all_authenticated" ON suppliers;
CREATE POLICY "suppliers_role_scoped"
  ON suppliers FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN (
      'owner','general_manager','branch_manager','inventory_manager'
    )
  );

-- Catering packages
DROP POLICY IF EXISTS "catering_packages_select_authenticated" ON catering_packages;
DROP POLICY IF EXISTS "catering_packages_all_authenticated" ON catering_packages;
CREATE POLICY "catering_packages_role_scoped"
  ON catering_packages FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN (
      'owner','general_manager','branch_manager','inventory_manager'
    )
    OR (
      auth_user_role()::text = 'branch_manager'
      AND branch_id = auth_user_branch_id()
    )
  );

-- Par levels
DROP POLICY IF EXISTS "par_levels_select_authenticated" ON par_levels;
CREATE POLICY "par_levels_role_scoped"
  ON par_levels FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN (
      'owner','general_manager','branch_manager','inventory_manager'
    )
  );
