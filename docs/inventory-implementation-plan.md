# خطة تنفيذ نظام المخزون — كهرمنة بغداد
> الحالة: جاهزة للتنفيذ | تحتاج: بيانات الوصفات (يُدخلها صاحب المطعم عبر Excel Import)
> المرجع التقني: `restaurant-inventory-system.md` (في جذر المشروع)
> آخر تحديث: أبريل 2026

---

## نظرة عامة

```
Phase 1 — Migration 029        (أسبوع 1)   → قاعدة البيانات الكاملة
Phase 2 — Excel Import         (أسبوع 1)   → صاحب المطعم يرفع بياناته
Phase 3 — Core UI              (أسبوع 2)   → عرض + إدخال يدوي
Phase 4 — Workflows            (أسبوع 3)   → هدر + جرد + مشتريات
Phase 5 — Reports              (أسبوع 4)   → COGS + Variance + Alerts
Phase 6 — Dashboard Integration(أسبوع 4)   → ربط مع الطلبات والـ KPIs
```

**المبدأ الأساسي:** النظام يُسلَّم فارغاً. صاحب المطعم يملأ البيانات عبر Excel Import.
بمجرد رفع أول وصفة، الـ triggers تبدأ تعمل تلقائياً.

---

## Phase 1 — Migration 029

**الملف:** `supabase/migrations/029_inventory_core.sql`

### الترتيب الإجباري داخل الملف

```sql
-- 1. ENUMs أولاً (يُستخدم في الجداول)
-- 2. جداول مستقلة (لا FKs): suppliers, inventory_alerts
-- 3. ingredients (يعتمد على suppliers)
-- 4. recipes (يعتمد على ingredients + menu_items_sync)
-- 5. inventory_stock (يعتمد على ingredients + branches)
-- 6. inventory_movements (يعتمد على كل شيء)
-- 7. purchase_orders + purchase_order_items
-- 8. waste_log
-- 9. inventory_counts
-- 10. inventory_transfers
-- 11. order_source guard على orders
-- 12. Functions + Triggers
-- 13. RPCs
-- 14. RLS Policies
-- 15. Indexes
-- 16. pg_cron jobs
```

### 1.1 — ENUMs

```sql
CREATE TYPE inventory_movement_type AS ENUM (
  'reservation',    -- حجز عند إنشاء الطلب
  'consumption',    -- استهلاك عند التوصيل
  'release',        -- إفراج عند الإلغاء
  'purchase',       -- استلام مشتريات
  'count_adjust',   -- تعديل جرد
  'waste',          -- هدر/تلف
  'transfer_in',    -- استلام تحويل من فرع
  'transfer_out'    -- إرسال تحويل لفرع
);
```

### 1.2 — جدول `suppliers`

```sql
CREATE TABLE suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar         TEXT NOT NULL,
  name_en         TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  lead_time_days  INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
```

### 1.3 — جدول `inventory_alerts`

```sql
-- يُنشأ قبل triggers لأن fn_inventory_reserve يكتب فيه
CREATE TABLE inventory_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID REFERENCES branches(id),
  ingredient_id UUID,  -- FK يُضاف بعد ingredients
  alert_type    TEXT NOT NULL CHECK (alert_type IN (
    'low_stock', 'out_of_stock', 'high_waste',
    'variance_warning', 'variance_critical',
    'unmapped_item', 'expiring_soon',
    'theft_suspected', 'po_overdue', 'cost_spike'
  )),
  severity      TEXT NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('info','warning','critical')),
  message       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_alerts;
```

### 1.4 — جدول `ingredients`

```sql
CREATE TABLE ingredients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar              TEXT NOT NULL,
  name_en              TEXT NOT NULL,
  unit                 TEXT NOT NULL CHECK (unit IN ('g','kg','ml','l','unit','tbsp','tsp')),
  cost_per_unit        NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  default_yield_factor NUMERIC(5,3) NOT NULL DEFAULT 1.000 CHECK (default_yield_factor >= 1.000),
  category             TEXT CHECK (category IN (
    'protein','grain','vegetable','dairy',
    'spice','oil','beverage','packaging','other'
  )),
  reorder_point        NUMERIC(12,4),
  supplier_id          UUID REFERENCES suppliers(id),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- FK المؤجل على inventory_alerts
ALTER TABLE inventory_alerts
  ADD CONSTRAINT fk_alerts_ingredient
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id);
```

### 1.5 — جدول `recipes`

```sql
CREATE TABLE recipes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_slug TEXT NOT NULL REFERENCES menu_items_sync(slug) ON DELETE CASCADE,
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity       NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  is_optional    BOOLEAN NOT NULL DEFAULT false,
  variant_key    TEXT,          -- NULL=مشترك | 'size:small' | 'size:large' | 'variant:with_broth'
  yield_factor   NUMERIC(5,3)  CHECK (yield_factor IS NULL OR yield_factor >= 1.000),
  notes          TEXT,
  updated_by     UUID REFERENCES staff_basic(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PostgreSQL 15+: يمنع تكرار المكوّن المشترك (variant_key=NULL)
  UNIQUE NULLS NOT DISTINCT (menu_item_slug, ingredient_id, variant_key)
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
```

### 1.6 — جدول `inventory_stock`

