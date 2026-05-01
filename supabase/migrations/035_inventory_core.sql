-- ============================================================
-- Kahramana Baghdad — Inventory Core Schema
-- Migration: 035_inventory_core.sql
-- Note: 029 slot taken by driver_cash_handover; 035 is next after 034
-- Date: 2026-05-01
-- Safe to re-run: all DDL uses IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

-- ── 1. ENUMs ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
    CREATE TYPE inventory_movement_type AS ENUM (
      'reservation', 'consumption', 'release',
      'purchase', 'count_adjust', 'waste',
      'transfer_in', 'transfer_out',
      'prep_production', 'prep_consumption',
      'catering_reserve', 'catering_release',
      'opening_balance', 'adjustment'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'abc_class') THEN
    CREATE TYPE abc_class AS ENUM ('A', 'B', 'C');
  END IF;
END;
$$;

-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar          TEXT        NOT NULL,
  name_en          TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  lead_time_days   INTEGER     DEFAULT 1,
  payment_terms    TEXT        CHECK (payment_terms IN ('cash','net7','net14','net30','net60')),
  min_order_bhd    NUMERIC(10,3),
  reliability_pct  NUMERIC(5,2) DEFAULT 100,
  is_active        BOOLEAN     DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- inventory_alerts (ingredient_id FK added after ingredients table)
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     TEXT        REFERENCES branches(id),
  ingredient_id UUID,
  alert_type    TEXT        NOT NULL CHECK (alert_type IN (
    'low_stock','out_of_stock','high_waste','variance_warning','variance_critical',
    'unmapped_item','expiring_soon','expired','theft_suspected','po_overdue',
    'cost_spike','overstock','dead_stock','auto_po_generated','waste_escalated',
    'count_variance_high','prep_low_stock','catering_stock_insufficient'
  )),
  severity      TEXT        DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message       TEXT        NOT NULL,
  metadata      JSONB       DEFAULT '{}',
  is_read       BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

-- ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar               TEXT        NOT NULL,
  name_en               TEXT        NOT NULL,
  unit                  TEXT        NOT NULL CHECK (unit IN (
    'g','kg','ml','l','unit','tbsp','tsp','oz','lb','piece','portion','bottle','can','bag','box'
  )),
  purchase_unit         TEXT,
  purchase_unit_factor  NUMERIC(14,6),
  cost_per_unit         NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  ideal_cost_pct        NUMERIC(5,2),
  default_yield_factor  NUMERIC(5,3) NOT NULL DEFAULT 1.000 CHECK (default_yield_factor >= 1.000),
  category              TEXT        CHECK (category IN (
    'protein','grain','vegetable','dairy','seafood','spice','oil',
    'beverage','sauce','packaging','cleaning','disposable','other'
  )),
  abc_class             abc_class   DEFAULT 'C',
  barcode               TEXT        UNIQUE,
  reorder_point         NUMERIC(12,4),
  max_stock_level       NUMERIC(12,4),
  reorder_qty           NUMERIC(12,4),
  shelf_life_days       INTEGER,
  storage_temp          TEXT        CHECK (storage_temp IN ('frozen','chilled','ambient','dry')),
  supplier_id           UUID        REFERENCES suppliers(id),
  is_active             BOOLEAN     DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- deferred FK: inventory_alerts → ingredients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_alerts_ingredient'
      AND table_name = 'inventory_alerts'
  ) THEN
    ALTER TABLE inventory_alerts
      ADD CONSTRAINT fk_alerts_ingredient
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id);
  END IF;
END;
$$;

-- ingredient_allergens
CREATE TABLE IF NOT EXISTS ingredient_allergens (
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  allergen      TEXT NOT NULL CHECK (allergen IN (
    'gluten','dairy','eggs','nuts','peanuts','soy','fish','shellfish',
    'sesame','mustard','celery','lupin','molluscs','sulphites'
  )),
  PRIMARY KEY (ingredient_id, allergen)
);
ALTER TABLE ingredient_allergens ENABLE ROW LEVEL SECURITY;

-- supplier_price_history (purchase_order_id FK added after purchase_orders)
CREATE TABLE IF NOT EXISTS supplier_price_history (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id      UUID        NOT NULL REFERENCES ingredients(id),
  supplier_id        UUID        NOT NULL REFERENCES suppliers(id),
  unit_cost          NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  purchase_order_id  UUID,
  effective_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_price_history
  ON supplier_price_history(ingredient_id, effective_at DESC);

-- prep_items
CREATE TABLE IF NOT EXISTS prep_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar         TEXT        NOT NULL,
  name_en         TEXT        NOT NULL,
  unit            TEXT        NOT NULL CHECK (unit IN ('g','kg','ml','l','unit','portion','batch')),
  batch_yield_qty NUMERIC(12,4) NOT NULL,
  shelf_life_hours INTEGER,
  storage_temp    TEXT        CHECK (storage_temp IN ('frozen','chilled','ambient')),
  is_active       BOOLEAN     DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE prep_items ENABLE ROW LEVEL SECURITY;

-- prep_item_ingredients
CREATE TABLE IF NOT EXISTS prep_item_ingredients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_item_id  UUID        NOT NULL REFERENCES prep_items(id) ON DELETE CASCADE,
  ingredient_id UUID        NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  yield_factor  NUMERIC(5,3) CHECK (yield_factor IS NULL OR yield_factor >= 1.000),
  UNIQUE (prep_item_id, ingredient_id)
);
ALTER TABLE prep_item_ingredients ENABLE ROW LEVEL SECURITY;

-- recipes
CREATE TABLE IF NOT EXISTS recipes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_slug  TEXT        NOT NULL REFERENCES menu_items_sync(slug) ON DELETE CASCADE,
  ingredient_id   UUID        REFERENCES ingredients(id) ON DELETE RESTRICT,
  prep_item_id    UUID        REFERENCES prep_items(id) ON DELETE RESTRICT,
  quantity        NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  is_optional     BOOLEAN     DEFAULT false,
  variant_key     TEXT,
  yield_factor    NUMERIC(5,3) CHECK (yield_factor IS NULL OR yield_factor >= 1.000),
  notes           TEXT,
  updated_by      UUID        REFERENCES staff_basic(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (ingredient_id IS NOT NULL AND prep_item_id IS NULL)
    OR
    (ingredient_id IS NULL AND prep_item_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (menu_item_slug, ingredient_id, prep_item_id, variant_key)
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- inventory_stock
CREATE TABLE IF NOT EXISTS inventory_stock (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id     UUID        NOT NULL REFERENCES ingredients(id),
  on_hand           NUMERIC(14,4) NOT NULL DEFAULT 0,
  reserved          NUMERIC(14,4) NOT NULL DEFAULT 0,
  catering_reserved NUMERIC(14,4) NOT NULL DEFAULT 0,
  reorder_point     NUMERIC(14,4),
  max_stock_level   NUMERIC(14,4),
  last_movement_at  TIMESTAMPTZ,
  last_count_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, ingredient_id),
  CHECK (on_hand >= 0),
  CHECK (reserved >= 0),
  CHECK (catering_reserved >= 0),
  CHECK (reserved + catering_reserved <= on_hand)
);
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;

-- inventory_lots (purchase_order_id FK added after purchase_orders)
CREATE TABLE IF NOT EXISTS inventory_lots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id       UUID        NOT NULL REFERENCES ingredients(id),
  purchase_order_id   UUID,
  lot_number          TEXT,
  quantity_received   NUMERIC(14,4) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining  NUMERIC(14,4) NOT NULL,
  unit_cost           NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  received_at         TIMESTAMPTZ DEFAULT NOW(),
  expires_at          DATE,
  is_exhausted        BOOLEAN     DEFAULT false,
  CHECK (quantity_remaining >= 0),
  CHECK (quantity_remaining <= quantity_received)
);
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lots_fefo
  ON inventory_lots(branch_id, ingredient_id, expires_at ASC NULLS LAST)
  WHERE NOT is_exhausted;

