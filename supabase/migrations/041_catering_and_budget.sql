-- ============================================================
-- Kahramana Baghdad — Catering & Budget Schema
-- Migration: 041_catering_and_budget.sql
-- Date: 2026-05-02
-- Safe to re-run: all DDL uses IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

-- ── 1. TABLES ─────────────────────────────────────────────────────────────────

-- catering_packages
CREATE TABLE IF NOT EXISTS catering_packages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             TEXT        NOT NULL REFERENCES branches(id),
  name_ar               TEXT        NOT NULL,
  name_en               TEXT        NOT NULL,
  description_ar        TEXT,
  description_en        TEXT,
  min_guests            INTEGER     NOT NULL DEFAULT 10 CHECK (min_guests >= 1),
  max_guests            INTEGER     CHECK (max_guests IS NULL OR max_guests >= min_guests),
  price_per_person_bhd  NUMERIC(10,3) NOT NULL CHECK (price_per_person_bhd >= 0),
  -- JSONB array of { menu_item_slug, qty_per_person, name_ar, name_en }
  items                 JSONB       NOT NULL DEFAULT '[]',
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE catering_packages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_catering_packages_branch
  ON catering_packages(branch_id, is_active);

-- catering_orders
CREATE TABLE IF NOT EXISTS catering_orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             TEXT        NOT NULL REFERENCES branches(id),
  package_id            UUID        REFERENCES catering_packages(id),
  event_date            DATE        NOT NULL,
  event_time            TIME,
  venue_name            TEXT,
  venue_address         TEXT,
  guest_count           INTEGER     NOT NULL CHECK (guest_count >= 1),
  client_name           TEXT        NOT NULL,
  client_phone          TEXT        NOT NULL,
  client_email          TEXT,
  price_per_person_bhd  NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (price_per_person_bhd >= 0),
  subtotal_bhd          NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (subtotal_bhd >= 0),
  deposit_bhd           NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (deposit_bhd >= 0),
  deposit_paid          BOOLEAN     NOT NULL DEFAULT false,
  status                TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','quoted','confirmed','prep_started','delivered','invoiced','cancelled'
  )),
  -- JSONB snapshot populated by rpc_catering_calc_ingredients
  ingredients_snapshot  JSONB,
  linked_po_id          UUID        REFERENCES purchase_orders(id),
  notes                 TEXT,
  created_by            UUID        REFERENCES staff_basic(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE catering_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_catering_orders_branch_date
  ON catering_orders(branch_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_catering_orders_status
  ON catering_orders(status, branch_id);
CREATE INDEX IF NOT EXISTS idx_catering_orders_package
  ON catering_orders(package_id);

-- inventory_budgets
CREATE TABLE IF NOT EXISTS inventory_budgets (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             TEXT        NOT NULL REFERENCES branches(id),
  year                  INTEGER     NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  month                 INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  purchase_budget_bhd   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (purchase_budget_bhd >= 0),
  food_cost_target_pct  NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (food_cost_target_pct BETWEEN 0 AND 100),
  waste_budget_bhd      NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (waste_budget_bhd >= 0),
  created_by            UUID        REFERENCES staff_basic(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, year, month)
);
ALTER TABLE inventory_budgets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inventory_budgets_branch_period
  ON inventory_budgets(branch_id, year, month);

-- ── 2. TRIGGER: updated_at auto-maintenance ────────────────────────────────────

-- fn_set_updated_at may already exist from another migration; CREATE OR REPLACE is safe.
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catering_packages_updated_at ON catering_packages;
CREATE TRIGGER trg_catering_packages_updated_at
  BEFORE UPDATE ON catering_packages
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_catering_orders_updated_at ON catering_orders;
CREATE TRIGGER trg_catering_orders_updated_at
  BEFORE UPDATE ON catering_orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_budgets_updated_at ON inventory_budgets;
CREATE TRIGGER trg_inventory_budgets_updated_at
  BEFORE UPDATE ON inventory_budgets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 3. RPCs ───────────────────────────────────────────────────────────────────

-- rpc_catering_calc_ingredients
-- Iterates over the package's items JSONB, joins recipes → ingredients,
-- calculates per-person quantities factoring in yield, multiplies by guest_count,
-- saves the snapshot to catering_orders.ingredients_snapshot, and returns the JSONB array.
CREATE OR REPLACE FUNCTION rpc_catering_calc_ingredients(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order           RECORD;
  v_package         RECORD;
  v_item            JSONB;
  v_slug            TEXT;
  v_qty_per_person  NUMERIC;
  v_raw_results     JSONB := '[]';
  v_results         JSONB;
  rec               RECORD;
  v_qty_total       NUMERIC;
BEGIN
  -- Load order
  SELECT * INTO v_order
  FROM catering_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATERING_ORDER_NOT_FOUND' USING ERRCODE = 'P0010';
  END IF;

  IF v_order.package_id IS NULL THEN
    RAISE EXCEPTION 'CATERING_ORDER_NO_PACKAGE' USING ERRCODE = 'P0011';
  END IF;

  -- Load package
  SELECT * INTO v_package
  FROM catering_packages
  WHERE id = v_order.package_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATERING_PACKAGE_NOT_FOUND' USING ERRCODE = 'P0012';
  END IF;

  -- Iterate package items; build flat list (duplicates collapsed in next step)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_package.items)
  LOOP
    v_slug           := v_item->>'menu_item_slug';
    v_qty_per_person := (v_item->>'qty_per_person')::NUMERIC;

    FOR rec IN
      SELECT
        r.ingredient_id,
        ing.name_ar,
        ing.name_en,
        ing.unit,
        r.quantity
          * COALESCE(r.yield_factor, ing.default_yield_factor, 1.000)
          AS qty_per_serving
      FROM recipes r
      JOIN ingredients ing ON ing.id = r.ingredient_id
      WHERE r.menu_item_slug = v_slug
        AND r.ingredient_id IS NOT NULL
    LOOP
      v_qty_total := rec.qty_per_serving * v_qty_per_person * v_order.guest_count;

      v_raw_results := v_raw_results || jsonb_build_array(
        jsonb_build_object(
          'ingredient_id', rec.ingredient_id,
          'name_ar',       rec.name_ar,
          'name_en',       rec.name_en,
          'qty_needed',    ROUND(v_qty_total, 4),
          'unit',          rec.unit
        )
      );
    END LOOP;
  END LOOP;

  -- Aggregate: collapse duplicate ingredient_id rows by summing qty_needed
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ingredient_id', agg.ingredient_id,
      'name_ar',       agg.name_ar,
      'name_en',       agg.name_en,
      'qty_needed',    ROUND(agg.qty_needed, 4),
      'unit',          agg.unit
    )
    ORDER BY agg.name_ar
  ), '[]'::JSONB)
  INTO v_results
  FROM (
    SELECT
      (elem->>'ingredient_id')::UUID           AS ingredient_id,
      MAX(elem->>'name_ar')                    AS name_ar,
      MAX(elem->>'name_en')                    AS name_en,
      SUM((elem->>'qty_needed')::NUMERIC)      AS qty_needed,
      MAX(elem->>'unit')                       AS unit
    FROM jsonb_array_elements(v_raw_results) AS elem
    GROUP BY (elem->>'ingredient_id')::UUID
  ) agg;

  -- Persist snapshot
  UPDATE catering_orders
  SET ingredients_snapshot = v_results,
      updated_at            = NOW()
  WHERE id = p_order_id;

  RETURN v_results;