```sql
CREATE TABLE inventory_stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  ingredient_id    UUID NOT NULL REFERENCES ingredients(id),
  on_hand          NUMERIC(14,4) NOT NULL DEFAULT 0,
  reserved         NUMERIC(14,4) NOT NULL DEFAULT 0,
  reorder_point    NUMERIC(14,4),  -- override لـ reorder_point في ingredients
  last_movement_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (branch_id, ingredient_id),
  CHECK (on_hand >= 0),
  CHECK (reserved >= 0),
  CHECK (reserved <= on_hand)
);
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
```

### 1.7 — جدول `inventory_movements`

```sql
CREATE TABLE inventory_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id),
  movement_type     inventory_movement_type NOT NULL,
  quantity          NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  order_id          UUID REFERENCES orders(id),
  order_item_id     UUID REFERENCES order_items(id),
  purchase_order_id UUID,  -- FK يُضاف بعد purchase_orders
  waste_log_id      UUID,  -- FK يُضاف بعد waste_log
  performed_by      UUID REFERENCES staff_basic(id),
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes             TEXT
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
```

### 1.8 — جداول المشتريات

```sql
CREATE TABLE purchase_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','confirmed','partial','received','cancelled'
  )),
  expected_at DATE,
  received_at TIMESTAMPTZ,
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES staff_basic(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id),
  quantity_ordered  NUMERIC(14,4) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- FKs المؤجلة
ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_movements_po
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
```

### 1.9 — جدول `waste_log`

```sql
CREATE TABLE waste_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity      NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  reason        TEXT NOT NULL CHECK (reason IN (
    'expired','damaged','spillage','overproduction',
    'quality','returned','theft_suspected','other'
  )),
  cost_bhd      NUMERIC(12,3) NOT NULL DEFAULT 0,
  notes         TEXT,
  photo_url     TEXT,
  reported_by   UUID NOT NULL REFERENCES staff_basic(id),
  approved_by   UUID REFERENCES staff_basic(id),
  approved_at   TIMESTAMPTZ,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

-- FK المؤجل
ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_movements_waste
  FOREIGN KEY (waste_log_id) REFERENCES waste_log(id);
```

### 1.10 — جدولا الجرد والتحويلات

```sql
CREATE TABLE inventory_counts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  counted_by    UUID NOT NULL REFERENCES staff_basic(id),
  verified_by   UUID REFERENCES staff_basic(id),
  system_qty    NUMERIC(14,4) NOT NULL,
  actual_qty    NUMERIC(14,4) NOT NULL,
  variance      NUMERIC(14,4) GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
  approved_by   UUID REFERENCES staff_basic(id),
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  counted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;

CREATE TABLE inventory_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id UUID NOT NULL REFERENCES branches(id),
  to_branch_id   UUID NOT NULL REFERENCES branches(id),
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id),
  quantity       NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_transit','received','cancelled')),
  transferred_by UUID NOT NULL REFERENCES staff_basic(id),
  received_by    UUID REFERENCES staff_basic(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at    TIMESTAMPTZ,
  notes          TEXT,

  CHECK (from_branch_id != to_branch_id)
);
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
```