-- inventory_movements (purchase_order_id + waste_log_id FKs added after those tables)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id    UUID        REFERENCES ingredients(id),
  prep_item_id     UUID        REFERENCES prep_items(id),
  lot_id           UUID        REFERENCES inventory_lots(id),
  movement_type    inventory_movement_type NOT NULL,
  quantity         NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit_cost        NUMERIC(10,4),
  order_id         UUID        REFERENCES orders(id),
  order_item_id    UUID        REFERENCES order_items(id),
  purchase_order_id UUID,
  waste_log_id     UUID,
  prep_batch_id    UUID,
  catering_order_id UUID,
  performed_by     UUID        REFERENCES staff_basic(id),
  performed_at     TIMESTAMPTZ DEFAULT NOW(),
  notes            TEXT
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        TEXT        NOT NULL REFERENCES branches(id),
  supplier_id      UUID        NOT NULL REFERENCES suppliers(id),
  status           TEXT        DEFAULT 'draft' CHECK (status IN (
    'draft','sent','confirmed','partial','received','cancelled'
  )),
  is_auto_generated BOOLEAN    DEFAULT false,
  expected_at      DATE,
  received_at      TIMESTAMPTZ,
  notes            TEXT,
  created_by       UUID        NOT NULL REFERENCES staff_basic(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- purchase_order_items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id       UUID        NOT NULL REFERENCES ingredients(id),
  quantity_ordered    NUMERIC(14,4) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received   NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantity_variance   NUMERIC(14,4) GENERATED ALWAYS AS (quantity_received - quantity_ordered) STORED,
  unit_cost           NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  lot_number          TEXT,
  expiry_date         DATE,
  quality_rating      SMALLINT    CHECK (quality_rating BETWEEN 1 AND 5),
  discrepancy_note    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- deferred FKs now that purchase_orders exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sph_purchase_order'
      AND table_name = 'supplier_price_history'
  ) THEN
    ALTER TABLE supplier_price_history
      ADD CONSTRAINT fk_sph_purchase_order
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_lots_purchase_order'
      AND table_name = 'inventory_lots'
  ) THEN
    ALTER TABLE inventory_lots
      ADD CONSTRAINT fk_lots_purchase_order
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_movements_purchase_order'
      AND table_name = 'inventory_movements'
  ) THEN
    ALTER TABLE inventory_movements
      ADD CONSTRAINT fk_movements_purchase_order
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
  END IF;
END;
$$;

-- waste_log
CREATE TABLE IF NOT EXISTS waste_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id    UUID        NOT NULL REFERENCES ingredients(id),
  quantity         NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  reason           TEXT        NOT NULL CHECK (reason IN (
    'expired','damaged','spillage','overproduction','quality','returned',
    'theft_suspected','prep_error','over_portioning','other'
  )),
  cost_bhd         NUMERIC(12,3) DEFAULT 0,
  notes            TEXT,
  photo_url        TEXT,
  escalation_level SMALLINT    DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 3),
  escalated_at     TIMESTAMPTZ,
  reported_by      UUID        NOT NULL REFERENCES staff_basic(id),
  approved_by      UUID        REFERENCES staff_basic(id),
  approved_at      TIMESTAMPTZ,
  rejected_by      UUID        REFERENCES staff_basic(id),
  rejected_at      TIMESTAMPTZ,
  rejection_note   TEXT,
  reported_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

-- deferred FK: inventory_movements.waste_log_id → waste_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_movements_waste_log'
      AND table_name = 'inventory_movements'
  ) THEN
    ALTER TABLE inventory_movements
      ADD CONSTRAINT fk_movements_waste_log
      FOREIGN KEY (waste_log_id) REFERENCES waste_log(id);
  END IF;
END;
$$;

-- inventory_counts
CREATE TABLE IF NOT EXISTS inventory_counts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id UUID       NOT NULL REFERENCES ingredients(id),
  lot_id       UUID        REFERENCES inventory_lots(id),
  counted_by   UUID        NOT NULL REFERENCES staff_basic(id),
  verified_by  UUID        REFERENCES staff_basic(id),
  system_qty   NUMERIC(14,4) NOT NULL,
  actual_qty   NUMERIC(14,4) NOT NULL,
  variance     NUMERIC(14,4) GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
  variance_pct NUMERIC(8,2)  GENERATED ALWAYS AS (
    CASE WHEN system_qty != 0
      THEN ROUND(((actual_qty - system_qty) / system_qty) * 100, 2)
      ELSE NULL
    END
  ) STORED,
  count_session TEXT,
  approved_by  UUID        REFERENCES staff_basic(id),
  approved_at  TIMESTAMPTZ,
  notes        TEXT,
  counted_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;

-- inventory_transfers
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id  TEXT        NOT NULL REFERENCES branches(id),
  to_branch_id    TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id   UUID        NOT NULL REFERENCES ingredients(id),
  quantity        NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  lot_id          UUID        REFERENCES inventory_lots(id),
  status          TEXT        DEFAULT 'pending' CHECK (status IN ('pending','in_transit','received','cancelled')),
  transferred_by  UUID        NOT NULL REFERENCES staff_basic(id),
  received_by     UUID        REFERENCES staff_basic(id),
  transferred_at  TIMESTAMPTZ DEFAULT NOW(),
  received_at     TIMESTAMPTZ,
  notes           TEXT,
  CHECK (from_branch_id != to_branch_id)
);
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;

-- par_levels
CREATE TABLE IF NOT EXISTS par_levels (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     TEXT        NOT NULL REFERENCES branches(id),
  ingredient_id UUID        NOT NULL REFERENCES ingredients(id),
  day_type      TEXT        DEFAULT 'default' CHECK (day_type IN ('default','weekend','ramadan','event','holiday')),
  par_qty       NUMERIC(14,4) NOT NULL CHECK (par_qty >= 0),
  reorder_qty   NUMERIC(14,4) NOT NULL CHECK (reorder_qty >= 0),
  UNIQUE (branch_id, ingredient_id, day_type)
);
ALTER TABLE par_levels ENABLE ROW LEVEL SECURITY;

-- unit_conversions
CREATE TABLE IF NOT EXISTS unit_conversions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID        REFERENCES ingredients(id) ON DELETE CASCADE,
  from_unit     TEXT        NOT NULL,
  to_unit       TEXT        NOT NULL,
  factor        NUMERIC(14,6) NOT NULL CHECK (factor > 0),
  UNIQUE NULLS NOT DISTINCT (ingredient_id, from_unit, to_unit)
);
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

-- Seed universal unit conversions
INSERT INTO unit_conversions (ingredient_id, from_unit, to_unit, factor) VALUES
  (NULL, 'kg',   'g',   1000),
  (NULL, 'g',    'kg',  0.001),
  (NULL, 'l',    'ml',  1000),
  (NULL, 'ml',   'l',   0.001),
  (NULL, 'lb',   'g',   453.592),
  (NULL, 'oz',   'g',   28.3495),
  (NULL, 'tbsp', 'ml',  14.787),
  (NULL, 'tsp',  'ml',  4.929)
ON CONFLICT DO NOTHING;

-- delivery_platform_mappings
CREATE TABLE IF NOT EXISTS delivery_platform_mappings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT        NOT NULL CHECK (platform IN ('talabat','jahez','keeta','other')),
  platform_item_name  TEXT        NOT NULL,
  menu_item_slug      TEXT        NOT NULL REFERENCES menu_items_sync(slug),
  is_active           BOOLEAN     DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, platform_item_name)
);
ALTER TABLE delivery_platform_mappings ENABLE ROW LEVEL SECURITY;