END;
$$;

-- rpc_catering_confirm
-- Validates status, calculates ingredients, optionally creates a draft purchase_order
-- with items, updates catering_order to 'confirmed', and returns the PO UUID or NULL.
CREATE OR REPLACE FUNCTION rpc_catering_confirm(
  p_order_id    UUID,
  p_supplier_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order     RECORD;
  v_snapshot  JSONB;
  v_po_id     UUID := NULL;
  v_item      JSONB;
  v_ing_id    UUID;
  v_qty       NUMERIC;
  v_unit_cost NUMERIC;
BEGIN
  -- Load and validate order
  SELECT * INTO v_order
  FROM catering_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATERING_ORDER_NOT_FOUND' USING ERRCODE = 'P0010';
  END IF;

  IF v_order.status NOT IN ('draft', 'quoted') THEN
    RAISE EXCEPTION 'CATERING_ORDER_INVALID_STATUS: %', v_order.status
      USING ERRCODE = 'P0013';
  END IF;

  -- Calculate and snapshot ingredients
  v_snapshot := rpc_catering_calc_ingredients(p_order_id);

  -- Optionally create a draft purchase order
  IF p_supplier_id IS NOT NULL THEN
    INSERT INTO purchase_orders (
      branch_id,
      supplier_id,
      status,
      is_auto_generated,
      expected_at,
      notes,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      v_order.branch_id,
      p_supplier_id,
      'draft',
      true,
      v_order.event_date - INTERVAL '2 days',
      'طلب شراء مرتبط بطلب تقديم رقم: ' || p_order_id::TEXT,
      auth.uid()::UUID,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_po_id;

    -- Insert PO line items derived from the ingredients snapshot
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_snapshot)
    LOOP
      v_ing_id := (v_item->>'ingredient_id')::UUID;
      v_qty    := (v_item->>'qty_needed')::NUMERIC;

      SELECT cost_per_unit INTO v_unit_cost
      FROM ingredients
      WHERE id = v_ing_id;

      INSERT INTO purchase_order_items (
        purchase_order_id,
        ingredient_id,
        quantity_ordered,
        unit_cost
      ) VALUES (
        v_po_id,
        v_ing_id,
        v_qty,
        COALESCE(v_unit_cost, 0)
      );
    END LOOP;
  END IF;

  -- Confirm the order
  UPDATE catering_orders
  SET
    status       = 'confirmed',
    linked_po_id = v_po_id,
    updated_at   = NOW()
  WHERE id = p_order_id;

  RETURN v_po_id;
END;
$$;

-- rpc_budget_vs_actual
-- Returns a single row comparing budget targets against actuals
-- (PO spend, waste, revenue, COGS) for the given branch/year/month.
CREATE OR REPLACE FUNCTION rpc_budget_vs_actual(
  p_branch_id TEXT,
  p_year      INT,
  p_month     INT
)
RETURNS TABLE (
  branch_id             TEXT,
  year                  INT,
  month                 INT,
  purchase_budget_bhd   NUMERIC,
  food_cost_target_pct  NUMERIC,
  waste_budget_bhd      NUMERIC,
  actual_spend_bhd      NUMERIC,
  actual_waste_bhd      NUMERIC,
  actual_revenue_bhd    NUMERIC,
  actual_cogs_bhd       NUMERIC,
  actual_food_cost_pct  NUMERIC,
  spend_variance_bhd    NUMERIC,
  spend_pct_used        NUMERIC,
  waste_variance_bhd    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end   TIMESTAMPTZ;
  v_budget_purchase  NUMERIC;
  v_budget_fc_target NUMERIC;
  v_budget_waste     NUMERIC;
  v_spend        NUMERIC;
  v_waste        NUMERIC;
  v_revenue      NUMERIC;
  v_cogs         NUMERIC;
BEGIN
  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  -- Budget row (defaults if not configured)
  SELECT
    COALESCE(ib.purchase_budget_bhd,  0),
    COALESCE(ib.food_cost_target_pct, 30),
    COALESCE(ib.waste_budget_bhd,     0)
  INTO v_budget_purchase, v_budget_fc_target, v_budget_waste
  FROM (SELECT 1) dummy
  LEFT JOIN inventory_budgets ib
    ON ib.branch_id = p_branch_id
   AND ib.year      = p_year
   AND ib.month     = p_month;

  -- PO actual spend: received/partial POs in period
  SELECT COALESCE(SUM(poi.quantity_received * poi.unit_cost), 0) INTO v_spend
  FROM purchase_orders po
  JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
  WHERE po.branch_id  = p_branch_id
    AND po.status     IN ('received', 'partial')
    AND po.received_at >= v_period_start
    AND po.received_at <  v_period_end;

  -- Actual waste cost: approved entries in period, cost from ingredients.cost_per_unit
  SELECT COALESCE(SUM(wl.quantity * ing.cost_per_unit), 0) INTO v_waste
  FROM waste_log wl
  JOIN ingredients ing ON ing.id = wl.ingredient_id
  WHERE wl.branch_id   = p_branch_id
    AND wl.approved_by IS NOT NULL
    AND wl.reported_at >= v_period_start
    AND wl.reported_at <  v_period_end;

  -- Revenue: delivered/completed orders in period
  SELECT COALESCE(SUM(o.total_bhd), 0) INTO v_revenue
  FROM orders o
  WHERE o.branch_id  = p_branch_id
    AND o.status     IN ('delivered', 'completed')
    AND o.created_at >= v_period_start
    AND o.created_at <  v_period_end;

  -- COGS: consumption movements in period
  SELECT COALESCE(SUM(im.quantity * ing.cost_per_unit), 0) INTO v_cogs
  FROM inventory_movements im
  JOIN ingredients ing ON ing.id = im.ingredient_id
  WHERE im.branch_id     = p_branch_id
    AND im.movement_type = 'consumption'
    AND im.performed_at  >= v_period_start
    AND im.performed_at  <  v_period_end;

  RETURN QUERY SELECT
    p_branch_id                                                 AS branch_id,
    p_year                                                      AS year,
    p_month                                                     AS month,
    ROUND(v_budget_purchase,  3)                                AS purchase_budget_bhd,
    ROUND(v_budget_fc_target, 2)                                AS food_cost_target_pct,
    ROUND(v_budget_waste,     3)                                AS waste_budget_bhd,
    ROUND(v_spend,   3)                                         AS actual_spend_bhd,
    ROUND(v_waste,   3)                                         AS actual_waste_bhd,
    ROUND(v_revenue, 3)                                         AS actual_revenue_bhd,
    ROUND(v_cogs,    3)                                         AS actual_cogs_bhd,
    CASE
      WHEN v_revenue > 0
      THEN ROUND((v_cogs / v_revenue) * 100, 2)
      ELSE 0::NUMERIC
    END                                                         AS actual_food_cost_pct,
    ROUND(v_spend - v_budget_purchase, 3)                       AS spend_variance_bhd,
    CASE
      WHEN v_budget_purchase > 0
      THEN ROUND((v_spend / v_budget_purchase) * 100, 2)
      ELSE NULL
    END                                                         AS spend_pct_used,
    ROUND(v_waste - v_budget_waste, 3)                          AS waste_variance_bhd;
END;
$$;

-- rpc_budget_trend
-- Returns one rpc_budget_vs_actual row for each month 1–12 of the given year.
CREATE OR REPLACE FUNCTION rpc_budget_trend(
  p_branch_id TEXT,
  p_year      INT
)
RETURNS TABLE (
  branch_id             TEXT,
  year                  INT,
  month                 INT,
  purchase_budget_bhd   NUMERIC,
  food_cost_target_pct  NUMERIC,
  waste_budget_bhd      NUMERIC,
  actual_spend_bhd      NUMERIC,
  actual_waste_bhd      NUMERIC,
  actual_revenue_bhd    NUMERIC,
  actual_cogs_bhd       NUMERIC,
  actual_food_cost_pct  NUMERIC,
  spend_variance_bhd    NUMERIC,
  spend_pct_used        NUMERIC,
  waste_variance_bhd    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_month INT;
BEGIN
  FOR v_month IN 1..12
  LOOP
    RETURN QUERY
      SELECT * FROM rpc_budget_vs_actual(p_branch_id, p_year, v_month);
  END LOOP;
END;
$$;

-- ── 4. RLS POLICIES ───────────────────────────────────────────────────────────

-- catering_packages
DROP POLICY IF EXISTS "catering_packages_select_authenticated" ON catering_packages;
CREATE POLICY "catering_packages_select_authenticated"
  ON catering_packages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "catering_packages_all_managers" ON catering_packages;
CREATE POLICY "catering_packages_all_managers"
  ON catering_packages FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager'));

-- catering_orders (branch-isolated)
DROP POLICY IF EXISTS "catering_orders_select_branch_isolated" ON catering_orders;
CREATE POLICY "catering_orders_select_branch_isolated"
  ON catering_orders FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "catering_orders_insert_managers" ON catering_orders;
CREATE POLICY "catering_orders_insert_managers"
  ON catering_orders FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager')
  );

DROP POLICY IF EXISTS "catering_orders_update_managers" ON catering_orders;
CREATE POLICY "catering_orders_update_managers"
  ON catering_orders FOR UPDATE TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager','inventory_manager')
    AND (
      auth_user_role()::text IN ('owner','general_manager')
      OR branch_id = auth_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "catering_orders_delete_managers" ON catering_orders;
CREATE POLICY "catering_orders_delete_managers"
  ON catering_orders FOR DELETE TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager','branch_manager')
    AND status IN ('draft','cancelled')
  );

-- inventory_budgets (owner/gm write; branch managers read own branch)
DROP POLICY IF EXISTS "budgets_select_branch_isolated" ON inventory_budgets;
CREATE POLICY "budgets_select_branch_isolated"
  ON inventory_budgets FOR SELECT TO authenticated
  USING (
    auth_user_role()::text IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

DROP POLICY IF EXISTS "budgets_all_senior_managers" ON inventory_budgets;
CREATE POLICY "budgets_all_senior_managers"
  ON inventory_budgets FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager'));

-- service_role bypass for all three new tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'catering_packages', 'catering_orders', 'inventory_budgets'
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

-- ── 5. DEFERRED FK: inventory_movements.catering_order_id ─────────────────────
-- catering_order_id was added as an untyped UUID in migration 035.
-- Wire the FK now that catering_orders exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_movements_catering_order'
      AND table_name       = 'inventory_movements'
  ) THEN
    ALTER TABLE inventory_movements
      ADD CONSTRAINT fk_movements_catering_order
      FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id);
  END IF;
END;
$$;