### 1.11 — order_source Guard

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'order_source'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'website'
      CHECK (order_source IN (
        'website','walk_in','talabat','jahez','keeta','phone','other'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'staff_basic'
      AND column_name  = 'staff_role'
  ) THEN
    ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'inventory_manager';
  END IF;
END $$;
```

### 1.12 — Triggers

```sql
-- ── Trigger 1: الحجز عند إنشاء الطلب ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_inventory_reserve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_branch_id UUID;
  r           RECORD;
  v_required  NUMERIC;
BEGIN
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: order_id=%', NEW.order_id
      USING ERRCODE = 'P0003';
  END IF;

  FOR r IN
    SELECT rec.ingredient_id,
           rec.quantity
             * COALESCE(rec.yield_factor, ing.default_yield_factor, 1.000)
             AS qty_per_unit
    FROM recipes rec
    JOIN ingredients ing ON ing.id = rec.ingredient_id
    WHERE rec.menu_item_slug = NEW.menu_item_slug
      AND (rec.variant_key IS NULL
           OR rec.variant_key = COALESCE(NEW.selected_variant, NEW.size))
  LOOP
    v_required := r.qty_per_unit * NEW.qty;

    UPDATE inventory_stock
       SET reserved         = reserved + v_required,
           last_movement_at = NOW()
     WHERE branch_id    = v_branch_id
       AND ingredient_id = r.ingredient_id
       AND (on_hand - reserved) >= v_required;

    IF NOT FOUND THEN
      IF NOT EXISTS (
        SELECT 1 FROM inventory_stock
        WHERE branch_id = v_branch_id AND ingredient_id = r.ingredient_id
      ) THEN
        RAISE EXCEPTION 'MISSING_STOCK_RECORD: ingredient=% branch=%',
          r.ingredient_id, v_branch_id USING ERRCODE = 'P0002';
      ELSE
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: ingredient=% required=% branch=%',
          r.ingredient_id, v_required, v_branch_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    INSERT INTO inventory_movements
      (branch_id, ingredient_id, movement_type, quantity, order_id, order_item_id)
    VALUES
      (v_branch_id, r.ingredient_id, 'reservation', v_required, NEW.order_id, NEW.id);
  END LOOP;

  -- تسجيل تحذير للأصناف بدون وصفة
  IF NOT EXISTS (SELECT 1 FROM recipes WHERE menu_item_slug = NEW.menu_item_slug) THEN
    INSERT INTO inventory_alerts (branch_id, alert_type, severity, message)
    VALUES (v_branch_id, 'unmapped_item', 'info',
      format('Item "%s" has no recipe — inventory not tracked', NEW.menu_item_slug));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_reserve
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_inventory_reserve();


-- ── Trigger 2: الاستهلاك/الإفراج عند تغيير حالة الطلب ──────────────────
CREATE OR REPLACE FUNCTION fn_inventory_finalize_or_release()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m      RECORD;
  v_type inventory_movement_type;
BEGIN
  IF NEW.status IN ('delivered','completed') THEN
    v_type := 'consumption';
  ELSIF NEW.status = 'cancelled' THEN
    v_type := 'release';
  ELSE
    RETURN NEW;
  END IF;

  FOR m IN
    SELECT ingredient_id, SUM(quantity) AS total_qty
    FROM inventory_movements
    WHERE order_id = NEW.id AND movement_type = 'reservation'
    GROUP BY ingredient_id
  LOOP
    UPDATE inventory_stock
       SET reserved         = reserved - m.total_qty,
           on_hand          = CASE WHEN v_type = 'consumption'
                                   THEN on_hand - m.total_qty
                                   ELSE on_hand END,
           last_movement_at = NOW()
     WHERE branch_id    = NEW.branch_id
       AND ingredient_id = m.ingredient_id;

    INSERT INTO inventory_movements
      (branch_id, ingredient_id, movement_type, quantity, order_id)
    VALUES
      (NEW.branch_id, m.ingredient_id, v_type, m.total_qty, NEW.id);
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_finalize
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('delivered','completed','cancelled')
    AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION fn_inventory_finalize_or_release();


-- ── Trigger 3: خصم الهدر عند الموافقة ───────────────────────────────────
CREATE OR REPLACE FUNCTION fn_waste_deduct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- لا تخصم إلا عند الموافقة (approved_by يُملأ)
  IF NEW.approved_by IS NULL THEN RETURN NEW; END IF;
  IF OLD.approved_by IS NOT NULL THEN RETURN NEW; END IF; -- لا تخصم مرتين

  UPDATE inventory_stock
     SET on_hand          = on_hand - NEW.quantity,
         last_movement_at = NOW()
   WHERE branch_id    = NEW.branch_id
     AND ingredient_id = NEW.ingredient_id;

  INSERT INTO inventory_movements
    (branch_id, ingredient_id, movement_type, quantity, waste_log_id, performed_by)
  VALUES
    (NEW.branch_id, NEW.ingredient_id, 'waste', NEW.quantity, NEW.id, NEW.approved_by);

  -- تنبيه فوري للـ Owner عند اشتباه سرقة
  IF NEW.reason = 'theft_suspected' THEN
    INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message)
    VALUES (NEW.branch_id, NEW.ingredient_id, 'theft_suspected', 'critical',
      format('⚠️ اشتباه سرقة: %s kg من المكوّن — بلّغ فوراً', NEW.quantity));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_waste_deduct
  AFTER UPDATE OF approved_by ON waste_log
  FOR EACH ROW EXECUTE FUNCTION fn_waste_deduct();
