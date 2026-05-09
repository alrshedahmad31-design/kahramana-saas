-- ============================================================
-- 082_menu_modifiers.sql
-- Menu option groups + options + per-line modifier snapshot on order_items.
-- Public read (customer-facing menu and POS need it). Owner / GM write only.
-- ============================================================

-- Option groups: e.g. "حجم البيتزا", "نوع العجين", "إضافات"
CREATE TABLE IF NOT EXISTS menu_option_groups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_slug  TEXT        NOT NULL REFERENCES menu_items_sync(slug) ON DELETE CASCADE,
  name_ar         TEXT        NOT NULL,
  name_en         TEXT        NOT NULL,
  required        BOOLEAN     NOT NULL DEFAULT false,
  multi_select    BOOLEAN     NOT NULL DEFAULT false,
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mog_slug ON menu_option_groups(menu_item_slug);

ALTER TABLE menu_option_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_option_groups public read" ON menu_option_groups;
CREATE POLICY "menu_option_groups public read"
  ON menu_option_groups
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "menu_option_groups owner write" ON menu_option_groups;
CREATE POLICY "menu_option_groups owner write"
  ON menu_option_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  );

-- Options within a group: e.g. "صغير +0", "وسط +1.0 BHD", "إضافة جبن +0.5"
CREATE TABLE IF NOT EXISTS menu_options (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID          NOT NULL REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  name_ar         TEXT          NOT NULL,
  name_en         TEXT          NOT NULL,
  price_modifier  NUMERIC(10,3) NOT NULL DEFAULT 0,
  is_available    BOOLEAN       NOT NULL DEFAULT true,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mo_group ON menu_options(group_id);

ALTER TABLE menu_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_options public read" ON menu_options;
CREATE POLICY "menu_options public read"
  ON menu_options
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "menu_options owner write" ON menu_options;
CREATE POLICY "menu_options owner write"
  ON menu_options
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager')
    )
  );

-- order_items.modifiers — JSONB snapshot of selected options at order time.
-- One element per selected option. Shape:
--   [{ group_id, group_name_ar, group_name_en, option_id,
--      option_name_ar, option_name_en, price_modifier }]
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS modifiers JSONB NOT NULL DEFAULT '[]'::jsonb;
