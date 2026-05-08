-- ============================================================
-- Kahramana Baghdad — Multi-Station KDS
-- Migration: 072_kds_stations.sql
-- ============================================================

-- 1. Safely update kds_station enum
-- Note: kds_station already exists from migration 005.
-- We add the new values requested for the multi-station system.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'kds_station' AND e.enumlabel = 'shawarma') THEN
        ALTER TYPE kds_station ADD VALUE 'shawarma';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'kds_station' AND e.enumlabel = 'bakery') THEN
        ALTER TYPE kds_station ADD VALUE 'bakery';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'kds_station' AND e.enumlabel = 'appetizer_drinks') THEN
        ALTER TYPE kds_station ADD VALUE 'appetizer_drinks';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'kds_station' AND e.enumlabel = 'main') THEN
        ALTER TYPE kds_station ADD VALUE 'main';
    END IF;
END
$$;

-- 2. Add station to menu_items
-- Note: We add the column first without a default to avoid "unsafe use of new value" error
-- when using a newly added enum value in the same transaction.
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS station kds_station;

-- Update existing to main using a cast to bypass early validation
UPDATE menu_items SET station = 'main'::text::kds_station WHERE station IS NULL;

-- Now set the default for future inserts
ALTER TABLE menu_items ALTER COLUMN station SET DEFAULT 'main'::text::kds_station;

-- 3. Station item status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kds_item_status') THEN
        CREATE TYPE kds_item_status AS ENUM ('pending', 'preparing', 'ready', 'completed');
    END IF;
END
$$;

-- 4. Granular station tracking
CREATE TABLE IF NOT EXISTS order_item_station_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  station kds_station NOT NULL,
  status kds_item_status DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, item_id, station)
);

-- RLS
ALTER TABLE order_item_station_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kds_station_status_select" ON order_item_station_status;
CREATE POLICY "kds_station_status_select" 
ON order_item_station_status FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "kds_station_status_update" ON order_item_station_status;
CREATE POLICY "kds_station_status_update" 
ON order_item_station_status FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 5. Trigger to auto-populate station status
CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station kds_station;
BEGIN
  -- Get station from menu_items
  SELECT station INTO v_station 
  FROM menu_items 
  WHERE id = NEW.menu_item_slug;

  IF v_station IS NOT NULL THEN
    INSERT INTO order_item_station_status (order_id, item_id, station)
    VALUES (NEW.order_id, NEW.id, v_station)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_item_station_status ON order_items;
CREATE TRIGGER trg_order_item_station_status
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION on_order_item_created();

-- 6. RPC for status updates
CREATE OR REPLACE FUNCTION update_order_item_station_status(
  p_order_id UUID,
  p_item_id UUID,
  p_station kds_station,
  p_status kds_item_status
) RETURNS VOID AS $$
BEGIN
  UPDATE order_item_station_status
  SET status = p_status,
      updated_at = now()
  WHERE order_id = p_order_id
    AND item_id = p_item_id
    AND station = p_station;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. View for KDS Station Board (Optional but helpful)
CREATE OR REPLACE VIEW v_kds_station_items AS
SELECT 
    s.id as status_id,
    s.order_id,
    s.item_id,
    s.station,
    s.status as item_station_status,
    o.status as order_status,
    o.branch_id,
    o.order_type,
    o.customer_name,
    o.created_at as order_created_at,
    oi.name_ar,
    oi.name_en,
    oi.quantity,
    oi.selected_size,
    oi.selected_variant,
    oi.notes as item_notes
FROM order_item_station_status s
JOIN orders o ON s.order_id = o.id
JOIN order_items oi ON s.item_id = oi.id
WHERE o.status IN ('accepted', 'preparing', 'ready');