```

### 1.13 — RPCs

```sql
-- ── RPC 1: فحص المخزون قبل الدفع ────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_check_stock_for_cart(
  p_branch_id UUID,
  p_items     JSONB   -- [{ slug, qty, size? }]
)
RETURNS TABLE (
  menu_item_slug        TEXT,
  available             BOOLEAN,
  shortage_ingredient   UUID,
  shortage_required     NUMERIC,
  shortage_available    NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item        JSONB;
  r           RECORD;
  v_ok        BOOLEAN;
  v_short_ing UUID;
  v_short_req NUMERIC;
  v_short_avl NUMERIC;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_ok := true; v_short_ing := NULL;

    FOR r IN
      SELECT rec.ingredient_id,
             rec.quantity
               * COALESCE(rec.yield_factor, ing.default_yield_factor, 1.000)
               * (item->>'qty')::NUMERIC AS needed,
             COALESCE(s.on_hand - s.reserved, 0) AS avail
      FROM recipes rec
      JOIN ingredients ing ON ing.id = rec.ingredient_id
      LEFT JOIN inventory_stock s
             ON s.ingredient_id = rec.ingredient_id AND s.branch_id = p_branch_id
      WHERE rec.menu_item_slug = item->>'slug'
        AND (rec.variant_key IS NULL
             OR rec.variant_key = 'size:' || (item->>'size'))
    LOOP
      IF r.avail < r.needed THEN
        v_ok := false; v_short_ing := r.ingredient_id;
        v_short_req := r.needed; v_short_avl := r.avail;
        EXIT;
      END IF;
    END LOOP;

    RETURN QUERY SELECT
      (item->>'slug')::TEXT, v_ok, v_short_ing, v_short_req, v_short_avl;
  END LOOP;
END $$;


-- ── RPC 2: تنبيهات المخزون المنخفض ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_low_stock_alerts(p_branch_id UUID)
RETURNS TABLE (
  ingredient_id  UUID,
  name_ar        TEXT,
  name_en        TEXT,
  on_hand        NUMERIC,
  available      NUMERIC,
  reorder_point  NUMERIC,
  days_to_out    NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    i.id, i.name_ar, i.name_en,
    s.on_hand,
    s.on_hand - s.reserved                           AS available,
    COALESCE(s.reorder_point, i.reorder_point, 0)   AS reorder_point,
    CASE WHEN COALESCE(dc.avg_daily, 0) > 0
      THEN ROUND((s.on_hand - s.reserved) / dc.avg_daily, 1)
    END                                               AS days_to_out
  FROM inventory_stock s
  JOIN ingredients i ON i.id = s.ingredient_id
  LEFT JOIN LATERAL (
    SELECT SUM(quantity) / 7.0 AS avg_daily
    FROM inventory_movements
    WHERE ingredient_id = s.ingredient_id
      AND branch_id     = p_branch_id
      AND movement_type = 'consumption'
      AND performed_at  > NOW() - INTERVAL '7 days'
  ) dc ON true
  WHERE s.branch_id = p_branch_id
    AND (s.on_hand - s.reserved)
          <= COALESCE(s.reorder_point, i.reorder_point, 0)
  ORDER BY days_to_out ASC NULLS LAST;
$$;


-- ── RPC 3: استلام مشتريات ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_receive_purchase_order(
  p_po_id       UUID,
  p_received_by UUID,
  p_lines       JSONB   -- [{ item_id, quantity_received }]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  po    RECORD;
  line  JSONB;
  poi   RECORD;
BEGIN
  SELECT * INTO po FROM purchase_orders WHERE id = p_po_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO poi FROM purchase_order_items
    WHERE id = (line->>'item_id')::UUID;

    UPDATE inventory_stock
       SET on_hand          = on_hand + (line->>'quantity_received')::NUMERIC,
           last_movement_at = NOW()
     WHERE branch_id    = po.branch_id
       AND ingredient_id = poi.ingredient_id;

    -- أضف row جديد لو لا يوجد
    INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand)
    VALUES (po.branch_id, poi.ingredient_id, (line->>'quantity_received')::NUMERIC)
    ON CONFLICT (branch_id, ingredient_id)
    DO UPDATE SET on_hand = inventory_stock.on_hand + EXCLUDED.on_hand,
                  last_movement_at = NOW();

    INSERT INTO inventory_movements
      (branch_id, ingredient_id, movement_type, quantity, purchase_order_id, performed_by)
    VALUES
      (po.branch_id, poi.ingredient_id, 'purchase',
       (line->>'quantity_received')::NUMERIC, p_po_id, p_received_by);

    -- تحديث أسعار المكونات
    UPDATE ingredients
       SET cost_per_unit = poi.unit_cost,
           updated_at    = NOW()
     WHERE id = poi.ingredient_id;

    UPDATE purchase_order_items
       SET quantity_received = (line->>'quantity_received')::NUMERIC
     WHERE id = poi.id;
  END LOOP;

  UPDATE purchase_orders
     SET status      = CASE
           WHEN NOT EXISTS (
             SELECT 1 FROM purchase_order_items
             WHERE purchase_order_id = p_po_id
               AND quantity_received < quantity_ordered
           ) THEN 'received' ELSE 'partial' END,
         received_at = NOW(),
         updated_at  = NOW()
   WHERE id = p_po_id;
END $$;


-- ── RPC 4: تطبيق نتيجة الجرد ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_inventory_count_submit(
  p_count_id    UUID,
  p_approved_by UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM inventory_counts WHERE id = p_count_id;

  -- تطبيق الفرق
  UPDATE inventory_stock
     SET on_hand          = c.actual_qty,
         last_movement_at = NOW()
   WHERE branch_id    = c.branch_id
     AND ingredient_id = c.ingredient_id;

  INSERT INTO inventory_movements
    (branch_id, ingredient_id, movement_type, quantity, performed_by, notes)
  VALUES (
    c.branch_id, c.ingredient_id, 'count_adjust',
    ABS(c.actual_qty - c.system_qty),
    p_approved_by,
    format('جرد: نظام=%s، فعلي=%s، فرق=%s', c.system_qty, c.actual_qty, c.variance)
  );

  UPDATE inventory_counts
     SET approved_by = p_approved_by, approved_at = NOW()
   WHERE id = p_count_id;
END $$;


-- ── RPC 5: تحويل مخزون بين الفروع ────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_transfer_stock(
  p_from_branch UUID,
  p_to_branch   UUID,
  p_ingredient  UUID,
  p_quantity    NUMERIC,
  p_staff_id    UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- خصم من الفرع المُرسِل
  UPDATE inventory_stock
     SET on_hand          = on_hand - p_quantity,
         last_movement_at = NOW()
   WHERE branch_id    = p_from_branch
     AND ingredient_id = p_ingredient
     AND on_hand >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK_FOR_TRANSFER' USING ERRCODE = 'P0004';
  END IF;

  -- إضافة للفرع المُستقبِل
  INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand)
  VALUES (p_to_branch, p_ingredient, p_quantity)
  ON CONFLICT (branch_id, ingredient_id)
  DO UPDATE SET on_hand = inventory_stock.on_hand + EXCLUDED.on_hand,
                last_movement_at = NOW();

  -- تسجيل الحركتين
  INSERT INTO inventory_movements
    (branch_id, ingredient_id, movement_type, quantity, performed_by)
  VALUES
    (p_from_branch, p_ingredient, 'transfer_out', p_quantity, p_staff_id),
    (p_to_branch,   p_ingredient, 'transfer_in',  p_quantity, p_staff_id);
END $$;
```

### 1.14 — Views

```sql
-- COGS لكل طبق (تستخدم COALESCE بعد FIX-4)
CREATE VIEW v_dish_cogs AS
SELECT
  mis.slug,
  mis.name_ar,
  mis.name_en,
  mis.price_bhd AS selling_price,
  SUM(r.quantity
        * COALESCE(r.yield_factor, i.default_yield_factor, 1.000)
        * i.cost_per_unit)                           AS cost_bhd,
  mis.price_bhd
    - SUM(r.quantity
            * COALESCE(r.yield_factor, i.default_yield_factor, 1.000)
            * i.cost_per_unit)                       AS profit_bhd,
  ROUND(
    (1 - SUM(r.quantity
               * COALESCE(r.yield_factor, i.default_yield_factor, 1.000)
               * i.cost_per_unit)
           / NULLIF(mis.price_bhd, 0)) * 100
  , 1)                                               AS margin_pct
FROM menu_items_sync mis
JOIN recipes r  ON r.menu_item_slug = mis.slug
JOIN ingredients i ON i.id = r.ingredient_id
GROUP BY mis.slug, mis.name_ar, mis.name_en, mis.price_bhd;

-- Materialized View للـ Variance (تُحدَّث كل ساعة)
CREATE MATERIALIZED VIEW mv_variance_report AS
SELECT
  i.id AS ingredient_id, i.name_ar, i.name_en, s.branch_id,
  COALESCE(th.total, 0)                             AS theoretical_usage,
  COALESCE(ac.total, 0)                             AS actual_usage,
  COALESCE(ac.total, 0) - COALESCE(th.total, 0)    AS variance,
  CASE WHEN COALESCE(th.total, 0) > 0
    THEN ROUND(((COALESCE(ac.total,0) - COALESCE(th.total,0))
                 / COALESCE(th.total,1)) * 100, 1)
  END                                               AS variance_pct
FROM ingredients i
CROSS JOIN inventory_stock s
LEFT JOIN LATERAL (
  SELECT SUM(r.quantity
               * COALESCE(r.yield_factor, i.default_yield_factor, 1.000)
               * oi.qty) AS total
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN recipes r ON r.menu_item_slug = oi.menu_item_slug AND r.ingredient_id = i.id
  WHERE o.branch_id = s.branch_id
    AND o.status IN ('delivered','completed')
    AND o.created_at > NOW() - INTERVAL '7 days'
) th ON true
LEFT JOIN LATERAL (
  SELECT SUM(quantity) AS total
  FROM inventory_movements
  WHERE ingredient_id = i.id AND branch_id = s.branch_id
    AND movement_type IN ('consumption','waste')
    AND performed_at > NOW() - INTERVAL '7 days'
) ac ON true
WHERE s.ingredient_id = i.id;

CREATE UNIQUE INDEX ON mv_variance_report(ingredient_id, branch_id);
```

### 1.15 — RLS Policies

```sql
-- ── ingredients ──────────────────────────────────────────────────────────
CREATE POLICY "ingredients_read" ON ingredients FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "ingredients_write" ON ingredients FOR ALL TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef'));

-- ── recipes ──────────────────────────────────────────────────────────────
CREATE POLICY "recipes_read" ON recipes FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "recipes_write" ON recipes FOR ALL TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef'));

-- ── inventory_stock ───────────────────────────────────────────────────────
CREATE POLICY "stock_read_own_branch" ON inventory_stock FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );

-- ── inventory_movements — append-only ────────────────────────────────────
CREATE POLICY "movements_insert" ON inventory_movements FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "movements_read" ON inventory_movements FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );
CREATE POLICY "movements_immutable" ON inventory_movements
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "movements_no_delete" ON inventory_movements
  FOR DELETE TO authenticated USING (false);

-- ── waste_log ─────────────────────────────────────────────────────────────
CREATE POLICY "waste_read" ON waste_log FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );
CREATE POLICY "waste_insert" ON waste_log FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() IN ('owner','general_manager','branch_manager','chef','inventory_manager')
  );
