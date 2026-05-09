-- ============================================================
-- 088_menu_db_first_fix.sql
-- Fix FK on menu_option_groups: was pointing to menu_items_sync(slug),
-- must point to menu_items(id) so dashboard-created items can have modifiers
-- and cascading delete works correctly.
-- SAFE TO RE-RUN.
-- ============================================================

-- Step 1: Remove modifier groups whose slug no longer exists in menu_items.
-- (data-safety before the FK swap — handles any orphaned rows)
DELETE FROM menu_option_groups
WHERE menu_item_slug NOT IN (SELECT id FROM menu_items);

-- Step 2: Drop the old FK (auto-named by Postgres at CREATE TABLE time).
-- We find it dynamically to avoid hard-coding the constraint name.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT c.conname INTO v_constraint
  FROM   pg_constraint c
  JOIN   pg_class      r ON r.oid = c.conrelid
  WHERE  r.relname   = 'menu_option_groups'
    AND  c.contype   = 'f'
    AND  c.conname  LIKE '%menu_item_slug%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE menu_option_groups DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

-- Step 3: Add the correct FK — references menu_items(id) with CASCADE.
ALTER TABLE menu_option_groups
  ADD CONSTRAINT menu_option_groups_menu_item_slug_fkey
  FOREIGN KEY (menu_item_slug)
  REFERENCES menu_items(id)
  ON DELETE CASCADE;