-- ── 3. ORDERS TABLE GUARDS ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_source'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'website'
      CHECK (order_source IN ('website','walk_in','phone','talabat','jahez','keeta','catering','other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'platform_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN platform_order_id TEXT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_platform_dedup
  ON orders(order_source, platform_order_id)
  WHERE platform_order_id IS NOT NULL;

-- Extend staff_role ENUM for inventory access control.
-- Policies in Section 8 use auth_user_role()::text to avoid SQLSTATE 55P04
-- (PostgreSQL disallows using a newly added enum value in the same transaction).
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'inventory_manager';

-- ── 4. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_movements_order
  ON inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient
  ON inventory_movements(ingredient_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_performed
  ON inventory_movements(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type
  ON inventory_movements(movement_type, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_branch
  ON inventory_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_low
  ON inventory_stock(branch_id, on_hand) WHERE on_hand <= 0;
CREATE INDEX IF NOT EXISTS idx_recipes_slug
  ON recipes(menu_item_slug);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient
  ON recipes(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipes_prep
  ON recipes(prep_item_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_branch_date
  ON waste_log(branch_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_log_pending
  ON waste_log(reported_at) WHERE approved_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch
  ON purchase_orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_auto
  ON purchase_orders(created_at) WHERE is_auto_generated;
CREATE INDEX IF NOT EXISTS idx_inventory_counts_branch
  ON inventory_counts(branch_id, counted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lots_expiry
  ON inventory_lots(expires_at) WHERE expires_at IS NOT NULL AND NOT is_exhausted;
CREATE INDEX IF NOT EXISTS idx_ingredients_barcode
  ON ingredients(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingredients_abc
  ON ingredients(abc_class);
CREATE INDEX IF NOT EXISTS idx_par_levels_branch
  ON par_levels(branch_id, ingredient_id);

-- ── 5. FUNCTIONS & TRIGGERS ───────────────────────────────────────────────────

-- fn_check_price_spike (called by po_receive trigger)
CREATE OR REPLACE FUNCTION fn_check_price_spike(
  p_ingredient_id UUID,
  p_new_cost      NUMERIC,
  p_branch_id     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prev_cost NUMERIC(10,4);
  v_change_pct NUMERIC;
BEGIN
  SELECT unit_cost INTO v_prev_cost
  FROM supplier_price_history
  WHERE ingredient_id = p_ingredient_id
  ORDER BY effective_at DESC
  LIMIT 1 OFFSET 1;

  IF v_prev_cost IS NOT NULL AND v_prev_cost > 0 THEN
    v_change_pct := ABS((p_new_cost - v_prev_cost) / v_prev_cost) * 100;
    IF v_change_pct > 10 THEN
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      VALUES (
        p_branch_id,
        p_ingredient_id,
        'cost_spike',
        'warning',
        'Cost spike detected: ' || ROUND(v_change_pct, 1) || '% change',
        jsonb_build_object(
          'previous_cost', v_prev_cost,
          'new_cost', p_new_cost,
          'change_pct', ROUND(v_change_pct, 2)
        )
      );
    END IF;
  END IF;
END;
$$;

-- fn_inventory_reserve — fires AFTER INSERT on order_items
CREATE OR REPLACE FUNCTION fn_inventory_reserve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_branch_id   TEXT;
  v_required    NUMERIC(14,4);
  v_has_recipe  BOOLEAN := FALSE;
  rec           RECORD;
BEGIN
  SELECT branch_id INTO v_branch_id
  FROM orders WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0003';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM recipes WHERE menu_item_slug = NEW.menu_item_slug
  ) INTO v_has_recipe;

  IF NOT v_has_recipe THEN
    INSERT INTO inventory_alerts (branch_id, alert_type, severity, message, metadata)
    VALUES (
      v_branch_id, 'unmapped_item', 'info',
      'No recipe mapped for: ' || NEW.menu_item_slug,
      jsonb_build_object('menu_item_slug', NEW.menu_item_slug, 'order_id', NEW.order_id)
    );
    RETURN NEW;
  END IF;

  FOR rec IN
    -- Direct ingredients
    SELECT
      r.ingredient_id,
      r.quantity
        * COALESCE(r.yield_factor, i.default_yield_factor, 1.000)
        AS qty_per_unit
    FROM recipes r
    JOIN ingredients i ON i.id = r.ingredient_id
    WHERE r.menu_item_slug = NEW.menu_item_slug
      AND r.ingredient_id IS NOT NULL

    UNION ALL

    -- Prep-item ingredients (expanded)
    SELECT
      pii.ingredient_id,
      (r.quantity * COALESCE(r.yield_factor, 1.000))
        * (pii.quantity * COALESCE(pii.yield_factor, ing.default_yield_factor, 1.000))
        / NULLIF(p.batch_yield_qty, 0)
        AS qty_per_unit
    FROM recipes r
    JOIN prep_items p ON p.id = r.prep_item_id
    JOIN prep_item_ingredients pii ON pii.prep_item_id = p.id
    JOIN ingredients ing ON ing.id = pii.ingredient_id
    WHERE r.menu_item_slug = NEW.menu_item_slug
      AND r.prep_item_id IS NOT NULL
  LOOP
    v_required := rec.qty_per_unit * NEW.quantity;

    UPDATE inventory_stock
    SET
      reserved         = reserved + v_required,
      last_movement_at = NOW()
    WHERE branch_id     = v_branch_id
      AND ingredient_id = rec.ingredient_id
      AND (on_hand - reserved - catering_reserved) >= v_required;

    IF NOT FOUND THEN
      IF EXISTS (
        SELECT 1 FROM inventory_stock
        WHERE branch_id = v_branch_id AND ingredient_id = rec.ingredient_id
      ) THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
      ELSE
        RAISE EXCEPTION 'MISSING_STOCK_RECORD' USING ERRCODE = 'P0002';
      END IF;
    END IF;

    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity,
      order_id, order_item_id, performed_at
    ) VALUES (
      v_branch_id, rec.ingredient_id, 'reservation', v_required,
      NEW.order_id, NEW.id, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_reserve ON order_items;
CREATE TRIGGER trg_inventory_reserve
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_inventory_reserve();

-- fn_inventory_finalize_or_release — fires AFTER UPDATE OF status on orders
CREATE OR REPLACE FUNCTION fn_inventory_finalize_or_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type  inventory_movement_type;
  rec     RECORD;
BEGIN
  IF NEW.status IN ('delivered','completed') THEN
    v_type := 'consumption';
  ELSE
    v_type := 'release';
  END IF;

  FOR rec IN
    SELECT ingredient_id, SUM(quantity) AS total_qty
    FROM inventory_movements
    WHERE order_id = NEW.id
      AND movement_type = 'reservation'
    GROUP BY ingredient_id
  LOOP
    IF v_type = 'consumption' THEN
      UPDATE inventory_stock
      SET
        reserved         = GREATEST(0, reserved - rec.total_qty),
        on_hand          = GREATEST(0, on_hand  - rec.total_qty),
        last_movement_at = NOW()
      WHERE branch_id     = NEW.branch_id
        AND ingredient_id = rec.ingredient_id;
    ELSE
      UPDATE inventory_stock
      SET
        reserved         = GREATEST(0, reserved - rec.total_qty),
        last_movement_at = NOW()
      WHERE branch_id     = NEW.branch_id
        AND ingredient_id = rec.ingredient_id;
    END IF;

    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity, order_id, performed_at
    ) VALUES (
      NEW.branch_id, rec.ingredient_id, v_type, rec.total_qty, NEW.id, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_finalize ON orders;
CREATE TRIGGER trg_inventory_finalize
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (
    NEW.status IN ('delivered','completed','cancelled')
    AND NEW.status IS DISTINCT FROM OLD.status
  )
  EXECUTE FUNCTION fn_inventory_finalize_or_release();

-- fn_waste_deduct — fires AFTER UPDATE OF approved_by on waste_log
CREATE OR REPLACE FUNCTION fn_waste_deduct()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.approved_by IS NULL OR OLD.approved_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE inventory_stock
  SET
    on_hand          = GREATEST(0, on_hand - NEW.quantity),
    last_movement_at = NOW()
  WHERE branch_id     = NEW.branch_id
    AND ingredient_id = NEW.ingredient_id;

  INSERT INTO inventory_movements (
    branch_id, ingredient_id, movement_type, quantity,
    waste_log_id, performed_by, performed_at
  ) VALUES (
    NEW.branch_id, NEW.ingredient_id, 'waste', NEW.quantity,
    NEW.id, NEW.approved_by, NOW()
  );

  IF NEW.reason = 'theft_suspected' THEN
    INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
    VALUES (
      NEW.branch_id, NEW.ingredient_id, 'theft_suspected', 'critical',
      'Theft suspected waste entry approved',
      jsonb_build_object('waste_log_id', NEW.id, 'quantity', NEW.quantity)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waste_deduct ON waste_log;
CREATE TRIGGER trg_waste_deduct
  AFTER UPDATE OF approved_by ON waste_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_waste_deduct();

-- fn_po_receive_create_lot — fires AFTER UPDATE OF quantity_received on purchase_order_items
CREATE OR REPLACE FUNCTION fn_po_receive_create_lot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  IF NEW.quantity_received = OLD.quantity_received OR NEW.quantity_received = 0 THEN
    RETURN NEW;
  END IF;

  SELECT branch_id INTO v_branch_id
  FROM purchase_orders WHERE id = NEW.purchase_order_id;

  INSERT INTO inventory_lots (
    branch_id, ingredient_id, purchase_order_id,
    lot_number, quantity_received, quantity_remaining,
    unit_cost, expires_at
  ) VALUES (
    v_branch_id, NEW.ingredient_id, NEW.purchase_order_id,
    NEW.lot_number, NEW.quantity_received, NEW.quantity_received,
    NEW.unit_cost, NEW.expiry_date
  );

  INSERT INTO supplier_price_history (
    ingredient_id, supplier_id, unit_cost, purchase_order_id, effective_at
  )
  SELECT
    NEW.ingredient_id, po.supplier_id, NEW.unit_cost, NEW.purchase_order_id, NOW()
  FROM purchase_orders po
  WHERE po.id = NEW.purchase_order_id;

  PERFORM fn_check_price_spike(NEW.ingredient_id, NEW.unit_cost, v_branch_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_receive_create_lot ON purchase_order_items;
CREATE TRIGGER trg_po_receive_create_lot
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_po_receive_create_lot();

-- ── 6. RPCs ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_check_stock_for_cart(
  p_branch_id TEXT,
  p_items     JSONB
)
RETURNS TABLE (
  menu_item_slug    TEXT,
  available         BOOLEAN,
  shortage_ingredient UUID,
  shortage_required   NUMERIC,
  shortage_available  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  item       JSONB;
  v_slug     TEXT;
  v_qty      NUMERIC;
  v_avail    BOOLEAN;
  v_short_id UUID;
  v_req      NUMERIC;
  v_avl      NUMERIC;
  rec        RECORD;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_slug  := item->>'slug';
    v_qty   := (item->>'qty')::NUMERIC;
    v_avail := TRUE;
    v_short_id := NULL;
    v_req   := NULL;
    v_avl   := NULL;

    FOR rec IN
      SELECT
        ing_id,
        SUM(qty_needed) AS total_needed,
        MIN(avail_stock) AS avail_stock
      FROM (
        SELECT
          r.ingredient_id AS ing_id,
          r.quantity * COALESCE(r.yield_factor, i.default_yield_factor, 1.000) * v_qty AS qty_needed,
          COALESCE(s.on_hand - s.reserved - s.catering_reserved, 0) AS avail_stock
        FROM recipes r
        JOIN ingredients i ON i.id = r.ingredient_id
        LEFT JOIN inventory_stock s ON s.branch_id = p_branch_id AND s.ingredient_id = r.ingredient_id
        WHERE r.menu_item_slug = v_slug AND r.ingredient_id IS NOT NULL

        UNION ALL

        SELECT
          pii.ingredient_id AS ing_id,
          (r.quantity * COALESCE(r.yield_factor, 1.000))
            * (pii.quantity * COALESCE(pii.yield_factor, ing.default_yield_factor, 1.000))
            / NULLIF(p.batch_yield_qty, 0) * v_qty AS qty_needed,
          COALESCE(s.on_hand - s.reserved - s.catering_reserved, 0) AS avail_stock
        FROM recipes r
        JOIN prep_items p ON p.id = r.prep_item_id
        JOIN prep_item_ingredients pii ON pii.prep_item_id = p.id
        JOIN ingredients ing ON ing.id = pii.ingredient_id
        LEFT JOIN inventory_stock s ON s.branch_id = p_branch_id AND s.ingredient_id = pii.ingredient_id
        WHERE r.menu_item_slug = v_slug AND r.prep_item_id IS NOT NULL
      ) expanded
      GROUP BY ing_id
    LOOP
      IF rec.total_needed > rec.avail_stock THEN
        v_avail    := FALSE;
        v_short_id := rec.ing_id;
        v_req      := rec.total_needed;
        v_avl      := rec.avail_stock;
        EXIT;
      END IF;
    END LOOP;

    menu_item_slug     := v_slug;
    available          := v_avail;
    shortage_ingredient := v_short_id;
    shortage_required  := v_req;
    shortage_available := v_avl;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_low_stock_alerts(p_branch_id TEXT)
RETURNS TABLE (
  ingredient_id   UUID,
  name_ar         TEXT,
  name_en         TEXT,
  abc_class       abc_class,
  on_hand         NUMERIC,
  available       NUMERIC,
  par_qty         NUMERIC,
  reorder_point   NUMERIC,
  days_to_out     NUMERIC,
  nearest_expiry  DATE,
  suggested_order NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.name_ar,
    i.name_en,
    i.abc_class,
    s.on_hand,
    (s.on_hand - s.reserved - s.catering_reserved)   AS available,
    pl.par_qty,
    COALESCE(s.reorder_point, i.reorder_point)        AS reorder_point,
    CASE
      WHEN avg_daily.avg_consumption > 0
      THEN ROUND((s.on_hand - s.reserved - s.catering_reserved) / avg_daily.avg_consumption, 2)
      ELSE NULL
    END                                                AS days_to_out,
    lot_exp.nearest_expiry,
    COALESCE(pl.reorder_qty, i.reorder_qty)           AS suggested_order
  FROM inventory_stock s
  JOIN ingredients i ON i.id = s.ingredient_id
  LEFT JOIN par_levels pl
    ON pl.branch_id = s.branch_id AND pl.ingredient_id = s.ingredient_id AND pl.day_type = 'default'
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(m.quantity) / 7.0, 0) AS avg_consumption
    FROM inventory_movements m
    WHERE m.branch_id     = s.branch_id
      AND m.ingredient_id = s.ingredient_id
      AND m.movement_type IN ('consumption','waste')
      AND m.performed_at  >= NOW() - INTERVAL '7 days'
  ) avg_daily ON true
  LEFT JOIN LATERAL (
    SELECT MIN(expires_at) AS nearest_expiry
    FROM inventory_lots
    WHERE branch_id     = s.branch_id
      AND ingredient_id = s.ingredient_id
      AND NOT is_exhausted
      AND expires_at IS NOT NULL
  ) lot_exp ON true
  WHERE s.branch_id = p_branch_id
    AND i.is_active = true
    AND (s.on_hand - s.reserved - s.catering_reserved)
        <= COALESCE(s.reorder_point, i.reorder_point, 0)
  ORDER BY i.abc_class ASC,
    CASE
      WHEN avg_daily.avg_consumption > 0
      THEN (s.on_hand - s.reserved - s.catering_reserved) / avg_daily.avg_consumption
      ELSE NULL
    END ASC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_receive_purchase_order(
  p_po_id       UUID,
  p_received_by UUID,
  p_lines       JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  line        JSONB;
  v_branch_id TEXT;
  v_item      purchase_order_items%ROWTYPE;
  v_all_received BOOLEAN;
BEGIN
  SELECT branch_id INTO v_branch_id FROM purchase_orders WHERE id = p_po_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    UPDATE purchase_order_items
    SET
      quantity_received = (line->>'quantity_received')::NUMERIC,
      lot_number        = line->>'lot_number',
      expiry_date       = (line->>'expiry_date')::DATE,
      quality_rating    = (line->>'quality_rating')::SMALLINT,
      discrepancy_note  = line->>'discrepancy_note'
    WHERE id = (line->>'id')::UUID
    RETURNING * INTO v_item;

    -- Upsert stock
    INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand, last_movement_at)
    VALUES (v_branch_id, v_item.ingredient_id, v_item.quantity_received, NOW())
    ON CONFLICT (branch_id, ingredient_id) DO UPDATE
      SET on_hand          = inventory_stock.on_hand + EXCLUDED.on_hand,
          last_movement_at = NOW();

    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity,
      unit_cost, purchase_order_id, performed_by, performed_at
    ) VALUES (
      v_branch_id, v_item.ingredient_id, 'purchase', v_item.quantity_received,
      v_item.unit_cost, p_po_id, p_received_by, NOW()
    );

    UPDATE ingredients
    SET cost_per_unit = v_item.unit_cost,
        updated_at    = NOW()
    WHERE id = v_item.ingredient_id;
  END LOOP;

  -- Update supplier reliability
  UPDATE suppliers s
  SET reliability_pct = (
    SELECT ROUND(
      AVG(GREATEST(0, (1.0 - ABS(poi.quantity_variance) / NULLIF(poi.quantity_ordered, 0)))) * 100,
      2
    )
    FROM purchase_orders po
    JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE po.supplier_id = s.id AND po.status = 'received'
  )
  WHERE id = (SELECT supplier_id FROM purchase_orders WHERE id = p_po_id);

  -- Determine final PO status
  SELECT bool_and(quantity_received >= quantity_ordered) INTO v_all_received
  FROM purchase_order_items WHERE purchase_order_id = p_po_id;

  UPDATE purchase_orders
  SET status      = CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
      received_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_inventory_count_submit(
  p_count_id    UUID,
  p_approved_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count inventory_counts%ROWTYPE;
BEGIN
  SELECT * INTO v_count FROM inventory_counts WHERE id = p_count_id;

  UPDATE inventory_stock
  SET on_hand          = v_count.actual_qty,
      last_count_at    = NOW(),
      last_movement_at = NOW()
  WHERE branch_id     = v_count.branch_id
    AND ingredient_id = v_count.ingredient_id;

  INSERT INTO inventory_movements (
    branch_id, ingredient_id, movement_type, quantity, performed_by, performed_at
  ) VALUES (
    v_count.branch_id, v_count.ingredient_id, 'count_adjust',
    ABS(v_count.actual_qty - v_count.system_qty),
    p_approved_by, NOW()
  );

  UPDATE inventory_counts
  SET approved_by = p_approved_by, approved_at = NOW()
  WHERE id = p_count_id;

  IF ABS(v_count.variance_pct) > 10 THEN
    INSERT INTO inventory_alerts (
      branch_id, ingredient_id, alert_type, severity, message, metadata
    ) VALUES (
      v_count.branch_id, v_count.ingredient_id,
      'count_variance_high', 'critical',
      'High count variance: ' || v_count.variance_pct || '%',
      jsonb_build_object(
        'count_id',    p_count_id,
        'variance',    v_count.variance,
        'variance_pct', v_count.variance_pct
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_transfer_stock(
  p_from_branch  TEXT,
  p_to_branch    TEXT,
  p_ingredient   UUID,
  p_quantity     NUMERIC,
  p_staff_id     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_avail NUMERIC;
BEGIN
  SELECT (on_hand - reserved - catering_reserved) INTO v_avail
  FROM inventory_stock
  WHERE branch_id = p_from_branch AND ingredient_id = p_ingredient;

  IF v_avail IS NULL OR v_avail < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK_FOR_TRANSFER' USING ERRCODE = 'P0004';
  END IF;

  UPDATE inventory_stock
  SET on_hand          = on_hand - p_quantity,
      last_movement_at = NOW()
  WHERE branch_id = p_from_branch AND ingredient_id = p_ingredient;

  INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand, last_movement_at)
  VALUES (p_to_branch, p_ingredient, p_quantity, NOW())
  ON CONFLICT (branch_id, ingredient_id) DO UPDATE
    SET on_hand          = inventory_stock.on_hand + EXCLUDED.on_hand,
        last_movement_at = NOW();

  INSERT INTO inventory_movements (
    branch_id, ingredient_id, movement_type, quantity, performed_by, performed_at
  )
  VALUES
    (p_from_branch, p_ingredient, 'transfer_out', p_quantity, p_staff_id, NOW()),
    (p_to_branch,   p_ingredient, 'transfer_in',  p_quantity, p_staff_id, NOW());
END;
$$;

CREATE OR REPLACE FUNCTION rpc_escalate_waste_approvals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_new_level SMALLINT;
  v_threshold INTERVAL;
BEGIN
  FOR rec IN
    SELECT id, branch_id, ingredient_id, escalation_level, reported_at
    FROM waste_log
    WHERE approved_by IS NULL
      AND rejected_by IS NULL
  LOOP
    v_new_level := NULL;

    IF rec.escalation_level = 0 AND NOW() - rec.reported_at > INTERVAL '4 hours' THEN
      v_new_level := 1;
    ELSIF rec.escalation_level = 1 AND NOW() - rec.reported_at > INTERVAL '8 hours' THEN
      v_new_level := 2;
    ELSIF rec.escalation_level = 2 AND NOW() - rec.reported_at > INTERVAL '24 hours' THEN
      v_new_level := 3;
    END IF;

    IF v_new_level IS NOT NULL THEN
      UPDATE waste_log
      SET escalation_level = v_new_level, escalated_at = NOW()
      WHERE id = rec.id;

      INSERT INTO inventory_alerts (
        branch_id, ingredient_id, alert_type, severity, message, metadata
      ) VALUES (
        rec.branch_id, rec.ingredient_id,
        'waste_escalated', 'warning',
        'Waste approval escalated to level ' || v_new_level,
        jsonb_build_object('waste_log_id', rec.id, 'escalation_level', v_new_level)
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_auto_generate_pos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_branch   RECORD;
  v_item     RECORD;
  v_po_id    UUID;
  v_owner_id UUID;
BEGIN
  -- Get a system staff id for created_by (owner/gm)
  SELECT id INTO v_owner_id
  FROM staff_basic
  WHERE role IN ('owner','general_manager') AND is_active = true
  LIMIT 1;

  FOR v_branch IN SELECT id FROM branches WHERE is_active = true
  LOOP
    FOR v_item IN
      SELECT
        i.id AS ingredient_id,
        i.supplier_id,
        i.reorder_qty,
        s.on_hand,
        COALESCE(s.reorder_point, i.reorder_point) AS reorder_pt
      FROM inventory_stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.branch_id = v_branch.id
        AND i.is_active = true
        AND i.supplier_id IS NOT NULL
        AND i.reorder_qty IS NOT NULL
        AND s.on_hand <= COALESCE(s.reorder_point, i.reorder_point, 0)
    LOOP
      -- Skip if open PO already exists for same ingredient+supplier
      CONTINUE WHEN EXISTS (
        SELECT 1
        FROM purchase_orders po
        JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
        WHERE po.branch_id   = v_branch.id
          AND po.supplier_id = v_item.supplier_id
          AND poi.ingredient_id = v_item.ingredient_id
          AND po.status NOT IN ('received','cancelled')
      );

      -- Reuse existing draft PO for same branch+supplier (created within last hour)
      SELECT id INTO v_po_id
      FROM purchase_orders
      WHERE branch_id    = v_branch.id
        AND supplier_id  = v_item.supplier_id
        AND status       = 'draft'
        AND is_auto_generated = true
        AND created_at   >= NOW() - INTERVAL '1 hour'
      LIMIT 1;

      IF v_po_id IS NULL THEN
        INSERT INTO purchase_orders (
          branch_id, supplier_id, status, is_auto_generated, created_by
        ) VALUES (
          v_branch.id, v_item.supplier_id, 'draft', true, v_owner_id
        ) RETURNING id INTO v_po_id;

        INSERT INTO inventory_alerts (
          branch_id, alert_type, severity, message, metadata
        ) VALUES (
          v_branch.id, 'auto_po_generated', 'info',
          'Auto-generated purchase order created',
          jsonb_build_object('purchase_order_id', v_po_id, 'supplier_id', v_item.supplier_id)
        );
      END IF;

      INSERT INTO purchase_order_items (
        purchase_order_id, ingredient_id, quantity_ordered, unit_cost
      )
      SELECT v_po_id, v_item.ingredient_id, v_item.reorder_qty, i.cost_per_unit
      FROM ingredients i WHERE i.id = v_item.ingredient_id
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_dead_stock_report(
  p_branch_id    TEXT,
  p_days_no_move INTEGER DEFAULT 30
)
RETURNS TABLE (
  ingredient_id    UUID,
  name_ar          TEXT,
  name_en          TEXT,
  on_hand          NUMERIC,
  last_movement_at TIMESTAMPTZ,
  days_inactive    INTEGER,
  stock_value_bhd  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.name_ar,
    i.name_en,
    s.on_hand,
    s.last_movement_at,
    EXTRACT(DAY FROM NOW() - s.last_movement_at)::INTEGER AS days_inactive,
    ROUND(s.on_hand * i.cost_per_unit, 3)                 AS stock_value_bhd
  FROM inventory_stock s
  JOIN ingredients i ON i.id = s.ingredient_id
  WHERE s.branch_id = p_branch_id
    AND s.on_hand > 0
    AND i.is_active = true
    AND (
      s.last_movement_at IS NULL
      OR s.last_movement_at < NOW() - (p_days_no_move || ' days')::INTERVAL
    )
  ORDER BY days_inactive DESC NULLS FIRST;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_expiry_report(
  p_branch_id  TEXT,
  p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
  ingredient_id      UUID,
  name_ar            TEXT,
  name_en            TEXT,
  lot_id             UUID,
  lot_number         TEXT,
  quantity_remaining NUMERIC,
  expires_at         DATE,
  days_remaining     INTEGER,
  stock_value_bhd    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.name_ar,
    i.name_en,
    l.id                                              AS lot_id,
    l.lot_number,
    l.quantity_remaining,
    l.expires_at,
    (l.expires_at - CURRENT_DATE)::INTEGER            AS days_remaining,
    ROUND(l.quantity_remaining * l.unit_cost, 3)      AS stock_value_bhd
  FROM inventory_lots l
  JOIN ingredients i ON i.id = l.ingredient_id
  WHERE l.branch_id    = p_branch_id
    AND NOT l.is_exhausted
    AND l.expires_at  IS NOT NULL
    AND l.expires_at  <= CURRENT_DATE + p_days_ahead
  ORDER BY l.expires_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_menu_engineering(
  p_branch_id   TEXT,
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  menu_item_slug  TEXT,
  name_ar         TEXT,
  name_en         TEXT,
  total_sold      NUMERIC,
  revenue_bhd     NUMERIC,
  cost_bhd        NUMERIC,
  profit_bhd      NUMERIC,
  margin_pct      NUMERIC,
  ideal_cost_pct  NUMERIC,
  is_above_ideal_cost BOOLEAN,
  category        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH sales AS (
    SELECT
      oi.menu_item_slug,
      SUM(oi.quantity)::NUMERIC       AS total_sold,
      SUM(oi.item_total_bhd)          AS revenue_bhd
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.branch_id = p_branch_id
      AND o.status IN ('delivered','completed')
      AND o.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY oi.menu_item_slug
  ),
  costs AS (
    SELECT
      r.menu_item_slug,
      SUM(
        r.quantity * COALESCE(r.yield_factor, i.default_yield_factor, 1.000) * i.cost_per_unit
      ) AS cost_bhd
    FROM recipes r
    JOIN ingredients i ON i.id = r.ingredient_id
    WHERE r.ingredient_id IS NOT NULL
    GROUP BY r.menu_item_slug
  ),
  combined AS (
    SELECT
      s.menu_item_slug,
      m.name_ar,
      m.name_en,
      s.total_sold,
      s.revenue_bhd,
      COALESCE(c.cost_bhd, 0)               AS cost_bhd,
      s.revenue_bhd - COALESCE(c.cost_bhd, 0) AS profit_bhd,
      m.price_bhd
    FROM sales s
    JOIN menu_items_sync m ON m.slug = s.menu_item_slug
    LEFT JOIN costs c ON c.menu_item_slug = s.menu_item_slug
  ),
  averages AS (
    SELECT
      AVG(total_sold)  AS avg_sold,
      AVG(profit_bhd)  AS avg_profit
    FROM combined
  ),
  ideal_costs AS (
    SELECT
      r.menu_item_slug,
      SUM(r.quantity * COALESCE(r.yield_factor, ing.default_yield_factor, 1.000) * ing.cost_per_unit) AS total_cost,
      AVG(ing.ideal_cost_pct) AS ideal_cost_pct
    FROM recipes r
    JOIN ingredients ing ON ing.id = r.ingredient_id
    WHERE r.ingredient_id IS NOT NULL
    GROUP BY r.menu_item_slug
  )
  SELECT
    cb.menu_item_slug,
    cb.name_ar,
    cb.name_en,
    cb.total_sold,
    ROUND(cb.revenue_bhd, 3)   AS revenue_bhd,
    ROUND(cb.cost_bhd, 3)      AS cost_bhd,
    ROUND(cb.profit_bhd, 3)    AS profit_bhd,
    CASE
      WHEN cb.price_bhd > 0
      THEN ROUND((cb.profit_bhd / cb.price_bhd) * 100, 2)
      ELSE NULL
    END                        AS margin_pct,
    ic.ideal_cost_pct,
    CASE
      WHEN cb.price_bhd > 0 AND ic.total_cost IS NOT NULL
      THEN (ic.total_cost / cb.price_bhd * 100) > COALESCE(ic.ideal_cost_pct, 30)
      ELSE false
    END                        AS is_above_ideal_cost,
    CASE
      WHEN cb.total_sold >= av.avg_sold AND cb.profit_bhd >= av.avg_profit THEN 'Star'
      WHEN cb.total_sold >= av.avg_sold AND cb.profit_bhd <  av.avg_profit THEN 'Plowhorse'
      WHEN cb.total_sold <  av.avg_sold AND cb.profit_bhd >= av.avg_profit THEN 'Puzzle'
      ELSE 'Dog'
    END                        AS category
  FROM combined cb
  CROSS JOIN averages av
  LEFT JOIN ideal_costs ic ON ic.menu_item_slug = cb.menu_item_slug
  ORDER BY cb.total_sold DESC;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_update_abc_classification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_value    NUMERIC;
  v_running_pct    NUMERIC := 0;
  v_item_value     NUMERIC;
  v_new_class      abc_class;
  rec              RECORD;
BEGIN
  SELECT SUM(on_hand * cost_per_unit) INTO v_total_value
  FROM inventory_stock s
  JOIN ingredients i ON i.id = s.ingredient_id
  WHERE i.is_active = true;

  IF v_total_value IS NULL OR v_total_value = 0 THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      i.id,
      SUM(s.on_hand) * i.cost_per_unit AS item_value
    FROM ingredients i
    JOIN inventory_stock s ON s.ingredient_id = i.id
    WHERE i.is_active = true
    GROUP BY i.id, i.cost_per_unit
    ORDER BY item_value DESC
  LOOP
    v_running_pct := v_running_pct + (rec.item_value / v_total_value * 100);

    IF v_running_pct <= 80 THEN
      v_new_class := 'A';
    ELSIF v_running_pct <= 95 THEN
      v_new_class := 'B';
    ELSE
      v_new_class := 'C';
    END IF;

    UPDATE ingredients SET abc_class = v_new_class WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ── 7. VIEWS ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_dish_cogs AS
WITH ingredient_costs AS (
  SELECT
    r.menu_item_slug,
    SUM(
      r.quantity * COALESCE(r.yield_factor, i.default_yield_factor, 1.000) * i.cost_per_unit
    ) AS cost_bhd
  FROM recipes r
  JOIN ingredients i ON i.id = r.ingredient_id
  WHERE r.ingredient_id IS NOT NULL
  GROUP BY r.menu_item_slug
),
prep_costs AS (
  SELECT
    r.menu_item_slug,
    SUM(
      r.quantity * COALESCE(r.yield_factor, 1.000)
      * (
        SELECT COALESCE(
          SUM(pii.quantity * COALESCE(pii.yield_factor, ing.default_yield_factor, 1.000) * ing.cost_per_unit),
          0
        )
        FROM prep_item_ingredients pii
        JOIN ingredients ing ON ing.id = pii.ingredient_id
        WHERE pii.prep_item_id = r.prep_item_id
      ) / NULLIF(p.batch_yield_qty, 0)
    ) AS cost_bhd
  FROM recipes r
  JOIN prep_items p ON p.id = r.prep_item_id
  WHERE r.prep_item_id IS NOT NULL
  GROUP BY r.menu_item_slug
),
total_costs AS (
  SELECT menu_item_slug, SUM(cost_bhd) AS cost_bhd
  FROM (
    SELECT menu_item_slug, cost_bhd FROM ingredient_costs
    UNION ALL
    SELECT menu_item_slug, cost_bhd FROM prep_costs
  ) combined
  GROUP BY menu_item_slug
)
SELECT
  m.slug,
  m.name_ar,
  m.name_en,
  m.price_bhd                                                     AS selling_price,
  ROUND(COALESCE(tc.cost_bhd, 0), 4)                              AS cost_bhd,
  ROUND(COALESCE(m.price_bhd, 0) - COALESCE(tc.cost_bhd, 0), 4)  AS profit_bhd,
  CASE
    WHEN m.price_bhd > 0
    THEN ROUND(
      (COALESCE(m.price_bhd, 0) - COALESCE(tc.cost_bhd, 0)) / m.price_bhd * 100,
      2
    )
    ELSE NULL
  END                                                              AS margin_pct
FROM menu_items_sync m
LEFT JOIN total_costs tc ON tc.menu_item_slug = m.slug;

-- Materialized variance report (requires UNIQUE INDEX for CONCURRENTLY refresh)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_variance_report AS
WITH delivered AS (
  SELECT o.id AS order_id, o.branch_id, oi.menu_item_slug, oi.quantity
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status IN ('delivered','completed')
    AND o.created_at >= NOW() - INTERVAL '7 days'
),
theoretical AS (
  SELECT
    r.ingredient_id,
    d.branch_id,
    SUM(
      r.quantity * COALESCE(r.yield_factor, i.default_yield_factor, 1.000) * d.quantity
    ) AS theoretical_usage
  FROM delivered d
  JOIN recipes r ON r.menu_item_slug = d.menu_item_slug AND r.ingredient_id IS NOT NULL
  JOIN ingredients i ON i.id = r.ingredient_id
  GROUP BY r.ingredient_id, d.branch_id
),
actual AS (
  SELECT
    ingredient_id,
    branch_id,
    SUM(quantity) AS actual_usage
  FROM inventory_movements
  WHERE movement_type IN ('consumption','waste')
    AND performed_at >= NOW() - INTERVAL '7 days'
  GROUP BY ingredient_id, branch_id
)
SELECT
  i.id                                                 AS ingredient_id,
  i.name_ar,
  i.name_en,
  i.abc_class,
  COALESCE(t.branch_id, a.branch_id)                   AS branch_id,
  COALESCE(t.theoretical_usage, 0)                     AS theoretical_usage,
  COALESCE(a.actual_usage, 0)                          AS actual_usage,
  COALESCE(a.actual_usage, 0) - COALESCE(t.theoretical_usage, 0)  AS variance,
  CASE
    WHEN COALESCE(t.theoretical_usage, 0) != 0
    THEN ROUND(
      (COALESCE(a.actual_usage, 0) - COALESCE(t.theoretical_usage, 0))
      / t.theoretical_usage * 100,
      2
    )
    ELSE NULL
  END                                                  AS variance_pct,
  ROUND(
    ABS(COALESCE(a.actual_usage, 0) - COALESCE(t.theoretical_usage, 0))
    * i.cost_per_unit,
    3
  )                                                    AS variance_cost_bhd
FROM ingredients i
JOIN (
  SELECT ingredient_id, branch_id FROM theoretical
  UNION
  SELECT ingredient_id, branch_id FROM actual
) combined ON combined.ingredient_id = i.id
LEFT JOIN theoretical t
  ON t.ingredient_id = i.id AND t.branch_id = combined.branch_id
LEFT JOIN actual a
  ON a.ingredient_id = i.id AND a.branch_id = combined.branch_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_variance_report_pk
  ON mv_variance_report(ingredient_id, branch_id);

CREATE OR REPLACE VIEW v_vendor_performance AS
SELECT
  s.id,
  s.name_ar,
  s.name_en,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'received')   AS total_orders,
  COALESCE(
    SUM(poi.quantity_received * poi.unit_cost) FILTER (WHERE po.status = 'received'),
    0
  )                                                              AS total_spent_bhd,
  ROUND(
    AVG(
      CASE
        WHEN poi.quantity_ordered > 0
        THEN GREATEST(0, (1.0 - ABS(poi.quantity_variance) / poi.quantity_ordered)) * 100
        ELSE 100
      END
    ) FILTER (WHERE po.status = 'received'),
    2
  )                                                              AS delivery_accuracy_pct,
  ROUND(
    AVG(poi.quality_rating) FILTER (WHERE po.status = 'received' AND poi.quality_rating IS NOT NULL),
    2
  )                                                              AS avg_quality_rating,
  ROUND(
    AVG(
      CASE
        WHEN po.expected_at IS NOT NULL AND po.received_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (po.received_at - po.expected_at::TIMESTAMPTZ)) / 86400.0
        ELSE 0
      END
    ) FILTER (WHERE po.status = 'received'),
    2
  )                                                              AS avg_delay_days,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'cancelled')  AS cancelled_orders
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
GROUP BY s.id, s.name_ar, s.name_en;

CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT
  b.id                                                   AS branch_id,
  b.name_en                                              AS branch_name,
  i.category,
  COUNT(DISTINCT s.ingredient_id)                        AS ingredient_count,
  ROUND(SUM(s.on_hand * i.cost_per_unit), 3)             AS total_value_bhd,
  ROUND(SUM(s.reserved * i.cost_per_unit), 3)            AS reserved_value_bhd
FROM inventory_stock s
JOIN ingredients i ON i.id = s.ingredient_id
JOIN branches b ON b.id = s.branch_id
WHERE i.is_active = true
GROUP BY b.id, b.name_en, i.category;

-- ── 8. RLS POLICIES ───────────────────────────────────────────────────────────

-- ingredients
DROP POLICY IF EXISTS "ingredients_select_authenticated" ON ingredients;
CREATE POLICY "ingredients_select_authenticated"
  ON ingredients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ingredients_all_managers" ON ingredients;
CREATE POLICY "ingredients_all_managers"
  ON ingredients FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'));

-- ingredient_allergens
DROP POLICY IF EXISTS "allergens_select_authenticated" ON ingredient_allergens;
CREATE POLICY "allergens_select_authenticated"
  ON ingredient_allergens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "allergens_all_managers" ON ingredient_allergens;
CREATE POLICY "allergens_all_managers"
  ON ingredient_allergens FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'));

-- recipes
DROP POLICY IF EXISTS "recipes_select_authenticated" ON recipes;
CREATE POLICY "recipes_select_authenticated"
  ON recipes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recipes_all_managers" ON recipes;
CREATE POLICY "recipes_all_managers"
  ON recipes FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','kitchen'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','kitchen'));

-- prep_items
DROP POLICY IF EXISTS "prep_items_select_authenticated" ON prep_items;
CREATE POLICY "prep_items_select_authenticated"
  ON prep_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prep_items_all_managers" ON prep_items;
CREATE POLICY "prep_items_all_managers"
  ON prep_items FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'));

-- prep_item_ingredients
DROP POLICY IF EXISTS "prep_item_ingredients_select_authenticated" ON prep_item_ingredients;
CREATE POLICY "prep_item_ingredients_select_authenticated"
  ON prep_item_ingredients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prep_item_ingredients_all_managers" ON prep_item_ingredients;
CREATE POLICY "prep_item_ingredients_all_managers"
  ON prep_item_ingredients FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','kitchen','inventory_manager'));

-- inventory_stock (branch isolated)
DROP POLICY IF EXISTS "stock_select_branch_isolated" ON inventory_stock;
CREATE POLICY "stock_select_branch_isolated"
  ON inventory_stock FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "stock_insert_authenticated" ON inventory_stock;
CREATE POLICY "stock_insert_authenticated"
  ON inventory_stock FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "stock_update_authenticated" ON inventory_stock;
CREATE POLICY "stock_update_authenticated"
  ON inventory_stock FOR UPDATE TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

-- inventory_lots
DROP POLICY IF EXISTS "lots_select_branch_isolated" ON inventory_lots;
CREATE POLICY "lots_select_branch_isolated"
  ON inventory_lots FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "lots_insert_authenticated" ON inventory_lots;
CREATE POLICY "lots_insert_authenticated"
  ON inventory_lots FOR INSERT TO authenticated WITH CHECK (true);

-- inventory_movements (append-only)
DROP POLICY IF EXISTS "movements_select_branch_isolated" ON inventory_movements;
CREATE POLICY "movements_select_branch_isolated"
  ON inventory_movements FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "movements_insert_authenticated" ON inventory_movements;
CREATE POLICY "movements_insert_authenticated"
  ON inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "movements_no_update" ON inventory_movements;
CREATE POLICY "movements_no_update"
  ON inventory_movements FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "movements_no_delete" ON inventory_movements;
CREATE POLICY "movements_no_delete"
  ON inventory_movements FOR DELETE TO authenticated USING (false);

-- waste_log
DROP POLICY IF EXISTS "waste_log_select_branch_isolated" ON waste_log;
CREATE POLICY "waste_log_select_branch_isolated"
  ON waste_log FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "waste_log_insert_managers" ON waste_log;
CREATE POLICY "waste_log_insert_managers"
  ON waste_log FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','kitchen','inventory_manager')
  );

DROP POLICY IF EXISTS "waste_log_update_managers" ON waste_log;
CREATE POLICY "waste_log_update_managers"
  ON waste_log FOR UPDATE TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager')
    OR branch_id = auth_user_branch_id()
  );

-- purchase_orders
DROP POLICY IF EXISTS "po_select_branch_isolated" ON purchase_orders;
CREATE POLICY "po_select_branch_isolated"
  ON purchase_orders FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "po_all_managers" ON purchase_orders;
CREATE POLICY "po_all_managers"
  ON purchase_orders FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'));

-- purchase_order_items
DROP POLICY IF EXISTS "poi_all_authenticated" ON purchase_order_items;
CREATE POLICY "poi_all_authenticated"
  ON purchase_order_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- suppliers
DROP POLICY IF EXISTS "suppliers_select_authenticated" ON suppliers;
CREATE POLICY "suppliers_select_authenticated"
  ON suppliers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "suppliers_all_managers" ON suppliers;
CREATE POLICY "suppliers_all_managers"
  ON suppliers FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager'));

-- supplier_price_history
DROP POLICY IF EXISTS "sph_select_authenticated" ON supplier_price_history;
CREATE POLICY "sph_select_authenticated"
  ON supplier_price_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sph_insert_authenticated" ON supplier_price_history;
CREATE POLICY "sph_insert_authenticated"
  ON supplier_price_history FOR INSERT TO authenticated WITH CHECK (true);

-- inventory_alerts
DROP POLICY IF EXISTS "alerts_select_branch_isolated" ON inventory_alerts;
CREATE POLICY "alerts_select_branch_isolated"
  ON inventory_alerts FOR SELECT TO authenticated
  USING (
    branch_id IS NULL
    OR auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "alerts_update_branch_isolated" ON inventory_alerts;
CREATE POLICY "alerts_update_branch_isolated"
  ON inventory_alerts FOR UPDATE TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

-- par_levels
DROP POLICY IF EXISTS "par_levels_select_authenticated" ON par_levels;
CREATE POLICY "par_levels_select_authenticated"
  ON par_levels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "par_levels_all_managers" ON par_levels;
CREATE POLICY "par_levels_all_managers"
  ON par_levels FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'));

-- unit_conversions
DROP POLICY IF EXISTS "unit_conversions_select_authenticated" ON unit_conversions;
CREATE POLICY "unit_conversions_select_authenticated"
  ON unit_conversions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "unit_conversions_all_managers" ON unit_conversions;
CREATE POLICY "unit_conversions_all_managers"
  ON unit_conversions FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager'));

-- inventory_counts
DROP POLICY IF EXISTS "counts_select_branch_isolated" ON inventory_counts;
CREATE POLICY "counts_select_branch_isolated"
  ON inventory_counts FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "counts_insert_managers" ON inventory_counts;
CREATE POLICY "counts_insert_managers"
  ON inventory_counts FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager')
  );

DROP POLICY IF EXISTS "counts_update_managers" ON inventory_counts;
CREATE POLICY "counts_update_managers"
  ON inventory_counts FOR UPDATE TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager')
  );

-- inventory_transfers
DROP POLICY IF EXISTS "transfers_all_managers" ON inventory_transfers;
CREATE POLICY "transfers_all_managers"
  ON inventory_transfers FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'));

-- delivery_platform_mappings
DROP POLICY IF EXISTS "dpm_all_managers" ON delivery_platform_mappings;
CREATE POLICY "dpm_all_managers"
  ON delivery_platform_mappings FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','branch_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','branch_manager'));

-- service_role bypass policies for all new tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'suppliers','inventory_alerts','ingredients','ingredient_allergens',
    'supplier_price_history','prep_items','prep_item_ingredients','recipes',
    'inventory_stock','inventory_lots','inventory_movements','purchase_orders',
    'purchase_order_items','waste_log','inventory_counts','inventory_transfers',
    'par_levels','unit_conversions','delivery_platform_mappings'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "service_all_%1$s" ON %1$I;
       CREATE POLICY "service_all_%1$s" ON %1$I
         FOR ALL TO service_role USING (true) WITH CHECK (true);',
      tbl
    );
  END LOOP;
END;
$$;

-- ── 9. REALTIME PUBLICATION ───────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_alerts;
  END IF;
END;
$$;

-- ── 10. PG_CRON JOBS ──────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  -- 1. Refresh variance report — every hour
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-variance-report') THEN
    PERFORM cron.schedule(
      'refresh-variance-report',
      '0 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_variance_report'
    );
  END IF;

  -- 2. Escalate waste approvals — every 30 min
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalate-waste-approvals') THEN
    PERFORM cron.schedule(
      'escalate-waste-approvals',
      '*/30 * * * *',
      'SELECT rpc_escalate_waste_approvals()'
    );
  END IF;

  -- 3. Check expiry alerts — daily 6AM
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-expiry-alerts') THEN
    PERFORM cron.schedule(
      'check-expiry-alerts',
      '0 6 * * *',
      $sql$
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      SELECT
        l.branch_id,
        l.ingredient_id,
        'expiring_soon',
        'warning',
        'Lot expiring within 3 days: ' || COALESCE(l.lot_number, l.id::TEXT),
        jsonb_build_object('lot_id', l.id, 'expires_at', l.expires_at, 'quantity_remaining', l.quantity_remaining)
      FROM inventory_lots l
      WHERE NOT l.is_exhausted
        AND l.expires_at IS NOT NULL
        AND l.expires_at <= CURRENT_DATE + 3
        AND NOT EXISTS (
          SELECT 1 FROM inventory_alerts a
          WHERE a.ingredient_id = l.ingredient_id
            AND a.branch_id = l.branch_id
            AND a.alert_type = 'expiring_soon'
            AND a.created_at >= NOW() - INTERVAL '24 hours'
        )
      $sql$
    );
  END IF;

  -- 4. Auto-generate purchase orders — daily 6AM
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-generate-pos') THEN
    PERFORM cron.schedule(
      'auto-generate-pos',
      '5 6 * * *',
      'SELECT rpc_auto_generate_pos()'
    );
  END IF;

  -- 5. Update ABC classification — weekly Monday 3AM
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-abc-classification') THEN
    PERFORM cron.schedule(
      'update-abc-classification',
      '0 3 * * 1',
      'SELECT rpc_update_abc_classification()'
    );
  END IF;

  -- 6. Check overstock — daily 8AM
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-overstock') THEN
    PERFORM cron.schedule(
      'check-overstock',
      '0 8 * * *',
      $sql$
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      SELECT
        s.branch_id,
        s.ingredient_id,
        'overstock',
        'warning',
        'Stock exceeds maximum level',
        jsonb_build_object('on_hand', s.on_hand, 'max_stock_level', COALESCE(s.max_stock_level, i.max_stock_level))
      FROM inventory_stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.on_hand > COALESCE(s.max_stock_level, i.max_stock_level, 99999999)
        AND COALESCE(s.max_stock_level, i.max_stock_level) IS NOT NULL
        AND i.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM inventory_alerts a
          WHERE a.ingredient_id = s.ingredient_id
            AND a.branch_id = s.branch_id
            AND a.alert_type = 'overstock'
            AND a.created_at >= NOW() - INTERVAL '24 hours'
        )
      $sql$
    );
  END IF;

  -- 7. Check dead stock — weekly Monday 9AM
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-dead-stock') THEN
    PERFORM cron.schedule(
      'check-dead-stock',
      '0 9 * * 1',
      $sql$
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      SELECT
        s.branch_id,
        s.ingredient_id,
        'dead_stock',
        'warning',
        'No stock movement for 30+ days',
        jsonb_build_object(
          'on_hand', s.on_hand,
          'last_movement_at', s.last_movement_at,
          'days_inactive', EXTRACT(DAY FROM NOW() - s.last_movement_at)
        )
      FROM inventory_stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.on_hand > 0
        AND i.is_active = true
        AND (s.last_movement_at IS NULL OR s.last_movement_at < NOW() - INTERVAL '30 days')
        AND NOT EXISTS (
          SELECT 1 FROM inventory_alerts a
          WHERE a.ingredient_id = s.ingredient_id
            AND a.branch_id = s.branch_id
            AND a.alert_type = 'dead_stock'
            AND a.created_at >= NOW() - INTERVAL '24 hours'
        )
      $sql$
    );
  END IF;
END;
$$;

-- ── VERIFICATION (run after applying migration) ────────────────────────────────
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
--   'ingredients','supplier_price_history','prep_items','prep_item_ingredients',
--   'recipes','inventory_stock','inventory_lots','inventory_movements',
--   'purchase_orders','purchase_order_items','waste_log','inventory_counts',
--   'inventory_transfers','par_levels','unit_conversions','suppliers',
--   'inventory_alerts','delivery_platform_mappings'
-- );
-- SELECT typname FROM pg_type WHERE typname IN ('inventory_movement_type','abc_class');
-- SELECT trigger_name FROM information_schema.triggers WHERE trigger_name IN (
--   'trg_inventory_reserve','trg_inventory_finalize','trg_waste_deduct','trg_po_receive_create_lot'
-- );
-- SELECT proname FROM pg_proc WHERE proname LIKE 'rpc_%' OR proname LIKE 'fn_%';
-- SELECT jobname FROM cron.job;
-- SELECT relname FROM pg_class c
--   JOIN pg_tables t ON t.tablename = c.relname
--   WHERE t.schemaname = 'public'
--     AND NOT c.relrowsecurity
--     AND t.tablename IN (
--       'ingredients','inventory_stock','inventory_lots','waste_log',
--       'inventory_movements','purchase_orders','suppliers','inventory_alerts'
--     );
-- Last query must return 0 rows (all tables have RLS enabled)