CREATE POLICY "waste_approve" ON waste_log FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager'));

-- ── purchase_orders ───────────────────────────────────────────────────────
CREATE POLICY "po_read" ON purchase_orders FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );
CREATE POLICY "po_write" ON purchase_orders FOR ALL TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager','inventory_manager'));

-- ── suppliers ─────────────────────────────────────────────────────────────
CREATE POLICY "suppliers_read" ON suppliers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "suppliers_write" ON suppliers FOR ALL TO authenticated
  USING (auth_user_role() IN ('owner','general_manager'));

-- ── inventory_alerts ──────────────────────────────────────────────────────
CREATE POLICY "alerts_read" ON inventory_alerts FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner','general_manager')
    OR branch_id = auth_user_branch_id()
  );
```

### 1.16 — Indexes

```sql
CREATE INDEX idx_inventory_movements_order      ON inventory_movements(order_id);
CREATE INDEX idx_inventory_movements_ingredient  ON inventory_movements(ingredient_id, branch_id);
CREATE INDEX idx_inventory_movements_performed   ON inventory_movements(performed_at DESC);
CREATE INDEX idx_inventory_stock_branch          ON inventory_stock(branch_id);
CREATE INDEX idx_recipes_slug                    ON recipes(menu_item_slug);
CREATE INDEX idx_waste_log_branch_date           ON waste_log(branch_id, reported_at DESC);
CREATE INDEX idx_purchase_orders_branch          ON purchase_orders(branch_id, status);
CREATE INDEX idx_inventory_counts_branch         ON inventory_counts(branch_id, counted_at DESC);
```

### 1.17 — pg_cron

```sql
-- Refresh mv_variance_report كل ساعة
SELECT cron.schedule(
  'refresh-variance-report',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_variance_report$$
);
```

---

## Phase 2 — Excel Import System

**الهدف:** صاحب المطعم يحمّل template، يملأه، يرفعه — النظام يستورد كل شيء.

### 2.1 — ملفات الـ Import

```
src/app/api/inventory/
├── template/
│   └── route.ts          ← GET → يُولّد Excel template فارغ
└── import/
    └── route.ts          ← POST → يقرأ Excel ويُدرج في DB

