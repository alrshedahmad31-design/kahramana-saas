-- ============================================================
-- Kahramana Baghdad — Menu Items Availability
-- Migration: 070_menu_items_availability.sql
-- ============================================================

-- If menu_items doesn't exist, create it from menu_items_sync or from scratch
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'menu_items') THEN
        CREATE TABLE menu_items (
            id             TEXT          PRIMARY KEY, -- slug
            name_ar        TEXT          NOT NULL,
            name_en        TEXT          NOT NULL,
            price_bhd      NUMERIC(10,3),
            category       TEXT,
            image_url      TEXT,
            is_available   BOOLEAN       NOT NULL DEFAULT true,
            created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        );
        
        -- Seed from menu_items_sync if it exists
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'menu_items_sync') THEN
            INSERT INTO menu_items (id, name_ar, name_en, price_bhd, created_at)
            SELECT slug, name_ar, name_en, price_bhd, last_synced_at
            FROM menu_items_sync;
        END IF;
    ELSE
        -- If it exists, ensure the column is there
        ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;
    END IF;
END;
$$;

COMMENT ON COLUMN menu_items.is_available IS 'false = out of stock, hidden from customer menu';

-- RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_menu_items" ON menu_items;
CREATE POLICY "public_read_menu_items" ON menu_items
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "staff_update_menu_availability" ON menu_items;
CREATE POLICY "staff_update_menu_availability" ON menu_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner','general_manager','branch_manager','inventory_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner','general_manager','branch_manager','inventory_manager')
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON menu_items;
CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