src/app/[locale]/dashboard/inventory/
└── import/
    ├── page.tsx          ← واجهة الرفع والـ Preview
    └── actions.ts        ← Server Actions للتحقق والإدراج
```

### 2.2 — بنية الـ Excel Template

**Sheet 1: المكونات (ingredients)**

| الحقل | النوع | مثال | ملاحظة |
|-------|-------|------|--------|
| `name_ar` | نص | لحم ضأن | **إجباري** |
| `name_en` | نص | Lamb | **إجباري** |
| `unit` | قائمة | g / kg / ml / l / unit | **إجباري** |
| `cost_per_unit` | رقم | 0.002 | تكلفة البحريني لكل وحدة |
| `default_yield_factor` | رقم | 1.15 | 1.00 لو لا يوجد فاقد |
| `category` | قائمة | protein / grain / vegetable ... | |
| `reorder_point` | رقم | 5000 | حد إعادة الطلب (بالوحدة) |
| `supplier_name` | نص | شركة الفيصل | يُطابَق أو يُنشأ تلقائياً |

**Sheet 2: الوصفات (recipes)**

| الحقل | النوع | مثال | ملاحظة |
|-------|-------|------|--------|
| `menu_item_slug` | نص | lamb-kebab | **إجباري** — من menu_items_sync |
| `ingredient_name_ar` | نص | لحم ضأن | **إجباري** — يُطابَق مع ingredients |
| `quantity` | رقم | 250 | بالوحدة المحددة في ingredients |
| `variant_key` | نص | size:small | اتركه فارغاً للمكونات المشتركة |
| `yield_factor_override` | رقم | 1.20 | اتركه فارغاً لاستخدام default |
| `is_optional` | true/false | false | |

**Sheet 3: الأرصدة الافتتاحية (opening_stock)**

| الحقل | النوع | مثال |
|-------|-------|------|
| `ingredient_name_ar` | نص | لحم ضأن |
| `branch_name` | نص | الرفاع / القلالي |
| `on_hand` | رقم | 15000 |
| `reorder_point` | رقم | 5000 |

### 2.3 — منطق Import (route.ts)

```
1. استقبال الملف → SheetJS يقرأ الـ sheets
2. تحقق من الـ schema (حقول إجبارية، أنواع، قيم صحيحة)
3. تحقق من menu_item_slugs (موجودة في menu_items_sync؟)
4. تحقق من تكرار المكونات
5. Preview response: { valid: [], invalid: [{row, error}] }
6. عند التأكيد: INSERT بـ upsert (ON CONFLICT DO UPDATE)
7. تقرير نهائي: { imported: N, skipped: M, errors: [...] }
```

### 2.4 — واجهة Import (page.tsx)

```
┌──────────────────────────────────────────────────┐
│  📥 استيراد بيانات المخزون                         │
│                                                  │
│  [⬇ تحميل Template Excel]                        │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │  اسحب ملف Excel هنا أو اضغط للرفع   │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  نتائج التحقق:                                    │
│  ✅ 187 مكوّن صالح                                │
│  ✅ 1,240 وصفة صالحة                              │
│  ❌ صف 45: slug "lamb-kbab" غير موجود في القائمة  │
│  ❌ صف 89: yield_factor = 0.8 (يجب ≥ 1.00)       │
│                                                  │
│  [تأكيد الاستيراد ✓]  [إلغاء ✕]                  │
└──────────────────────────────────────────────────┘
```

---

## Phase 3 — Core UI (MVP)

### 3.1 — هيكل الصفحات

```
src/app/[locale]/dashboard/inventory/
├── page.tsx                    Overview + KPIs + Low Stock widget
├── loading.tsx
├── layout.tsx                  Sidebar nav للـ inventory section
│
├── ingredients/
│   ├── page.tsx               جدول كل المكونات + بحث + فلتر
│   ├── loading.tsx
│   ├── new/page.tsx           فورم إضافة مكوّن جديد
│   └── [id]/
│       ├── page.tsx           تفاصيل مكوّن + edit
│       └── actions.ts
│
├── recipes/
│   ├── page.tsx               قائمة الأطباق (من menu_items_sync)
│   ├── loading.tsx
│   └── [slug]/
│       ├── page.tsx           BOM Editor للطبق
│       └── actions.ts
│
├── stock/
│   ├── page.tsx               جدول المخزون الحالي per branch
│   ├── loading.tsx
│   └── [branchId]/
│       └── page.tsx           تفاصيل فرع + opening balance entry
│
└── import/
    ├── page.tsx               Excel Import UI
    └── actions.ts
```

### 3.2 — Components

```
src/components/inventory/
├── IngredientTable.tsx         جدول مكونات مع بحث وفلتر
├── IngredientForm.tsx          فورم إضافة/تعديل مكوّن
├── RecipeEditor.tsx            BOM Editor (drag-and-drop مكونات)
├── StockTable.tsx              عرض المخزون per branch
├── OpeningBalanceForm.tsx      إدخال أرصدة افتتاحية
├── ImportDropzone.tsx          منطقة رفع Excel
├── ImportPreview.tsx           عرض نتائج التحقق قبل الإدراج
└── LowStockWidget.tsx          widget للـ dashboard الرئيسي
```

### 3.3 — Overview Page (inventory/page.tsx)

```
┌──────────┬──────────┬──────────┐
│ 🔴 نفاد  │ 🟡 منخفض │ 📦 PO   │
│  3 مكوّن │ 12 مكوّن │ 4 طلبات │
├──────────┴──────────┴──────────┤
│  🔴 لحم ضأن   — ينفد خلال 3 أيام │
│  🟡 أرز بسمتي — ينفد خلال 8 أيام │
│  [عرض الكل ←]                    │
├────────────────────────────────┤
│  آخر حركة: اليوم 14:30          │
│  قيمة المخزون: 8,450 BD          │
└────────────────────────────────┘
```

---

## Phase 4 — Operational Workflows

### 4.1 — ملفات الـ Workflows

```
src/app/[locale]/dashboard/inventory/
│
├── waste/
│   ├── page.tsx               سجل الهدر + قائمة طلبات الموافقة
│   ├── loading.tsx
│   ├── new/page.tsx           فورم تسجيل هدر جديد
│   └── actions.ts             reportWaste(), approveWaste(), rejectWaste()
│
├── count/
│   ├── page.tsx               جدول الجرد الدوري
│   ├── loading.tsx
│   ├── new/page.tsx           فورم جرد جديد (mobile-first)
│   └── actions.ts             submitCount(), approveCount()
│
├── purchases/
│   ├── page.tsx               قائمة أوامر الشراء
│   ├── loading.tsx
│   ├── new/page.tsx           إنشاء PO جديد (مع auto-suggest من low stock)
│   ├── [id]/
│   │   ├── page.tsx           تفاصيل PO + استلام
│   │   └── actions.ts         receivePO()
│   └── actions.ts             createPO(), sendPO()
│
└── transfers/
    ├── page.tsx               تحويلات بين الفروع
    └── actions.ts             createTransfer(), receiveTransfer()
```

### 4.2 — Server Actions المطلوبة

```ts
// waste/actions.ts
reportWaste(data: WasteFormData)  → INSERT waste_log (approved_by = NULL)
approveWaste(id: UUID, approverId: UUID)  → UPDATE waste_log SET approved_by
rejectWaste(id: UUID, reason: string)     → DELETE waste_log

// count/actions.ts
submitCount(data: CountFormData)          → INSERT inventory_counts
approveCount(id: UUID, approverId: UUID)  → rpc_inventory_count_submit()

// purchases/actions.ts
createPO(data: POFormData)                → INSERT purchase_orders + items
receivePO(poId: UUID, lines: POLine[])    → rpc_receive_purchase_order()

// transfers/actions.ts
createTransfer(data: TransferData)        → rpc_transfer_stock()
```

---

## Phase 5 — Reports & Analytics

### 5.1 — ملفات التقارير

```
src/app/[locale]/dashboard/inventory/
└── reports/
    ├── page.tsx               قائمة التقارير
    ├── cogs/
    │   └── page.tsx           COGS per dish + margins
    ├── variance/
    │   └── page.tsx           نظري vs فعلي (من mv_variance_report)
    ├── waste/
    │   └── page.tsx           تقرير الهدر per reason + employee
    └── valuation/
        └── page.tsx           قيمة المخزون الإجمالية

src/components/inventory/reports/
├── COGSTable.tsx              جدول COGS مع تلوين الهامش
├── VarianceChart.tsx          Recharts لنظري vs فعلي
├── WasteBreakdown.tsx         Pie chart للهدر per reason
└── InventoryValuation.tsx     إجمالي القيمة per branch
```

### 5.2 — Export Excel

كل صفحة تقرير تحتوي زر Export يستخدم SheetJS:
```ts
// src/lib/inventory/export.ts
exportCOGSReport(data)       → COGS.xlsx
exportVarianceReport(data)   → Variance.xlsx
exportWasteReport(data)      → Waste.xlsx
```

---

## Phase 6 — Dashboard Integration

### 6.1 — التعديلات على الكود الموجود

```
src/app/[locale]/dashboard/orders/actions.ts
  → إضافة error handling لـ INSUFFICIENT_STOCK (P0001)
  → إضافة error handling لـ MISSING_STOCK_RECORD (P0002)
  → إضافة order_source في createOrder()

src/app/[locale]/dashboard/
  → إضافة LowStockWidget في الصفحة الرئيسية

src/app/[locale]/menu/[slug]/page.tsx (checkout)
  → استدعاء rpc_check_stock_for_cart() قبل إنشاء الطلب
  → عرض رسالة "غير متوفر" للأصناف الناقصة

src/app/[locale]/dashboard/pos/
  → إضافة source selector (walk_in, talabat, jahez, keeta, phone)
  → هذه الصفحة غير موجودة — تُبنى في Phase 3.5
```

### 6.2 — Types الجديدة

```
src/lib/supabase/inventory-types.ts
  → Row aliases لكل الجداول الجديدة
  → Insert/Update aliases
  → Composite types (StockWithIngredient, RecipeWithIngredient, etc.)
```

---

## هيكل الملفات الكامل

```
kahramana-Saas/
│
├── supabase/migrations/
│   └── 029_inventory_core.sql                    ← Phase 1
│
├── src/
│   ├── app/
│   │   ├── api/inventory/
│   │   │   ├── template/route.ts                 ← Phase 2
│   │   │   └── import/route.ts                   ← Phase 2
│   │   │
│   │   └── [locale]/dashboard/inventory/
│   │       ├── page.tsx                          ← Phase 3
│   │       ├── loading.tsx
│   │       ├── layout.tsx
│   │       ├── import/page.tsx                   ← Phase 2
│   │       ├── import/actions.ts
│   │       ├── ingredients/page.tsx              ← Phase 3
│   │       ├── ingredients/new/page.tsx
│   │       ├── ingredients/[id]/page.tsx
│   │       ├── ingredients/[id]/actions.ts
│   │       ├── recipes/page.tsx                  ← Phase 3
│   │       ├── recipes/[slug]/page.tsx
│   │       ├── recipes/[slug]/actions.ts
│   │       ├── stock/page.tsx                    ← Phase 3
│   │       ├── stock/[branchId]/page.tsx
│   │       ├── waste/page.tsx                    ← Phase 4
│   │       ├── waste/new/page.tsx
│   │       ├── waste/actions.ts
│   │       ├── count/page.tsx                    ← Phase 4
│   │       ├── count/new/page.tsx
│   │       ├── count/actions.ts
│   │       ├── purchases/page.tsx                ← Phase 4
│   │       ├── purchases/new/page.tsx
│   │       ├── purchases/[id]/page.tsx
│   │       ├── purchases/[id]/actions.ts
│   │       ├── purchases/actions.ts
│   │       ├── transfers/page.tsx                ← Phase 4
│   │       ├── transfers/actions.ts
│   │       ├── reports/page.tsx                  ← Phase 5
│   │       ├── reports/cogs/page.tsx
│   │       ├── reports/variance/page.tsx
│   │       ├── reports/waste/page.tsx
│   │       └── reports/valuation/page.tsx
│   │
│   ├── components/inventory/
│   │   ├── IngredientTable.tsx                   ← Phase 3
│   │   ├── IngredientForm.tsx
│   │   ├── RecipeEditor.tsx
│   │   ├── StockTable.tsx
│   │   ├── OpeningBalanceForm.tsx
│   │   ├── ImportDropzone.tsx                    ← Phase 2
│   │   ├── ImportPreview.tsx
│   │   ├── WasteLogForm.tsx                      ← Phase 4
│   │   ├── WasteApprovalCard.tsx
│   │   ├── CycleCountForm.tsx
│   │   ├── POForm.tsx
│   │   ├── POReceiveForm.tsx
│   │   ├── TransferForm.tsx
│   │   ├── LowStockWidget.tsx                    ← Phase 6
│   │   └── reports/
│   │       ├── COGSTable.tsx                     ← Phase 5
│   │       ├── VarianceChart.tsx
│   │       ├── WasteBreakdown.tsx
│   │       └── InventoryValuation.tsx
│   │
│   └── lib/
│       ├── supabase/inventory-types.ts           ← Phase 1
│       └── inventory/
│           ├── excel-template.ts                 ← Phase 2
│           ├── excel-parser.ts
│           └── export.ts                         ← Phase 5
│
└── docs/
    ├── restaurant-inventory-system.md            ← المرجع التقني
    └── inventory-implementation-plan.md          ← هذا الملف
```

---

## قائمة التحقق (Verification Checklist)

### بعد migration 029

```bash
# 1. كل الجداول موجودة
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'inventor%' OR tablename IN ('ingredients','suppliers','recipes');

# 2. الـ ENUM موجود
SELECT * FROM pg_type WHERE typname = 'inventory_movement_type';

# 3. الـ Triggers موجودة
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'public';

# 4. الـ RPCs موجودة
SELECT proname FROM pg_proc WHERE proname LIKE 'rpc_%';

# 5. RLS مُفعَّل
SELECT tablename FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public' AND c.relrowsecurity = true;
```

### بعد Excel Import

```
✅ ingredients: N صف مُدرَج
✅ recipes: N صف مُدرَج
✅ inventory_stock: N صف (أرصدة افتتاحية)
✅ أول طلب جديد → inventory_movements يسجّل reservations
✅ تغيير status → delivered → on_hand ينقص
```

### بعد كل Phase

```bash
npx tsc --noEmit    # لا أخطاء TypeScript
npm run build       # Build ناجح
```

---

## الجدول الزمني

| الأسبوع | Phase | المخرج |
|---------|-------|--------|
| 1 | Phase 1 + Phase 2 | migration 029 + Excel Import جاهز للتسليم |
| 2 | Phase 3 | واجهة المكونات + الوصفات + المخزون |
| 3 | Phase 4 | الهدر + الجرد + المشتريات |
| 4 | Phase 5 + Phase 6 | التقارير + ربط مع الطلبات |
| 5 | Testing (الرفاع) | اختبار على فرع واحد |
| 6 | Rollout (القلالي) | توسيع للفرع الثاني |

**ملاحظة:** صاحب المطعم يبدأ رفع البيانات من الأسبوع 1 فور تسليم Excel Import.
النظام يُفعَّل تدريجياً — كل وصفة تُدخَل تبدأ تخصم المخزون فوراً.
