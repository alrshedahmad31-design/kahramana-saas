# خطة تنفيذ نظام المخزون — كهرمنة بغداد [Enterprise Edition]
> الحالة: جاهزة للتنفيذ | المرجع التقني: `restaurant-inventory-system.md`
> آخر تحديث: أبريل 2026 — نسخة موسّعة بمعايير أنظمة MarketMan / BlueCart / xtraCHEF

---

## نظرة عامة

```
Phase 1 — Migration 029 Enterprise   (أسبوع 1)   → قاعدة بيانات كاملة + 17 جدول
Phase 2 — Excel Import               (أسبوع 1)   → صاحب المطعم يرفع بياناته
Phase 3 — Core UI + POS + Platforms  (أسبوع 2)   → يدوي per طلب + CSV Import لمنصات التوصيل
Phase 4 — Operational Workflows      (أسبوع 3)   → هدر + جرد + مشتريات + تحويلات
Phase 5 — Reports & Intelligence     (أسبوع 4)   → 12 تقرير متقدم
Phase 6 — Dashboard Integration      (أسبوع 4)   → ربط مع الطلبات والـ KPIs
Phase 7 — Advanced Features          (أسبوع 5-6) → Catering + Budget + Forecasting
```

**المبدأ:** النظام يُسلَّم فارغاً. صاحب المطعم يملأ البيانات عبر Excel.
بمجرد رفع أول وصفة، الـ triggers تبدأ تعمل تلقائياً على جميع مصادر الطلبات.

**مصادر الطلبات المدعومة:** website · walk_in · phone · talabat · jahez · keeta · catering
جميعها تُعامَل بنفس الطريقة — triggers تخصم المخزون تلقائياً بغض النظر عن المصدر.

---

## Phase 1 — Migration 029 Enterprise

**الملف:** `supabase/migrations/029_inventory_core.sql`

### الترتيب الإجباري

```
 1. ENUMs
 2. suppliers
 3. inventory_alerts
 4. ingredients  (+ allergens, barcode, abc_class, purchase_unit)
 5. ingredient_allergens
 6. supplier_price_history
 7. prep_items + prep_item_ingredients   ← Sub-recipes
 8. recipes
 9. inventory_stock
10. inventory_lots                       ← FEFO lot tracking
11. inventory_movements
12. purchase_orders + purchase_order_items
13. waste_log  (+ escalation columns)
14. inventory_counts
15. inventory_transfers
16. par_levels                           ← Dynamic par per day type
17. unit_conversions
18. delivery_platform_mappings          ← ربط أسماء المنصات بالأصناف
19. order_source guard على orders
19. Functions + Triggers
20. RPCs (11 وظيفة)
21. Views + Materialized Views
22. RLS Policies
23. Indexes
24. pg_cron jobs (7 مهام)
```

---

### 1.1 — ENUMs

```sql
CREATE TYPE inventory_movement_type AS ENUM (
  'reservation', 'consumption', 'release',
  'purchase', 'count_adjust', 'waste',
  'transfer_in', 'transfer_out',
  'prep_production',   -- إنتاج prep item (sub-recipe)
  'prep_consumption',  -- استهلاك prep item في وصفة
  'catering_reserve',  -- حجز لحدث catering
  'catering_release',  -- إفراج حجز catering
  'opening_balance',   -- رصيد افتتاحي
  'adjustment'         -- تعديل يدوي مُوثَّق
);

CREATE TYPE abc_class AS ENUM ('A', 'B', 'C');
-- A = عالي القيمة/الحركة → جرد أسبوعي
-- B = متوسط              → جرد نصف شهري
-- C = منخفض              → جرد شهري
```

---

### 1.2 — جدول `suppliers`

```sql
CREATE TABLE suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar          TEXT NOT NULL,
  name_en          TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  lead_time_days   INTEGER NOT NULL DEFAULT 1,
  payment_terms    TEXT CHECK (payment_terms IN ('cash','net7','net14','net30','net60')),
  min_order_bhd    NUMERIC(10,3),
  reliability_pct  NUMERIC(5,2) DEFAULT 100,  -- يُحسب تلقائياً من PO history
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
```

---

### 1.3 — جدول `inventory_alerts`

```sql
CREATE TABLE inventory_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID REFERENCES branches(id),
  ingredient_id UUID,
  alert_type    TEXT NOT NULL CHECK (alert_type IN (
    'low_stock', 'out_of_stock', 'high_waste',
    'variance_warning', 'variance_critical',
    'unmapped_item', 'expiring_soon', 'expired',
    'theft_suspected', 'po_overdue', 'cost_spike',
    'overstock', 'dead_stock', 'auto_po_generated',
    'waste_escalated', 'count_variance_high',
    'prep_low_stock', 'catering_stock_insufficient'
  )),
  severity      TEXT NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('info','warning','critical')),
  message       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_alerts;
```

---

### 1.4 — جدول `ingredients` (موسَّع)

```sql
CREATE TABLE ingredients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar              TEXT NOT NULL,
  name_en              TEXT NOT NULL,

  -- وحدة الاستخدام (المستخدمة في الوصفات والمخزون)
  unit                 TEXT NOT NULL CHECK (unit IN (
    'g','kg','ml','l','unit','tbsp','tsp',
    'oz','lb','piece','portion','bottle','can','bag','box'
  )),

  -- وحدة الشراء (اختيارية — للتحويل التلقائي)
  -- مثال: unit='g', purchase_unit='kg', purchase_unit_factor=1000
  -- مثال: unit='ml', purchase_unit='bottle', purchase_unit_factor=500
  purchase_unit        TEXT,
  purchase_unit_factor NUMERIC(14,6),

  cost_per_unit        NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  ideal_cost_pct       NUMERIC(5,2),  -- نسبة التكلفة المثالية للصنف (مثال: 28%)
  default_yield_factor NUMERIC(5,3) NOT NULL DEFAULT 1.000 CHECK (default_yield_factor >= 1.000),

  category             TEXT CHECK (category IN (
    'protein','grain','vegetable','dairy','seafood',
    'spice','oil','beverage','sauce','packaging',
    'cleaning','disposable','other'
  )),

  abc_class            abc_class DEFAULT 'C',  -- يُحدَّث تلقائياً بـ pg_cron
  barcode              TEXT UNIQUE,             -- للمسح الضوئي عند الاستلام والجرد

  -- حدود المخزون
  reorder_point        NUMERIC(12,4),           -- حد إعادة الطلب
  max_stock_level      NUMERIC(12,4),           -- الحد الأقصى (للكشف عن Overstock)
  reorder_qty          NUMERIC(12,4),           -- الكمية المعتادة للطلب عند الوصول لـ reorder_point

  -- صلاحية وتخزين
  shelf_life_days      INTEGER,                 -- أيام الصلاحية من تاريخ الاستلام
  storage_temp         TEXT CHECK (storage_temp IN (
    'frozen','chilled','ambient','dry'
  )),

  supplier_id          UUID REFERENCES suppliers(id),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

ALTER TABLE inventory_alerts
  ADD CONSTRAINT fk_alerts_ingredient
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id);
```

---

### 1.5 — جدول `ingredient_allergens`

```sql
-- الـ 14 مسبب حساسية الرسمية (EU + GCC)
CREATE TABLE ingredient_allergens (
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  allergen      TEXT NOT NULL CHECK (allergen IN (
    'gluten','dairy','eggs','nuts','peanuts',
    'soy','fish','shellfish','sesame','mustard',
    'celery','lupin','molluscs','sulphites'
  )),
  PRIMARY KEY (ingredient_id, allergen)
);
ALTER TABLE ingredient_allergens ENABLE ROW LEVEL SECURITY;
```

---

### 1.6 — جدول `supplier_price_history`

```sql
CREATE TABLE supplier_price_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id),
  supplier_id       UUID NOT NULL REFERENCES suppliers(id),
  unit_cost         NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  purchase_order_id UUID,   -- FK يُضاف بعد purchase_orders
  effective_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_price_history_ingredient ON supplier_price_history(ingredient_id, effective_at DESC);
```

---

### 1.7 — Sub-recipes: `prep_items` + `prep_item_ingredients`

```sql
-- مثال: صلصة الطماطم، عجينة البيتزا، مرق الدجاج، الزبدة المُعطَّرة
-- هذه "مكونات مُصنَّعة داخلياً" — لها وصفاتها الخاصة وتُستخدم في الأطباق
CREATE TABLE prep_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  unit             TEXT NOT NULL CHECK (unit IN (
    'g','kg','ml','l','unit','portion','batch'
  )),
  batch_yield_qty  NUMERIC(12,4) NOT NULL,  -- كل دفعة تُنتج X وحدة
  shelf_life_hours INTEGER,                 -- صلاحية المنتج المُصنَّع (بالساعات)
  storage_temp     TEXT CHECK (storage_temp IN ('frozen','chilled','ambient')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE prep_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE prep_item_ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_item_id  UUID NOT NULL REFERENCES prep_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  yield_factor  NUMERIC(5,3) CHECK (yield_factor IS NULL OR yield_factor >= 1.000),
  UNIQUE (prep_item_id, ingredient_id)
);
ALTER TABLE prep_item_ingredients ENABLE ROW LEVEL SECURITY;
```

---

### 1.8 — جدول `recipes` (موسَّع — يدعم Ingredients + Prep Items)

```sql
CREATE TABLE recipes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_slug TEXT NOT NULL REFERENCES menu_items_sync(slug) ON DELETE CASCADE,

  -- إما ingredient أو prep_item (ليس كليهما)
  ingredient_id  UUID REFERENCES ingredients(id) ON DELETE RESTRICT,
  prep_item_id   UUID REFERENCES prep_items(id) ON DELETE RESTRICT,

  quantity       NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  is_optional    BOOLEAN NOT NULL DEFAULT false,
  variant_key    TEXT,
  yield_factor   NUMERIC(5,3) CHECK (yield_factor IS NULL OR yield_factor >= 1.000),
  notes          TEXT,
  updated_by     UUID REFERENCES staff_basic(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ضمان: واحد فقط من الاثنين
  CHECK (
    (ingredient_id IS NOT NULL AND prep_item_id IS NULL) OR
    (ingredient_id IS NULL AND prep_item_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (menu_item_slug, ingredient_id, prep_item_id, variant_key)
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
```

---

### 1.9 — جدول `inventory_stock`

```sql
CREATE TABLE inventory_stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  ingredient_id    UUID NOT NULL REFERENCES ingredients(id),
  on_hand          NUMERIC(14,4) NOT NULL DEFAULT 0,
  reserved         NUMERIC(14,4) NOT NULL DEFAULT 0,
  catering_reserved NUMERIC(14,4) NOT NULL DEFAULT 0,  -- حجز catering منفصل
  reorder_point    NUMERIC(14,4),
  max_stock_level  NUMERIC(14,4),
  last_movement_at TIMESTAMPTZ,
  last_count_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (branch_id, ingredient_id),
  CHECK (on_hand >= 0),
  CHECK (reserved >= 0),
  CHECK (catering_reserved >= 0),
  CHECK (reserved + catering_reserved <= on_hand)
);
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
```

---

### 1.10 — جدول `inventory_lots` (FEFO Lot Tracking)

```sql
-- كل دفعة شراء تحصل على Lot خاص بها (رقم، تاريخ انتهاء، تكلفة)
-- النظام يستهلك من أقدم lot أولاً (FEFO: First Expired First Out)
CREATE TABLE inventory_lots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id),
  purchase_order_id UUID,  -- FK يُضاف بعد purchase_orders
  lot_number        TEXT,                          -- رقم الدفعة من المورد
  quantity_received NUMERIC(14,4) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining NUMERIC(14,4) NOT NULL,
  unit_cost         NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        DATE,                          -- NULL = لا تاريخ انتهاء
  is_exhausted      BOOLEAN NOT NULL DEFAULT false,

  CHECK (quantity_remaining >= 0),
  CHECK (quantity_remaining <= quantity_received)
);
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_lots_fefo ON inventory_lots(branch_id, ingredient_id, expires_at ASC NULLS LAST)
  WHERE NOT is_exhausted;
```

---

### 1.11 — جدول `inventory_movements` (موسَّع)

```sql
CREATE TABLE inventory_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  ingredient_id     UUID REFERENCES ingredients(id),
  prep_item_id      UUID REFERENCES prep_items(id),
  lot_id            UUID REFERENCES inventory_lots(id),  -- ربط بالـ Lot
  movement_type     inventory_movement_type NOT NULL,
  quantity          NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit_cost         NUMERIC(10,4),  -- تكلفة الوحدة وقت الحركة (للـ FIFO الدقيق)
  order_id          UUID REFERENCES orders(id),
  order_item_id     UUID REFERENCES order_items(id),
  purchase_order_id UUID,
  waste_log_id      UUID,
  prep_batch_id     UUID,           -- مجموعة إنتاج prep_item
  catering_order_id UUID,           -- ربط بـ catering (Phase 7)
  performed_by      UUID REFERENCES staff_basic(id),
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes             TEXT
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
```

---

### 1.12 — جداول المشتريات (موسَّعة)

```sql
CREATE TABLE purchase_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID NOT NULL REFERENCES branches(id),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','confirmed','partial','received','cancelled'
  )),
  is_auto_generated BOOLEAN NOT NULL DEFAULT false,  -- أُنشئ تلقائياً بـ pg_cron
  expected_at  DATE,
  received_at  TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES staff_basic(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id       UUID NOT NULL REFERENCES ingredients(id),
  quantity_ordered    NUMERIC(14,4) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received   NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantity_variance   NUMERIC(14,4) GENERATED ALWAYS AS (quantity_received - quantity_ordered) STORED,
  unit_cost           NUMERIC(10,4) NOT NULL CHECK (unit_cost >= 0),
  lot_number          TEXT,         -- رقم دفعة المورد
  expiry_date         DATE,         -- تاريخ انتهاء الدفعة المستلمة
  quality_rating      SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
  discrepancy_note    TEXT,         -- ملاحظة إذا كانت quantity_variance غير صفر
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE supplier_price_history
  ADD CONSTRAINT fk_price_history_po
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);

ALTER TABLE inventory_lots
  ADD CONSTRAINT fk_lots_po
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);

ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_movements_po
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
```

---

### 1.13 — جدول `waste_log` (+ سلسلة التصعيد)

```sql
CREATE TABLE waste_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  ingredient_id    UUID NOT NULL REFERENCES ingredients(id),
  quantity         NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  reason           TEXT NOT NULL CHECK (reason IN (
    'expired','damaged','spillage','overproduction',
    'quality','returned','theft_suspected',
    'prep_error','over_portioning','other'
  )),
  cost_bhd         NUMERIC(12,3) NOT NULL DEFAULT 0,
  notes            TEXT,
  photo_url        TEXT,

  -- سلسلة التصعيد التلقائية
  escalation_level SMALLINT NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 3),
  -- 0=BM   → يجب الموافقة خلال 4 ساعات
  -- 1=GM   → تصعيد تلقائي بعد 4 ساعات
  -- 2=Owner→ تصعيد تلقائي بعد 8 ساعات
  -- 3=Auto-Closed → بعد 24 ساعة يُغلق تلقائياً بملاحظة
  escalated_at     TIMESTAMPTZ,

  reported_by      UUID NOT NULL REFERENCES staff_basic(id),
  approved_by      UUID REFERENCES staff_basic(id),
  approved_at      TIMESTAMPTZ,
  rejected_by      UUID REFERENCES staff_basic(id),
  rejected_at      TIMESTAMPTZ,
  rejection_note   TEXT,
  reported_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_movements_waste
  FOREIGN KEY (waste_log_id) REFERENCES waste_log(id);
```

---

### 1.14 — جداول الجرد والتحويلات

```sql
CREATE TABLE inventory_counts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  lot_id        UUID REFERENCES inventory_lots(id),  -- جرد لـ lot محدد
  counted_by    UUID NOT NULL REFERENCES staff_basic(id),
  verified_by   UUID REFERENCES staff_basic(id),
  system_qty    NUMERIC(14,4) NOT NULL,
  actual_qty    NUMERIC(14,4) NOT NULL,
  variance      NUMERIC(14,4) GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
  variance_pct  NUMERIC(8,2)  GENERATED ALWAYS AS (
    CASE WHEN system_qty != 0 THEN
      ROUND(((actual_qty - system_qty) / system_qty) * 100, 2)
    ELSE NULL END
  ) STORED,
  count_session TEXT,           -- مجموعة الجرد (مثال: '2026-04-W4-Riffa')
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
  lot_id         UUID REFERENCES inventory_lots(id),  -- تحويل lot محدد
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

---

### 1.15 — جدول `par_levels` (مستويات Par الديناميكية)

```sql
-- Par level = الكمية المستهدفة في المخزون حسب نوع اليوم
-- مختلف عن reorder_point: Par هو الهدف، Reorder هو المُشغِّل
CREATE TABLE par_levels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  day_type      TEXT NOT NULL DEFAULT 'default' CHECK (day_type IN (
    'default',    -- الأيام العادية
    'weekend',    -- الخميس والجمعة
    'ramadan',    -- شهر رمضان (ساعات مختلفة + عناصر مختلفة)
    'event',      -- فعاليات خاصة
    'holiday'     -- أعياد رسمية
  )),
  par_qty       NUMERIC(14,4) NOT NULL CHECK (par_qty >= 0),
  reorder_qty   NUMERIC(14,4) NOT NULL CHECK (reorder_qty >= 0),  -- كم تطلب عند الوصول للـ reorder_point
  UNIQUE (branch_id, ingredient_id, day_type)
);
ALTER TABLE par_levels ENABLE ROW LEVEL SECURITY;
```

---

### 1.16 — جدول `unit_conversions`

```sql
-- تحويلات مخصصة بين الوحدات (بعضها خاص بمكوّن معين)
-- NULL ingredient_id = تحويل عالمي (مثال: 1 kg = 1000 g دائماً)
CREATE TABLE unit_conversions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  from_unit     TEXT NOT NULL,
  to_unit       TEXT NOT NULL,
  factor        NUMERIC(14,6) NOT NULL CHECK (factor > 0),
  -- 1 from_unit = factor to_unit
  UNIQUE (ingredient_id, from_unit, to_unit)
);
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

-- تحويلات عالمية افتراضية
INSERT INTO unit_conversions (ingredient_id, from_unit, to_unit, factor) VALUES
  (NULL, 'kg',  'g',   1000),
  (NULL, 'g',   'kg',  0.001),
  (NULL, 'l',   'ml',  1000),
  (NULL, 'ml',  'l',   0.001),
  (NULL, 'lb',  'g',   453.592),
  (NULL, 'oz',  'g',   28.3495),
  (NULL, 'tbsp','ml',  14.787),
  (NULL, 'tsp', 'ml',  4.929);
```

---

### 1.17 — order_source Guard (جميع مصادر الطلبات)

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_source'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'website'
      CHECK (order_source IN (
        'website',   -- موقع كهرمنة
        'walk_in',   -- أكل داخلي
        'phone',     -- طلب هاتفي
        'talabat',   -- طلبات + مطابق تماماً للطلبات الأخرى
        'jahez',
        'keeta',
        'catering',  -- تموين/فعاليات
        'other'
      ));
  END IF;
END $$;

-- platform_order_id: رقم الطلب من المنصة الخارجية — يمنع التكرار عند الدمج بين يدوي + CSV
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'platform_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN platform_order_id TEXT;
  END IF;
END $$;

-- UNIQUE INDEX على مستوى قاعدة البيانات — يرفض أي تكرار لنفس رقم الطلب من نفس المنصة
-- NULL مسموح (= طلبات website/walk_in/phone ليس لها رقم خارجي)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_platform_dedup
  ON orders(order_source, platform_order_id)
  WHERE platform_order_id IS NOT NULL;

-- role جديد لمدير المخزون
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'inventory_manager';
```

---

### 1.18 — Functions + Triggers

```sql
-- ═══════════════════════════════════════════════════════════════
-- Trigger 1: الحجز عند إنشاء الطلب (يدعم Prep Items + FEFO)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_inventory_reserve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_branch_id UUID;
  r           RECORD;
  v_required  NUMERIC;
BEGIN
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: order_id=%', NEW.order_id USING ERRCODE = 'P0003';
  END IF;

  -- حجز المكونات المباشرة
  FOR r IN
    SELECT
      rec.ingredient_id,
      NULL::UUID AS prep_item_id,
      rec.quantity
        * COALESCE(rec.yield_factor, ing.default_yield_factor, 1.000)
        AS qty_per_unit
    FROM recipes rec
    JOIN ingredients ing ON ing.id = rec.ingredient_id
    WHERE rec.menu_item_slug = NEW.menu_item_slug
      AND rec.ingredient_id IS NOT NULL
      AND (rec.variant_key IS NULL
           OR rec.variant_key = COALESCE(NEW.selected_variant, NEW.size))

    UNION ALL

    -- حجز مكونات sub-recipes (Prep Items) بشكل غير مباشر
    SELECT
      pii.ingredient_id,
      rec.prep_item_id,
      (pii.quantity
         * COALESCE(pii.yield_factor, ing.default_yield_factor, 1.000)
         / pi.batch_yield_qty)
        * rec.quantity
        * COALESCE(rec.yield_factor, 1.000) AS qty_per_unit
    FROM recipes rec
    JOIN prep_items pi ON pi.id = rec.prep_item_id
    JOIN prep_item_ingredients pii ON pii.prep_item_id = pi.id
    JOIN ingredients ing ON ing.id = pii.ingredient_id
    WHERE rec.menu_item_slug = NEW.menu_item_slug
      AND rec.prep_item_id IS NOT NULL
      AND (rec.variant_key IS NULL
           OR rec.variant_key = COALESCE(NEW.selected_variant, NEW.size))
  LOOP
    v_required := r.qty_per_unit * NEW.qty;

    UPDATE inventory_stock
       SET reserved         = reserved + v_required,
           last_movement_at = NOW()
     WHERE branch_id     = v_branch_id
       AND ingredient_id = r.ingredient_id
       AND (on_hand - reserved - catering_reserved) >= v_required;

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
      (branch_id, ingredient_id, prep_item_id, movement_type, quantity, order_id, order_item_id)
    VALUES
      (v_branch_id, r.ingredient_id, r.prep_item_id, 'reservation', v_required, NEW.order_id, NEW.id);
  END LOOP;

  -- تنبيه للأصناف بدون وصفة (unmapped)
  IF NOT EXISTS (SELECT 1 FROM recipes WHERE menu_item_slug = NEW.menu_item_slug) THEN
    INSERT INTO inventory_alerts (branch_id, alert_type, severity, message)
    VALUES (v_branch_id, 'unmapped_item', 'info',
      format('"%s" بدون وصفة — المخزون لا يُتتبَّع', NEW.menu_item_slug));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_reserve
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_inventory_reserve();


-- ═══════════════════════════════════════════════════════════════
-- Trigger 2: الاستهلاك/الإفراج عند تغيير حالة الطلب
-- ═══════════════════════════════════════════════════════════════
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
     WHERE branch_id     = NEW.branch_id
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


-- ═══════════════════════════════════════════════════════════════
-- Trigger 3: خصم الهدر عند الموافقة
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_waste_deduct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.approved_by IS NULL THEN RETURN NEW; END IF;
  IF OLD.approved_by IS NOT NULL THEN RETURN NEW; END IF;

  UPDATE inventory_stock
     SET on_hand          = on_hand - NEW.quantity,
         last_movement_at = NOW()
   WHERE branch_id     = NEW.branch_id
     AND ingredient_id = NEW.ingredient_id;

  INSERT INTO inventory_movements
    (branch_id, ingredient_id, movement_type, quantity, waste_log_id, performed_by)
  VALUES
    (NEW.branch_id, NEW.ingredient_id, 'waste', NEW.quantity, NEW.id, NEW.approved_by);

  -- تنبيه فوري للمالك عند اشتباه سرقة
  IF NEW.reason = 'theft_suspected' THEN
    INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
    VALUES (NEW.branch_id, NEW.ingredient_id, 'theft_suspected', 'critical',
      format('⚠️ اشتباه سرقة: %.3f وحدة — تحقق فوراً', NEW.quantity),
      jsonb_build_object('waste_log_id', NEW.id, 'reported_by', NEW.reported_by, 'cost_bhd', NEW.cost_bhd));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_waste_deduct
  AFTER UPDATE OF approved_by ON waste_log
  FOR EACH ROW EXECUTE FUNCTION fn_waste_deduct();


-- ═══════════════════════════════════════════════════════════════
-- Trigger 4: إنشاء Lot عند استلام PO + تحديث سعر المكوّن
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_po_receive_create_lot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  -- يُفعَّل فقط عند تحديث quantity_received لأول مرة
  IF NEW.quantity_received = OLD.quantity_received OR NEW.quantity_received = 0 THEN
    RETURN NEW;
  END IF;

  SELECT branch_id INTO v_branch_id FROM purchase_orders WHERE id = NEW.purchase_order_id;

  -- إنشاء Lot جديد
  INSERT INTO inventory_lots
    (branch_id, ingredient_id, purchase_order_id, lot_number,
     quantity_received, quantity_remaining, unit_cost, expires_at)
  VALUES
    (v_branch_id, NEW.ingredient_id, NEW.purchase_order_id, NEW.lot_number,
     NEW.quantity_received, NEW.quantity_received, NEW.unit_cost, NEW.expiry_date);

  -- تسجيل سعر في التاريخ
  INSERT INTO supplier_price_history (ingredient_id, supplier_id, unit_cost, purchase_order_id)
  SELECT NEW.ingredient_id, po.supplier_id, NEW.unit_cost, NEW.purchase_order_id
  FROM purchase_orders po WHERE po.id = NEW.purchase_order_id;

  -- تحذير إذا ارتفع السعر > 10%
  PERFORM fn_check_price_spike(NEW.ingredient_id, NEW.unit_cost, v_branch_id);

  RETURN NEW;
END $$;

CREATE TRIGGER trg_po_receive_create_lot
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION fn_po_receive_create_lot();


-- ═══════════════════════════════════════════════════════════════
-- Helper: تحذير ارتفاع السعر
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_check_price_spike(
  p_ingredient_id UUID,
  p_new_cost      NUMERIC,
  p_branch_id     UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev_cost NUMERIC;
  v_change_pct NUMERIC;
BEGIN
  SELECT unit_cost INTO v_prev_cost
  FROM supplier_price_history
  WHERE ingredient_id = p_ingredient_id
  ORDER BY effective_at DESC
  LIMIT 1 OFFSET 1;  -- السعر السابق

  IF v_prev_cost IS NOT NULL AND v_prev_cost > 0 THEN
    v_change_pct := ROUND(((p_new_cost - v_prev_cost) / v_prev_cost) * 100, 1);
    IF v_change_pct > 10 THEN
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      SELECT p_branch_id, p_ingredient_id, 'cost_spike', 'warning',
        format('ارتفع سعر "%s" بنسبة %.1f%% (%.4f → %.4f BD)', i.name_ar, v_change_pct, v_prev_cost, p_new_cost),
        jsonb_build_object('prev_cost', v_prev_cost, 'new_cost', p_new_cost, 'change_pct', v_change_pct)
      FROM ingredients i WHERE i.id = p_ingredient_id;
    END IF;
  END IF;
END $$;
```

---

### 1.19 — RPCs (11 وظيفة)

```sql
-- ── RPC 1: فحص المخزون قبل الدفع ────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_check_stock_for_cart(
  p_branch_id UUID,
  p_items     JSONB
)
RETURNS TABLE (
  menu_item_slug      TEXT,
  available           BOOLEAN,
  shortage_ingredient UUID,
  shortage_required   NUMERIC,
  shortage_available  NUMERIC
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
             COALESCE(s.on_hand - s.reserved - s.catering_reserved, 0) AS avail
      FROM recipes rec
      JOIN ingredients ing ON ing.id = rec.ingredient_id
      LEFT JOIN inventory_stock s
             ON s.ingredient_id = rec.ingredient_id AND s.branch_id = p_branch_id
      WHERE rec.menu_item_slug = item->>'slug'
        AND rec.ingredient_id IS NOT NULL
        AND (rec.variant_key IS NULL OR rec.variant_key = 'size:' || (item->>'size'))
    LOOP
      IF r.avail < r.needed THEN
        v_ok := false;
        v_short_ing := r.ingredient_id;
        v_short_req := r.needed;
        v_short_avl := r.avail;
        EXIT;
      END IF;
    END LOOP;

    RETURN QUERY SELECT (item->>'slug')::TEXT, v_ok, v_short_ing, v_short_req, v_short_avl;
  END LOOP;
END $$;


-- ── RPC 2: تنبيهات المخزون المنخفض مع توقع الانتهاء ─────────────────────
CREATE OR REPLACE FUNCTION rpc_low_stock_alerts(p_branch_id UUID)
RETURNS TABLE (
  ingredient_id    UUID,
  name_ar          TEXT,
  name_en          TEXT,
  abc_class        abc_class,
  on_hand          NUMERIC,
  available        NUMERIC,
  par_qty          NUMERIC,
  reorder_point    NUMERIC,
  days_to_out      NUMERIC,
  nearest_expiry   DATE,
  suggested_order  NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    i.id, i.name_ar, i.name_en, i.abc_class,
    s.on_hand,
    s.on_hand - s.reserved - s.catering_reserved     AS available,
    p.par_qty,
    COALESCE(s.reorder_point, i.reorder_point, 0)    AS reorder_point,
    CASE WHEN COALESCE(dc.avg_daily, 0) > 0
      THEN ROUND((s.on_hand - s.reserved) / dc.avg_daily, 1)
    END                                              AS days_to_out,
    (SELECT MIN(expires_at) FROM inventory_lots
     WHERE ingredient_id = i.id AND branch_id = p_branch_id AND NOT is_exhausted
       AND expires_at IS NOT NULL)                   AS nearest_expiry,
    COALESCE(p.reorder_qty, i.reorder_qty, 0)        AS suggested_order
  FROM inventory_stock s
  JOIN ingredients i ON i.id = s.ingredient_id
  LEFT JOIN par_levels p ON p.ingredient_id = i.id AND p.branch_id = p_branch_id
    AND p.day_type = 'default'
  LEFT JOIN LATERAL (
    SELECT SUM(quantity) / NULLIF(7.0, 0) AS avg_daily
    FROM inventory_movements
    WHERE ingredient_id = s.ingredient_id AND branch_id = p_branch_id
      AND movement_type = 'consumption'
      AND performed_at > NOW() - INTERVAL '7 days'
  ) dc ON true
  WHERE s.branch_id = p_branch_id
    AND (s.on_hand - s.reserved - s.catering_reserved)
          <= COALESCE(s.reorder_point, i.reorder_point, 0)
    AND i.is_active
  ORDER BY i.abc_class ASC, days_to_out ASC NULLS LAST;
$$;


-- ── RPC 3: استلام PO مع إنشاء Lots ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_receive_purchase_order(
  p_po_id       UUID,
  p_received_by UUID,
  p_lines       JSONB
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  po   RECORD;
  line JSONB;
  poi  RECORD;
BEGIN
  SELECT * INTO po FROM purchase_orders WHERE id = p_po_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO poi FROM purchase_order_items WHERE id = (line->>'item_id')::UUID;

    -- trigger fn_po_receive_create_lot يُنشئ الـ Lot تلقائياً
    UPDATE purchase_order_items
       SET quantity_received = (line->>'quantity_received')::NUMERIC,
           lot_number        = line->>'lot_number',
           expiry_date       = (line->>'expiry_date')::DATE,
           quality_rating    = (line->>'quality_rating')::SMALLINT,
           discrepancy_note  = CASE
             WHEN (line->>'quantity_received')::NUMERIC < poi.quantity_ordered
             THEN format('استلمنا %.4f بدلاً من %.4f', (line->>'quantity_received')::NUMERIC, poi.quantity_ordered)
             ELSE NULL END
     WHERE id = poi.id;

    -- تحديث inventory_stock
    INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand)
    VALUES (po.branch_id, poi.ingredient_id, (line->>'quantity_received')::NUMERIC)
    ON CONFLICT (branch_id, ingredient_id)
    DO UPDATE SET on_hand          = inventory_stock.on_hand + EXCLUDED.on_hand,
                  last_movement_at = NOW();

    INSERT INTO inventory_movements
      (branch_id, ingredient_id, movement_type, quantity, unit_cost, purchase_order_id, performed_by)
    VALUES
      (po.branch_id, poi.ingredient_id, 'purchase',
       (line->>'quantity_received')::NUMERIC, poi.unit_cost, p_po_id, p_received_by);

    -- تحديث سعر المكوّن
    UPDATE ingredients SET cost_per_unit = poi.unit_cost, updated_at = NOW()
    WHERE id = poi.ingredient_id;

    -- تحديث موثوقية المورد
    UPDATE suppliers SET
      reliability_pct = (
        SELECT ROUND(AVG(CASE WHEN quantity_variance >= 0 THEN 100 ELSE
          GREATEST(0, 100 + (quantity_variance / NULLIF(quantity_ordered,0) * 100))
        END), 1)
        FROM purchase_order_items poi2
        JOIN purchase_orders po2 ON po2.id = poi2.purchase_order_id
        WHERE po2.supplier_id = po.supplier_id AND poi2.quantity_received > 0
      )
    WHERE id = po.supplier_id;
  END LOOP;

  UPDATE purchase_orders
     SET status = CASE
           WHEN NOT EXISTS (
             SELECT 1 FROM purchase_order_items
             WHERE purchase_order_id = p_po_id AND quantity_received < quantity_ordered
           ) THEN 'received' ELSE 'partial' END,
         received_at = NOW(), updated_at = NOW()
   WHERE id = p_po_id;
END $$;


-- ── RPC 4: تطبيق نتيجة الجرد ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_inventory_count_submit(p_count_id UUID, p_approved_by UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; BEGIN
  SELECT * INTO c FROM inventory_counts WHERE id = p_count_id;
  UPDATE inventory_stock
     SET on_hand = c.actual_qty, last_movement_at = NOW(), last_count_at = NOW()
   WHERE branch_id = c.branch_id AND ingredient_id = c.ingredient_id;
  INSERT INTO inventory_movements
    (branch_id, ingredient_id, movement_type, quantity, performed_by, notes)
  VALUES (c.branch_id, c.ingredient_id, 'count_adjust', ABS(c.actual_qty - c.system_qty),
    p_approved_by,
    format('جرد: نظام=%.4f، فعلي=%.4f، فرق=%.4f (%.2f%%)', c.system_qty, c.actual_qty, c.variance, c.variance_pct));
  UPDATE inventory_counts SET approved_by = p_approved_by, approved_at = NOW() WHERE id = p_count_id;
  -- تنبيه لو الفرق > 10%
  IF ABS(c.variance_pct) > 10 THEN
    INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message)
    VALUES (c.branch_id, c.ingredient_id, 'count_variance_high', 'critical',
      format('فرق جرد عالٍ: %.2f%% — تحقق من السبب', c.variance_pct));
  END IF;
END $$;


-- ── RPC 5: تحويل مخزون بين الفروع ────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_transfer_stock(
  p_from_branch UUID, p_to_branch UUID,
  p_ingredient UUID, p_quantity NUMERIC, p_staff_id UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE inventory_stock
     SET on_hand = on_hand - p_quantity, last_movement_at = NOW()
   WHERE branch_id = p_from_branch AND ingredient_id = p_ingredient AND on_hand >= p_quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK_FOR_TRANSFER' USING ERRCODE = 'P0004';
  END IF;
  INSERT INTO inventory_stock (branch_id, ingredient_id, on_hand)
  VALUES (p_to_branch, p_ingredient, p_quantity)
  ON CONFLICT (branch_id, ingredient_id)
  DO UPDATE SET on_hand = inventory_stock.on_hand + EXCLUDED.on_hand, last_movement_at = NOW();
  INSERT INTO inventory_movements
    (branch_id, ingredient_id, movement_type, quantity, performed_by)
  VALUES
    (p_from_branch, p_ingredient, 'transfer_out', p_quantity, p_staff_id),
    (p_to_branch,   p_ingredient, 'transfer_in',  p_quantity, p_staff_id);
END $$;


-- ── RPC 6: تصعيد الهدر (يُستدعى بـ pg_cron كل 30 دقيقة) ────────────────
CREATE OR REPLACE FUNCTION rpc_escalate_waste_approvals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w RECORD; BEGIN
  FOR w IN
    SELECT id, branch_id, ingredient_id, escalation_level, cost_bhd, quantity, reported_at
    FROM waste_log
    WHERE approved_by IS NULL AND rejected_by IS NULL
  LOOP
    -- تصعيد للـ GM بعد 4 ساعات
    IF w.escalation_level = 0 AND NOW() > w.reported_at + INTERVAL '4 hours' THEN
      UPDATE waste_log SET escalation_level = 1, escalated_at = NOW() WHERE id = w.id;
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      VALUES (w.branch_id, w.ingredient_id, 'waste_escalated', 'warning',
        'هدر منتظر موافقة GM منذ أكثر من 4 ساعات',
        jsonb_build_object('waste_log_id', w.id, 'cost_bhd', w.cost_bhd));

    -- تصعيد للـ Owner بعد 8 ساعات
    ELSIF w.escalation_level = 1 AND NOW() > w.reported_at + INTERVAL '8 hours' THEN
      UPDATE waste_log SET escalation_level = 2, escalated_at = NOW() WHERE id = w.id;
      INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message, metadata)
      VALUES (w.branch_id, w.ingredient_id, 'waste_escalated', 'critical',
        '⚠️ هدر منتظر موافقة Owner منذ أكثر من 8 ساعات',
        jsonb_build_object('waste_log_id', w.id, 'cost_bhd', w.cost_bhd, 'quantity', w.quantity));

    -- إغلاق تلقائي بعد 24 ساعة مع تسجيل
    ELSIF w.escalation_level = 2 AND NOW() > w.reported_at + INTERVAL '24 hours' THEN
      UPDATE waste_log SET escalation_level = 3 WHERE id = w.id;
    END IF;
  END LOOP;
END $$;


-- ── RPC 7: إنشاء PO تلقائي (يُستدعى بـ pg_cron يومياً) ──────────────────
CREATE OR REPLACE FUNCTION rpc_auto_generate_pos()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  branch    RECORD;
  item      RECORD;
  v_po_id   UUID;
  v_created BOOLEAN;
BEGIN
  FOR branch IN SELECT id FROM branches WHERE is_active LOOP
    v_created := false;

    FOR item IN
      SELECT s.ingredient_id, i.supplier_id, i.reorder_qty, i.cost_per_unit,
             s.on_hand - s.reserved AS available
      FROM inventory_stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.branch_id = branch.id
        AND i.is_active AND i.supplier_id IS NOT NULL
        AND i.reorder_qty > 0
        AND (s.on_hand - s.reserved) <= COALESCE(s.reorder_point, i.reorder_point, 0)
        -- لا تُنشئ PO لو في PO مفتوح مسبقاً لنفس المكوّن
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po
          JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
          WHERE po.branch_id = branch.id AND po.supplier_id = i.supplier_id
            AND poi.ingredient_id = s.ingredient_id
            AND po.status IN ('draft','sent','confirmed')
        )
    LOOP
      -- إنشاء PO draft لكل مورد (أو إضافة لـ PO موجود لنفس المورد في نفس الجولة)
      SELECT id INTO v_po_id FROM purchase_orders
      WHERE branch_id = branch.id AND supplier_id = item.supplier_id
        AND status = 'draft' AND is_auto_generated
        AND created_at > NOW() - INTERVAL '1 hour';

      IF v_po_id IS NULL THEN
        INSERT INTO purchase_orders (branch_id, supplier_id, is_auto_generated, created_by)
        SELECT branch.id, item.supplier_id, true,
               (SELECT id FROM staff_basic WHERE role = 'owner' LIMIT 1)
        RETURNING id INTO v_po_id;
      END IF;

      INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, quantity_ordered, unit_cost)
      VALUES (v_po_id, item.ingredient_id, item.reorder_qty, item.cost_per_unit);

      v_created := true;
    END LOOP;

    IF v_created THEN
      INSERT INTO inventory_alerts (branch_id, alert_type, severity, message)
      VALUES (branch.id, 'auto_po_generated', 'info',
        'تم إنشاء أوامر شراء تلقائية — راجع وأرسل للموردين');
    END IF;
  END LOOP;
END $$;


-- ── RPC 8: تقرير المخزون الراكد ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_dead_stock_report(
  p_branch_id    UUID,
  p_days_no_move INTEGER DEFAULT 30
)
RETURNS TABLE (
  ingredient_id UUID, name_ar TEXT, name_en TEXT,
  on_hand NUMERIC, last_movement_at TIMESTAMPTZ,
  days_inactive INTEGER, stock_value_bhd NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.name_ar, i.name_en,
    s.on_hand,
    s.last_movement_at,
    EXTRACT(DAY FROM NOW() - s.last_movement_at)::INTEGER AS days_inactive,
    ROUND(s.on_hand * i.cost_per_unit, 3) AS stock_value_bhd
  FROM inventory_stock s
  JOIN ingredients i ON i.id = s.ingredient_id
  WHERE s.branch_id = p_branch_id
    AND s.on_hand > 0
    AND (s.last_movement_at IS NULL OR s.last_movement_at < NOW() - (p_days_no_move || ' days')::INTERVAL)
    AND i.is_active
  ORDER BY days_inactive DESC NULLS FIRST;
$$;


-- ── RPC 9: تقرير الأصناف المنتهية أو القريبة من الانتهاء ─────────────────
CREATE OR REPLACE FUNCTION rpc_expiry_report(p_branch_id UUID, p_days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  ingredient_id UUID, name_ar TEXT, name_en TEXT,
  lot_id UUID, lot_number TEXT, quantity_remaining NUMERIC,
  expires_at DATE, days_remaining INTEGER, stock_value_bhd NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.name_ar, i.name_en,
    l.id, l.lot_number, l.quantity_remaining,
    l.expires_at,
    (l.expires_at - CURRENT_DATE)::INTEGER AS days_remaining,
    ROUND(l.quantity_remaining * l.unit_cost, 3) AS stock_value_bhd
  FROM inventory_lots l
  JOIN ingredients i ON i.id = l.ingredient_id
  WHERE l.branch_id = p_branch_id
    AND NOT l.is_exhausted
    AND l.expires_at IS NOT NULL
    AND l.expires_at <= CURRENT_DATE + p_days_ahead
  ORDER BY l.expires_at ASC;
$$;


-- ── RPC 10: مصفوفة Menu Engineering ──────────────────────────────────────
-- Stars: ربح عالٍ + طلب عالٍ  | Plowhorses: ربح منخفض + طلب عالٍ
-- Puzzles: ربح عالٍ + طلب منخفض | Dogs: ربح منخفض + طلب منخفض
CREATE OR REPLACE FUNCTION rpc_menu_engineering(
  p_branch_id UUID,
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  menu_item_slug TEXT, name_ar TEXT, name_en TEXT,
  total_sold INTEGER, revenue_bhd NUMERIC,
  cost_bhd NUMERIC, profit_bhd NUMERIC, margin_pct NUMERIC,
  ideal_cost_pct NUMERIC, is_above_ideal_cost BOOLEAN,
  category TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH sales AS (
    SELECT oi.menu_item_slug,
           SUM(oi.qty)                                     AS total_sold,
           SUM(oi.qty * oi.unit_price)                     AS revenue_bhd
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.branch_id = p_branch_id
      AND o.status IN ('delivered','completed')
      AND o.created_at > NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY oi.menu_item_slug
  ),
  costs AS (
    SELECT mis.slug,
           mis.name_ar, mis.name_en, mis.price_bhd,
           SUM(r.quantity
                 * COALESCE(r.yield_factor, ing.default_yield_factor, 1.000)
                 * ing.cost_per_unit) AS dish_cost_bhd
    FROM menu_items_sync mis
    JOIN recipes r ON r.menu_item_slug = mis.slug
    JOIN ingredients ing ON ing.id = r.ingredient_id
    WHERE r.ingredient_id IS NOT NULL
    GROUP BY mis.slug, mis.name_ar, mis.name_en, mis.price_bhd
  ),
  combined AS (
    SELECT c.slug, c.name_ar, c.name_en,
           COALESCE(s.total_sold, 0)::INTEGER AS total_sold,
           COALESCE(s.revenue_bhd, 0)         AS revenue_bhd,
           ROUND(c.dish_cost_bhd, 3)          AS cost_bhd,
           ROUND(c.price_bhd - c.dish_cost_bhd, 3) AS profit_bhd,
           ROUND(((c.price_bhd - c.dish_cost_bhd) / NULLIF(c.price_bhd,0)) * 100, 1) AS margin_pct,
           NULL::NUMERIC                       AS ideal_cost_pct
    FROM costs c LEFT JOIN sales s ON s.menu_item_slug = c.slug
  ),
  averages AS (
    SELECT AVG(total_sold) AS avg_sold, AVG(profit_bhd) AS avg_profit FROM combined
  )
  SELECT slug, name_ar, name_en, total_sold, revenue_bhd, cost_bhd, profit_bhd, margin_pct,
    ideal_cost_pct,
    (cost_bhd / NULLIF(revenue_bhd / NULLIF(total_sold,0), 0) * 100) > COALESCE(ideal_cost_pct, 35) AS is_above_ideal_cost,
    CASE
      WHEN total_sold >= a.avg_sold AND profit_bhd >= a.avg_profit THEN 'Star'
      WHEN total_sold >= a.avg_sold AND profit_bhd <  a.avg_profit THEN 'Plowhorse'
      WHEN total_sold <  a.avg_sold AND profit_bhd >= a.avg_profit THEN 'Puzzle'
      ELSE 'Dog'
    END AS category
  FROM combined, averages a
  ORDER BY total_sold DESC;
$$;


-- ── RPC 11: تصنيف ABC للمكونات (يُستدعى بـ pg_cron أسبوعياً) ────────────
CREATE OR REPLACE FUNCTION rpc_update_abc_classification()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_value  NUMERIC;
  running_pct  NUMERIC := 0;
  v_class      abc_class;
  r            RECORD;
BEGIN
  SELECT SUM(s.on_hand * i.cost_per_unit) INTO total_value
  FROM inventory_stock s JOIN ingredients i ON i.id = s.ingredient_id;

  IF total_value IS NULL OR total_value = 0 THEN RETURN; END IF;

  FOR r IN
    SELECT i.id,
           SUM(s.on_hand * i.cost_per_unit) AS item_value,
           SUM(s.on_hand * i.cost_per_unit) / total_value * 100 AS value_pct
    FROM ingredients i JOIN inventory_stock s ON s.ingredient_id = i.id
    GROUP BY i.id
    ORDER BY item_value DESC
  LOOP
    running_pct := running_pct + r.value_pct;
    v_class := CASE
      WHEN running_pct <= 80 THEN 'A'::abc_class
      WHEN running_pct <= 95 THEN 'B'::abc_class
      ELSE 'C'::abc_class
    END;
    UPDATE ingredients SET abc_class = v_class WHERE id = r.id;
  END LOOP;
END $$;
```

---

### 1.20 — Views + Materialized Views

```sql
-- COGS لكل طبق (يدعم Prep Items)
CREATE VIEW v_dish_cogs AS
SELECT
  mis.slug, mis.name_ar, mis.name_en,
  mis.price_bhd AS selling_price,
  ROUND(SUM(
    CASE WHEN r.ingredient_id IS NOT NULL THEN
      r.quantity * COALESCE(r.yield_factor, ing.default_yield_factor, 1.000) * ing.cost_per_unit
    ELSE
      -- تكلفة prep_item: مجموع مكوناته / batch_yield
      (r.quantity * COALESCE(r.yield_factor, 1.000))
        * (SELECT SUM(pii.quantity * COALESCE(pii.yield_factor, i2.default_yield_factor, 1.000) * i2.cost_per_unit)
             / NULLIF(pi.batch_yield_qty, 0)
           FROM prep_item_ingredients pii JOIN ingredients i2 ON i2.id = pii.ingredient_id
           WHERE pii.prep_item_id = r.prep_item_id)
    END
  ), 4)                                              AS cost_bhd,
  ROUND(mis.price_bhd - SUM(
    CASE WHEN r.ingredient_id IS NOT NULL THEN
      r.quantity * COALESCE(r.yield_factor, ing.default_yield_factor, 1.000) * ing.cost_per_unit
    ELSE 0 END
  ), 4)                                              AS profit_bhd,
  ROUND(
    (1 - SUM(r.quantity * COALESCE(r.yield_factor, COALESCE(ing.default_yield_factor, 1.000)) * COALESCE(ing.cost_per_unit, 0))
          / NULLIF(mis.price_bhd, 0)) * 100, 1)     AS margin_pct
FROM menu_items_sync mis
JOIN recipes r ON r.menu_item_slug = mis.slug
LEFT JOIN ingredients ing ON ing.id = r.ingredient_id
LEFT JOIN prep_items pi ON pi.id = r.prep_item_id
GROUP BY mis.slug, mis.name_ar, mis.name_en, mis.price_bhd;

-- Variance Report (نظري vs فعلي) — يُحدَّث كل ساعة
CREATE MATERIALIZED VIEW mv_variance_report AS
SELECT
  i.id AS ingredient_id, i.name_ar, i.name_en, i.abc_class, s.branch_id,
  COALESCE(th.total, 0) AS theoretical_usage,
  COALESCE(ac.total, 0) AS actual_usage,
  COALESCE(ac.total, 0) - COALESCE(th.total, 0) AS variance,
  CASE WHEN COALESCE(th.total, 0) > 0 THEN
    ROUND(((COALESCE(ac.total,0) - COALESCE(th.total,0)) / COALESCE(th.total,1)) * 100, 1)
  END AS variance_pct,
  ROUND((COALESCE(ac.total,0) - COALESCE(th.total,0)) * i.cost_per_unit, 3) AS variance_cost_bhd
FROM ingredients i
CROSS JOIN (SELECT DISTINCT branch_id FROM inventory_stock) br
JOIN inventory_stock s ON s.ingredient_id = i.id AND s.branch_id = br.branch_id
LEFT JOIN LATERAL (
  SELECT SUM(r.quantity * COALESCE(r.yield_factor, i.default_yield_factor, 1.000) * oi.qty) AS total
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN recipes r ON r.menu_item_slug = oi.menu_item_slug AND r.ingredient_id = i.id
  WHERE o.branch_id = s.branch_id AND o.status IN ('delivered','completed')
    AND o.created_at > NOW() - INTERVAL '7 days'
) th ON true
LEFT JOIN LATERAL (
  SELECT SUM(quantity) AS total FROM inventory_movements
  WHERE ingredient_id = i.id AND branch_id = s.branch_id
    AND movement_type IN ('consumption','waste')
    AND performed_at > NOW() - INTERVAL '7 days'
) ac ON true;

CREATE UNIQUE INDEX ON mv_variance_report(ingredient_id, branch_id);

-- عرض Vendor Performance
CREATE VIEW v_vendor_performance AS
SELECT
  sup.id, sup.name_ar, sup.name_en,
  COUNT(DISTINCT po.id)                            AS total_orders,
  SUM(poi.quantity_ordered * poi.unit_cost)        AS total_spent_bhd,
  ROUND(AVG(CASE WHEN poi.quantity_variance >= 0 THEN 100 ELSE
    GREATEST(0, 100 + (poi.quantity_variance::NUMERIC / NULLIF(poi.quantity_ordered,0)) * 100)
  END), 1)                                         AS delivery_accuracy_pct,
  ROUND(AVG(poi.quality_rating::NUMERIC), 1)       AS avg_quality_rating,
  ROUND(AVG(
    EXTRACT(DAY FROM po.received_at - (po.created_at + (sup.lead_time_days || ' days')::INTERVAL))
  ), 1)                                            AS avg_delay_days,
  COUNT(CASE WHEN po.status = 'cancelled' THEN 1 END) AS cancelled_orders
FROM suppliers sup
JOIN purchase_orders po ON po.supplier_id = sup.id
JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
WHERE po.status = 'received'
GROUP BY sup.id, sup.name_ar, sup.name_en, sup.lead_time_days;

-- عرض قيمة المخزون الإجمالية
CREATE VIEW v_inventory_valuation AS
SELECT
  s.branch_id,
  b.name_ar AS branch_name,
  i.category,
  COUNT(DISTINCT s.ingredient_id)           AS ingredient_count,
  ROUND(SUM(s.on_hand * i.cost_per_unit), 3) AS total_value_bhd,
  ROUND(SUM(s.reserved * i.cost_per_unit), 3) AS reserved_value_bhd
FROM inventory_stock s
JOIN ingredients i ON i.id = s.ingredient_id
JOIN branches b ON b.id = s.branch_id
WHERE i.is_active
GROUP BY s.branch_id, b.name_ar, i.category;
```

---

### 1.21 — RLS Policies

```sql
-- ingredients
CREATE POLICY "ingredients_read"  ON ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "ingredients_write" ON ingredients FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef','inventory_manager'));

-- ingredient_allergens
CREATE POLICY "allergens_read"  ON ingredient_allergens FOR SELECT TO authenticated USING (true);
CREATE POLICY "allergens_write" ON ingredient_allergens FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef','inventory_manager'));

-- recipes
CREATE POLICY "recipes_read"  ON recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipes_write" ON recipes FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef'));

-- prep_items + prep_item_ingredients
CREATE POLICY "prep_read"  ON prep_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "prep_write" ON prep_items FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef','inventory_manager'));
CREATE POLICY "prep_ing_read"  ON prep_item_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "prep_ing_write" ON prep_item_ingredients FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','chef','inventory_manager'));

-- inventory_stock
CREATE POLICY "stock_read" ON inventory_stock FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());

-- inventory_lots
CREATE POLICY "lots_read"  ON inventory_lots FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());
CREATE POLICY "lots_write" ON inventory_lots FOR INSERT TO authenticated WITH CHECK (true);

-- inventory_movements — append-only
CREATE POLICY "movements_insert"    ON inventory_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movements_read"      ON inventory_movements FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());
CREATE POLICY "movements_immutable" ON inventory_movements FOR UPDATE TO authenticated USING (false);
CREATE POLICY "movements_no_delete" ON inventory_movements FOR DELETE TO authenticated USING (false);

-- waste_log
CREATE POLICY "waste_read"    ON waste_log FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());
CREATE POLICY "waste_insert"  ON waste_log FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('owner','general_manager','branch_manager','chef','inventory_manager'));
CREATE POLICY "waste_approve" ON waste_log FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager'));

-- purchase_orders + items
CREATE POLICY "po_read"  ON purchase_orders FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());
CREATE POLICY "po_write" ON purchase_orders FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager','inventory_manager'));
CREATE POLICY "po_items_all" ON purchase_order_items FOR ALL TO authenticated USING (true);

-- suppliers
CREATE POLICY "suppliers_read"  ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_write" ON suppliers FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager'));

-- supplier_price_history
CREATE POLICY "price_history_read"  ON supplier_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_history_write" ON supplier_price_history FOR INSERT TO authenticated WITH CHECK (true);

-- inventory_alerts
CREATE POLICY "alerts_read"   ON inventory_alerts FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());
CREATE POLICY "alerts_update" ON inventory_alerts FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());

-- par_levels
CREATE POLICY "par_read"  ON par_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "par_write" ON par_levels FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager','inventory_manager'));

-- unit_conversions
CREATE POLICY "conversions_read"  ON unit_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversions_write" ON unit_conversions FOR ALL    TO authenticated
  USING (auth_user_role() IN ('owner','general_manager'));

-- inventory_counts
CREATE POLICY "count_read"    ON inventory_counts FOR SELECT TO authenticated
  USING (auth_user_role() IN ('owner','general_manager') OR branch_id = auth_user_branch_id());
CREATE POLICY "count_insert"  ON inventory_counts FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('owner','general_manager','branch_manager','inventory_manager'));
CREATE POLICY "count_approve" ON inventory_counts FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager'));

-- inventory_transfers
CREATE POLICY "transfer_all" ON inventory_transfers FOR ALL TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager','inventory_manager'));
```

---

### 1.22 — Indexes

```sql
CREATE INDEX idx_inventory_movements_order       ON inventory_movements(order_id);
CREATE INDEX idx_inventory_movements_ingredient  ON inventory_movements(ingredient_id, branch_id);
CREATE INDEX idx_inventory_movements_performed   ON inventory_movements(performed_at DESC);
CREATE INDEX idx_inventory_movements_type        ON inventory_movements(movement_type, branch_id);
CREATE INDEX idx_inventory_stock_branch          ON inventory_stock(branch_id);
CREATE INDEX idx_inventory_stock_low             ON inventory_stock(branch_id, on_hand)
  WHERE on_hand <= 0;
CREATE INDEX idx_recipes_slug                    ON recipes(menu_item_slug);
CREATE INDEX idx_recipes_ingredient              ON recipes(ingredient_id);
CREATE INDEX idx_recipes_prep                    ON recipes(prep_item_id);
CREATE INDEX idx_waste_log_branch_date           ON waste_log(branch_id, reported_at DESC);
CREATE INDEX idx_waste_log_pending               ON waste_log(reported_at) WHERE approved_by IS NULL;
CREATE INDEX idx_purchase_orders_branch          ON purchase_orders(branch_id, status);
CREATE INDEX idx_purchase_orders_auto            ON purchase_orders(created_at) WHERE is_auto_generated;
CREATE INDEX idx_inventory_counts_branch         ON inventory_counts(branch_id, counted_at DESC);
CREATE INDEX idx_supplier_price_history          ON supplier_price_history(ingredient_id, effective_at DESC);
CREATE INDEX idx_lots_expiry                     ON inventory_lots(expires_at)
  WHERE expires_at IS NOT NULL AND NOT is_exhausted;
CREATE INDEX idx_ingredients_barcode             ON ingredients(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_ingredients_abc                 ON ingredients(abc_class);
CREATE INDEX idx_par_levels_branch               ON par_levels(branch_id, ingredient_id);
```

---

### 1.23 — pg_cron Jobs (7 مهام)

```sql
-- 1. تحديث Variance Materialized View كل ساعة
SELECT cron.schedule('refresh-variance-report', '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_variance_report$$);

-- 2. تصعيد الهدر المعلَّق كل 30 دقيقة
SELECT cron.schedule('escalate-waste-approvals', '*/30 * * * *',
  $$SELECT rpc_escalate_waste_approvals()$$);

-- 3. فحص الانتهاء وإرسال تنبيهات يومياً الساعة 6 صباحاً
SELECT cron.schedule('check-expiry-alerts', '0 6 * * *', $$
  INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message)
  SELECT branch_id, ingredient_id,
    CASE WHEN days_remaining <= 0 THEN 'expired' ELSE 'expiring_soon' END,
    CASE WHEN days_remaining <= 0 THEN 'critical' ELSE 'warning' END,
    CASE WHEN days_remaining <= 0
      THEN format('⛔ منتهي الصلاحية: %.4f وحدة — تصرّف فوراً', quantity_remaining)
      ELSE format('⚠️ ينتهي خلال %s يوم: %.4f وحدة', days_remaining, quantity_remaining)
    END
  FROM rpc_expiry_report(NULL, 7)
  WHERE days_remaining <= 3
    AND NOT EXISTS (
      SELECT 1 FROM inventory_alerts ia
      WHERE ia.ingredient_id = rpc_expiry_report.ingredient_id
        AND ia.alert_type IN ('expired','expiring_soon')
        AND ia.created_at > NOW() - INTERVAL '24 hours'
    )
$$);

-- 4. إنشاء POs تلقائية يومياً الساعة 6 صباحاً
SELECT cron.schedule('auto-generate-pos', '0 6 * * *',
  $$SELECT rpc_auto_generate_pos()$$);

-- 5. تصنيف ABC أسبوعياً (الاثنين الساعة 3 فجراً)
SELECT cron.schedule('update-abc-classification', '0 3 * * 1',
  $$SELECT rpc_update_abc_classification()$$);

-- 6. كشف Overstock يومياً
SELECT cron.schedule('check-overstock', '0 8 * * *', $$
  INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message)
  SELECT s.branch_id, s.ingredient_id, 'overstock', 'info',
    format('مخزون فائض: %.4f وحدة (الحد الأقصى: %.4f)', s.on_hand, COALESCE(s.max_stock_level, i.max_stock_level))
  FROM inventory_stock s JOIN ingredients i ON i.id = s.ingredient_id
  WHERE s.on_hand > COALESCE(s.max_stock_level, i.max_stock_level)
    AND COALESCE(s.max_stock_level, i.max_stock_level) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM inventory_alerts ia
      WHERE ia.ingredient_id = s.ingredient_id AND ia.branch_id = s.branch_id
        AND ia.alert_type = 'overstock' AND ia.created_at > NOW() - INTERVAL '24 hours'
    )
$$);

-- 7. كشف المخزون الراكد أسبوعياً
SELECT cron.schedule('check-dead-stock', '0 9 * * 1', $$
  INSERT INTO inventory_alerts (branch_id, ingredient_id, alert_type, severity, message)
  SELECT branch_id, ingredient_id, 'dead_stock', 'info',
    format('مخزون راكد %s يوماً — قيمة: %.3f BD', days_inactive, stock_value_bhd)
  FROM rpc_dead_stock_report(NULL, 30)
  WHERE days_inactive > 30
$$);
```

---

## Phase 2 — Excel Import (موسَّع)

### 2.1 — بنية Template (6 Sheets)

**Sheet 1: ingredients (المكونات)**

| الحقل | إجباري | مثال |
|-------|--------|------|
| `name_ar` | ✅ | لحم ضأن |
| `name_en` | ✅ | Lamb |
| `unit` | ✅ | g / kg / ml / l / unit / bottle... |
| `purchase_unit` | — | kg |
| `purchase_unit_factor` | — | 1000 (1kg=1000g) |
| `cost_per_unit` | ✅ | 0.002 |
| `default_yield_factor` | — | 1.15 |
| `category` | — | protein |
| `reorder_point` | — | 5000 |
| `max_stock_level` | — | 20000 |
| `reorder_qty` | — | 10000 |
| `shelf_life_days` | — | 5 |
| `storage_temp` | — | chilled |
| `barcode` | — | 6291003003710 |
| `supplier_name` | — | شركة الفيصل |
| `allergens` | — | dairy,gluten (فاصلة) |

**Sheet 2: prep_items (المكونات المُصنَّعة)**

| الحقل | إجباري | مثال |
|-------|--------|------|
| `name_ar` | ✅ | صلصة الطماطم |
| `name_en` | ✅ | Tomato Sauce |
| `unit` | ✅ | ml |
| `batch_yield_qty` | ✅ | 2000 |
| `shelf_life_hours` | — | 48 |
| `storage_temp` | — | chilled |

**Sheet 3: prep_ingredients (مكونات كل Prep Item)**

| الحقل | إجباري | مثال |
|-------|--------|------|
| `prep_item_name_ar` | ✅ | صلصة الطماطم |
| `ingredient_name_ar` | ✅ | طماطم |
| `quantity` | ✅ | 1500 |
| `yield_factor_override` | — | 1.10 |

**Sheet 4: recipes (الوصفات)**

| الحقل | إجباري | مثال |
|-------|--------|------|
| `menu_item_slug` | ✅ | lamb-kebab |
| `ingredient_name_ar` | — | لحم ضأن |
| `prep_item_name_ar` | — | صلصة الطماطم |
| `quantity` | ✅ | 250 |
| `variant_key` | — | size:large |
| `yield_factor_override` | — | (فارغ) |
| `is_optional` | — | false |

**Sheet 5: opening_stock (الأرصدة الافتتاحية)**

| الحقل | إجباري | مثال |
|-------|--------|------|
| `ingredient_name_ar` | ✅ | لحم ضأن |
| `branch_name` | ✅ | الرفاع |
| `on_hand` | ✅ | 15000 |
| `reorder_point_override` | — | 3000 |
| `lot_number` | — | LOT-001 |
| `expiry_date` | — | 2026-05-15 |
| `unit_cost` | — | 0.0022 |

**Sheet 6: par_levels (مستويات Par)**

| الحقل | إجباري | مثال |
|-------|--------|------|
| `ingredient_name_ar` | ✅ | أرز بسمتي |
| `branch_name` | ✅ | الرفاع |
| `day_type` | ✅ | default / weekend / ramadan |
| `par_qty` | ✅ | 10000 |
| `reorder_qty` | ✅ | 8000 |

---

## Phase 3 — Core UI + POS

### 3.1 — هيكل الصفحات

```
dashboard/inventory/
├── page.tsx                     Overview: KPIs + Low Stock + Expiry + Alerts
├── ingredients/
│   ├── page.tsx                 جدول + بحث + فلتر ABC + بحث barcode
│   ├── new/page.tsx             فورم إضافة (مع allergens + barcode + purchase_unit)
│   └── [id]/page.tsx           تعديل + سجل أسعار + حركات
├── prep-items/                  ← جديد
│   ├── page.tsx                 قائمة sub-recipes
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── recipes/
│   ├── page.tsx                 قائمة الأطباق مع تكلفة كل طبق
│   └── [slug]/page.tsx          BOM Editor (ingredients + prep items)
├── stock/
│   ├── page.tsx                 مخزون كل الفروع
│   └── [branchId]/page.tsx     تفاصيل فرع + lots + opening balance
├── import/page.tsx              Excel Import (6 sheets)
└── par-levels/page.tsx          ← جديد: إدارة مستويات Par
```

### 3.2 — طلبات منصات التوصيل (Phase 3.5)

صاحب المطعم يختار الأسلوب الذي يناسب فريقه — **كلاهما يُنتج نفس النتيجة** في المخزون.

---

#### الخيار A — إدخال يدوي لكل طلب (POS)

مناسب لـ: حجم طلبات منخفض-متوسط، أو عند بداية التشغيل.

```
dashboard/pos/
├── page.tsx
│   ├── تبويب مصدر الطلب:
│   │   [🏠 أكل داخلي] [📞 هاتف] [🛵 طلبات] [🍔 جاهز] [🐦 كيتا] [🎉 تموين]
│   │
│   │   ← عند اختيار talabat/jahez/keeta يظهر:
│   │   ┌─────────────────────────────────────────┐
│   │   │ رقم الطلب من المنصة (مهم لتجنب التكرار) │
│   │   │ TLB- [_______________] ← اختياري         │
│   │   └─────────────────────────────────────────┘
│   │   ℹ️ إذا ستستخدم CSV آخر اليوم → أدخل الرقم
│   │
│   ├── اختيار الفرع
│   ├── قائمة الأطباق مع أزرار + و −
│   ├── فحص المخزون real-time (rpc_check_stock_for_cart)
│   └── [تأكيد الطلب] → order_source + platform_order_id يُحفظان
```

**تجربة الموظف:**
```
السيناريو 1 — يدوي فقط (بدون CSV):
  لا حاجة لإدخال رقم الطلب — اترك الحقل فارغاً

السيناريو 2 — يدوي + CSV آخر اليوم:
  1. يفتح Talabat على الهاتف → يرى الطلب رقم TLB-123456
  2. يفتح POS → يختار [🛵 طلبات] → يكتب "TLB-123456" في الحقل
  3. يُدخل الأصناف → تأكيد (35 ثانية)
  4. آخر اليوم: CSV يُستورَد → TLB-123456 يُتخطَّى تلقائياً ✅
```

---

#### الخيار B — CSV Import من بوابة المنصة (دفعة واحدة)

مناسب لـ: حجم طلبات مرتفع، أو لتسوية نهاية اليوم دفعةً واحدة.

**الطريقة:**
```
1. الموظف يفتح بوابة Talabat/Jahez/Keeta للمطعم
2. يحمّل تقرير الطلبات (Excel/CSV) — كل منصة تدعم هذا
3. يرفعه في لوحة كهرمنة → [استيراد طلبات المنصة]
4. النظام يُنشئ الطلبات تلقائياً ويخصم المخزون دفعةً
```

**جدول ربط أسماء المنصة بالأصناف:**

```sql
-- يُضاف إلى Migration 029
-- المشكلة: Talabat يسمي الطبق "Grilled Chicken" لكن slug-نا "grilled-chicken-special"
-- الحل: جدول ربط يُعبأ مرة واحدة عند الإعداد الأولي

CREATE TABLE delivery_platform_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        TEXT NOT NULL CHECK (platform IN ('talabat','jahez','keeta','other')),
  platform_item_name TEXT NOT NULL,   -- اسم الصنف في بوابة المنصة
  menu_item_slug  TEXT NOT NULL REFERENCES menu_items_sync(slug),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, platform_item_name)
);
ALTER TABLE delivery_platform_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mappings_all" ON delivery_platform_mappings
  FOR ALL TO authenticated
  USING (auth_user_role() IN ('owner','general_manager','branch_manager'));
```

**منطق CSV Import (route.ts):**
```
POST /api/orders/platform-import

1. استقبال CSV + تحديد المنصة (talabat / jahez / keeta)
2. قراءة الصفوف بـ SheetJS
3. لكل صف → استخراج platform_order_id (رقم الطلب الفريد من المنصة)

4. فحص التكرار (Anti-Duplicate Check):
   SELECT id FROM orders
   WHERE order_source = platform AND platform_order_id = X
   → موجود → أضفه لقائمة "مُتخطَّى" (مدخَل يدوياً مسبقاً)
   → غير موجود → تابع للاستيراد

5. لكل صف جديد:
   a. البحث عن platform_item_name في delivery_platform_mappings
   b. لو موجود → ربط بـ menu_item_slug
   c. لو غير موجود → يُضاف لقائمة "أصناف غير مُعرَّفة" للمراجعة

6. Preview قبل التأكيد:
   {
     to_import:  [{ platform_order_id, items, total }],  -- جديد
     duplicates: [{ platform_order_id, entered_at }],    -- مدخَل يدوياً
     unmatched:  [{ item_name, count }]                  -- أصناف غير معروفة
   }

7. عند التأكيد:
   - INSERT orders (order_source = platform, platform_order_id, status = 'delivered')
   - INSERT order_items → trigger يُشغَّل → المخزون يُخصم
   - الـ duplicates تُتخطَّى تلقائياً (لا تُلمس)

8. تقرير نهائي:
   { imported: N, skipped_duplicates: M, unmatched_items: [...] }
```

**قاعدة الأمان الإضافية (Database Level):**
```sql
-- حتى لو كان هناك bug في الكود، قاعدة البيانات ترفض التكرار
-- UNIQUE INDEX يُعيد خطأ 23505 (unique_violation)
-- الكود يلتقطه ويُضيف الطلب لقائمة duplicates بدلاً من crash
ON CONFLICT (order_source, platform_order_id) DO NOTHING
-- RETURNING id → لو NULL = تكرار محذوف
```

**واجهة CSV Import:**
```
┌──────────────────────────────────────────────────────┐
│  📥 استيراد طلبات المنصة                              │
│                                                      │
│  المنصة: [🛵 طلبات ▾]  الفرع: [الرفاع ▾]            │
│                                                      │
│  ┌────────────────────────────────────────┐          │
│  │  اسحب ملف CSV/Excel هنا أو اضغط للرفع  │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  نتائج الفحص:                                         │
│  ✅ 39 طلب جديد — سيُستورَد                            │
│  ⏭ 8 طلبات مُتخطَّاة — مدخَلة يدوياً مسبقاً           │
│     TLB-123456 (09:14) · TLB-123461 (10:02) · ...   │
│  ⚠️ 2 صنف غير معروف:                                 │
│     "Chicken Meal" → [اختر من القائمة ▾] [+ حفظ]    │
│     "Rice Special" → [اختر من القائمة ▾] [+ حفظ]    │
│                                                      │
│  [استيراد الـ 39 طلب ✓]  [إلغاء ✕]                  │
└──────────────────────────────────────────────────────┘
```

**إعداد الربط الأولي (مرة واحدة):**
```
dashboard/delivery-platforms/mappings/page.tsx
  → جدول: اسم الصنف في المنصة | الصنف في كهرمنة | الحالة
  → عند أول import → الأصناف غير المعروفة تظهر هنا للمطابقة
  → بعد المطابقة الأولى → الـ imports القادمة تعمل تلقائياً 100%
```

---

**كلا الخيارين — نفس النتيجة للمخزون:**

```
الخيار A (يدوي):   طلب Talabat → POS → order_source='talabat' → trigger → خصم فوري
الخيار B (CSV):    تقرير Talabat → Import → order_source='talabat' → trigger → خصم دفعي

inventory_movements يسجّل كلاهما بنفس الطريقة تماماً.
التقارير والـ COGS والـ Variance تشمل كلاهما بشكل موحَّد.
```

**متى تستخدم كل خيار:**

| الموقف | الخيار المناسب |
|--------|---------------|
| طلبات Talabat < 20/يوم | A — يدوي (أسرع وأبسط) |
| طلبات Talabat > 20/يوم | B — CSV آخر اليوم |
| بداية التشغيل | A حتى يُعرَّف كل الأصناف |
| بعد إعداد الربط | B (تلقائي 100% بعد أول import) |

---

## Phase 4 — Operational Workflows (موسَّع)

### 4.1 — الهدر (مع سلسلة التصعيد)

```
waste/
├── page.tsx     قائمة الهدر مع مؤشر مستوى التصعيد (⚪BM / 🟡GM / 🔴Owner)
├── new/page.tsx فورم تسجيل هدر + رفع صورة + تحديد السبب
└── actions.ts
    reportWaste()    → INSERT waste_log (escalation_level=0, escalated_at=NOW())
    approveWaste()   → UPDATE approved_by → trigger يخصم المخزون
    rejectWaste()    → UPDATE rejected_by + rejection_note
    -- التصعيد تلقائي بـ rpc_escalate_waste_approvals (pg_cron كل 30 دقيقة)
```

### 4.2 — الجرد (Cycle Count مع ABC)

```
count/
├── page.tsx      جدول الجرد + فلتر ABC + جلسات الجرد
├── new/page.tsx  فورم جرد (mobile-first):
│   ├── يفتح كاميرا → يمسح barcode → يُدخل الكمية
│   ├── النظام يعرض: الكمية النظرية vs المُدخلة
│   └── يحسب الفرق فوراً قبل الإرسال
└── session/[id]/page.tsx  ملخص جلسة جرد كاملة (session grouping)
```

**جدول الجرد بحسب ABC:**
- **A (عالي القيمة):** أسبوعياً — كل أحد
- **B (متوسط):** نصف شهري
- **C (منخفض):** شهري

### 4.3 — المشتريات (مع Lots + Auto-PO)

```
purchases/
├── page.tsx         قائمة POs + تبويب "تلقائي" للـ auto-generated
├── new/page.tsx     إنشاء PO يدوي:
│   ├── اختيار مورد → تُظهر: Reliability %, avg_delay_days
│   ├── اختيار مكونات من قائمة المنخفضة تلقائياً
│   └── يحسب التكلفة الإجمالية قبل الإرسال
├── [id]/page.tsx    تفاصيل PO + استلام:
│   ├── per item: quantity_ordered | quantity_received | variance
│   ├── حقل: lot_number + expiry_date + quality_rating
│   └── عند الحفظ: Lots تُنشأ تلقائياً بـ trigger
└── auto/page.tsx    ← جديد: POs التلقائية في انتظار المراجعة
```

### 4.4 — تتبع المخزون بالـ Lots (FEFO View)

```
stock/[branchId]/lots/page.tsx
  → جدول: مكوّن | Lot# | كمية متبقية | تاريخ الانتهاء | أيام المتبقية
  → تلوين: 🔴 منتهي | 🟡 3 أيام | 🟢 أكثر من 3 أيام
  → ترتيب FEFO: الأقرب انتهاءً أولاً
```

---

## Phase 5 — Reports & Intelligence (12 تقرير)

```
inventory/reports/
├── page.tsx              لوحة التقارير
├── cogs/                 COGS لكل طبق + هامش الربح (v_dish_cogs)
├── variance/             نظري vs فعلي (mv_variance_report) — Chart + Table
├── waste/                الهدر بحسب: السبب | الموظف | الفرع | الوقت
├── valuation/            قيمة المخزون الإجمالية (v_inventory_valuation)
├── menu-engineering/     ← جديد: Star/Plowhorse/Puzzle/Dog Matrix
├── vendor/               ← جديد: Vendor Performance Scorecard
├── dead-stock/           ← جديد: المخزون الراكد (rpc_dead_stock_report)
├── expiry/               ← جديد: تقويم الانتهاء (rpc_expiry_report)
├── price-history/        ← جديد: تاريخ أسعار المكوّن + كشف الارتفاع
├── abc-analysis/         ← جديد: تصنيف ABC + جدول الجرد المقترح
└── food-cost/            ← جديد: تكلفة الطعام الفعلية vs المثالية
```

### تفاصيل التقارير الجديدة

**Menu Engineering Matrix:**
```
┌─────────────────────────────────────────────┐
│              ربح مرتفع                        │
│    PUZZLE ←──────────────→ STAR             │
│   (طلب منخفض)              (طلب مرتفع)      │
│ ─────────────────────────────────────────── │
│    DOG   ←──────────────→ PLOWHORSE         │
│              ربح منخفض                       │
└─────────────────────────────────────────────┘
```
Stars → حافظ + برز | Plowhorses → ارفع السعر تدريجياً
Puzzles → روّج أكثر  | Dogs → أعد النظر في بقائه في القائمة

**Vendor Scorecard:**
```
المورد          | الطلبات | الإنفاق BD | الدقة % | الجودة | متأخر أيام
شركة الفيصل   | 24      | 4,850.000  | 96.2%   | ⭐4.3  | +0.5 يوم
```

**Food Cost Analysis:**
- التكلفة الفعلية هذا الشهر: 31.5%
- التكلفة المثالية: 28%
- الفجوة: 3.5% = X BD خسارة محتملة

---

## Phase 6 — Dashboard Integration

```
dashboard/orders/actions.ts
  → error handling: INSUFFICIENT_STOCK (P0001) → رسالة واضحة للزبون
  → error handling: MISSING_STOCK_RECORD (P0002) → تنبيه للـ inventory_manager
  → إضافة order_source في createOrder()

dashboard/page.tsx (الرئيسية)
  → LowStockWidget: أحمر (نافد) + أصفر (منخفض) + تاريخ أقرب انتهاء
  → WasteEscalationWidget: الهدر المعلَّق في انتظار موافقة

menu/[slug]/page.tsx (checkout)
  → rpc_check_stock_for_cart() قبل إنشاء الطلب
  → "نفذ المخزون" مع إخفاء زر الإضافة للسلة
```

---

## Phase 7 — Advanced Features (أسبوع 5-6)

### 7.1 — Catering Stock Planning

```sql
-- حجز مخزون لحدث catering مستقبلي
CREATE OR REPLACE FUNCTION rpc_catering_reserve(
  p_branch_id      UUID,
  p_event_date     DATE,
  p_menu_items     JSONB,   -- [{ slug, qty }]
  p_catering_order_id UUID,
  p_staff_id       UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
...
-- يُضيف إلى catering_reserved في inventory_stock
-- يُنشئ حركة 'catering_reserve'
$$;
```

```
inventory/catering/
├── page.tsx     قائمة حجوزات Catering مع الكميات المحجوزة
├── new/page.tsx إنشاء حجز: تاريخ الفعالية + الأطباق + الكميات
│   ├── يحسب المكونات المطلوبة تلقائياً من الوصفات
│   ├── يعرض: متاح الآن | مطلوب | العجز إن وُجد
│   └── يُنشئ PO مقترح للعجز
```

### 7.2 — Budget vs Actual Food Cost

```
inventory/budget/
├── page.tsx     مقارنة شهرية: الميزانية المُعتمدة vs التكلفة الفعلية
│   ├── إدخال ميزانية Food Cost % لكل شهر
│   ├── الفعلي يُحسب من: SUM(movements.quantity * cost) / total_revenue
│   └── Chart شهري + تنبيه لو تجاوز الميزانية
```

### 7.3 — Demand Forecasting (أساسي)

```sql
-- توقع الاستهلاك الأسبوعي بناءً على average 4 أسابيع
CREATE VIEW v_demand_forecast AS
SELECT ingredient_id, branch_id,
  AVG(weekly_usage) AS avg_weekly,
  AVG(weekly_usage) * 1.1 AS forecast_with_buffer,  -- + 10% هامش أمان
  AVG(weekly_usage) / 7 AS avg_daily
FROM (
  SELECT ingredient_id, branch_id,
    EXTRACT(WEEK FROM performed_at) AS week_num,
    SUM(quantity) AS weekly_usage
  FROM inventory_movements
  WHERE movement_type = 'consumption'
    AND performed_at > NOW() - INTERVAL '28 days'
  GROUP BY ingredient_id, branch_id, week_num
) weekly
GROUP BY ingredient_id, branch_id;
```

---

## هيكل الملفات الكامل

```
kahramana-Saas/
├── supabase/migrations/029_inventory_core.sql      ← Phase 1
│
├── src/
│   ├── app/
│   │   ├── api/inventory/
│   │   │   ├── template/route.ts                  ← Phase 2 (GET: 6-sheet Excel)
│   │   │   └── import/route.ts                    ← Phase 2 (POST: parse + insert)
│   │   ├── api/orders/
│   │   │   └── platform-import/route.ts           ← Phase 3.5 (POST: CSV منصات التوصيل)
│   │   │
│   │   └── [locale]/dashboard/
│   │       ├── pos/page.tsx                       ← Phase 3.5 (الخيار A: إدخال يدوي)
│   │       ├── delivery-platforms/
│   │       │   ├── import/page.tsx                ← Phase 3.5 (الخيار B: CSV Import)
│   │       │   ├── import/actions.ts
│   │       │   └── mappings/page.tsx              ← Phase 3.5 (إعداد ربط الأصناف)
│   │       └── inventory/
│   │           ├── page.tsx                       ← Phase 3
│   │           ├── ingredients/page.tsx
│   │           ├── ingredients/new/page.tsx
│   │           ├── ingredients/[id]/page.tsx
│   │           ├── ingredients/[id]/actions.ts
│   │           ├── prep-items/page.tsx            ← Phase 3 (جديد)
│   │           ├── prep-items/new/page.tsx
│   │           ├── prep-items/[id]/page.tsx
│   │           ├── recipes/page.tsx
│   │           ├── recipes/[slug]/page.tsx
│   │           ├── recipes/[slug]/actions.ts
│   │           ├── stock/page.tsx
│   │           ├── stock/[branchId]/page.tsx
│   │           ├── stock/[branchId]/lots/page.tsx ← Phase 4 (FEFO view)
│   │           ├── par-levels/page.tsx            ← Phase 3 (جديد)
│   │           ├── import/page.tsx
│   │           ├── import/actions.ts
│   │           ├── waste/page.tsx
│   │           ├── waste/new/page.tsx
│   │           ├── waste/actions.ts
│   │           ├── count/page.tsx
│   │           ├── count/new/page.tsx
│   │           ├── count/session/[id]/page.tsx    ← Phase 4
│   │           ├── count/actions.ts
│   │           ├── purchases/page.tsx
│   │           ├── purchases/new/page.tsx
│   │           ├── purchases/auto/page.tsx        ← Phase 4 (جديد)
│   │           ├── purchases/[id]/page.tsx
│   │           ├── purchases/[id]/actions.ts
│   │           ├── purchases/actions.ts
│   │           ├── transfers/page.tsx
│   │           ├── transfers/actions.ts
│   │           ├── reports/
│   │           │   ├── page.tsx
│   │           │   ├── cogs/page.tsx
│   │           │   ├── variance/page.tsx
│   │           │   ├── waste/page.tsx
│   │           │   ├── valuation/page.tsx
│   │           │   ├── menu-engineering/page.tsx  ← Phase 5
│   │           │   ├── vendor/page.tsx            ← Phase 5
│   │           │   ├── dead-stock/page.tsx        ← Phase 5
│   │           │   ├── expiry/page.tsx            ← Phase 5
│   │           │   ├── price-history/page.tsx     ← Phase 5
│   │           │   ├── abc-analysis/page.tsx      ← Phase 5
│   │           │   └── food-cost/page.tsx         ← Phase 5
│   │           ├── catering/page.tsx              ← Phase 7
│   │           └── budget/page.tsx                ← Phase 7
│   │
│   ├── components/inventory/
│   │   ├── IngredientTable.tsx
│   │   ├── IngredientForm.tsx                     (+ barcode + allergens + purchase_unit)
│   │   ├── AllergenSelector.tsx                   ← جديد
│   │   ├── BarcodeField.tsx                       ← جديد
│   │   ├── RecipeEditor.tsx                       (+ prep items support)
│   │   ├── PrepItemForm.tsx                       ← جديد
│   │   ├── StockTable.tsx
│   │   ├── LotTable.tsx                           ← جديد (FEFO view)
│   │   ├── OpeningBalanceForm.tsx
│   │   ├── ImportDropzone.tsx
│   │   ├── ImportPreview.tsx
│   │   ├── ParLevelForm.tsx                       ← جديد
│   │   ├── WasteLogForm.tsx
│   │   ├── WasteApprovalCard.tsx                  (+ escalation badge)
│   │   ├── CycleCountForm.tsx                     (+ barcode scan)
│   │   ├── POForm.tsx                             (+ auto-suggest from low stock)
│   │   ├── POReceiveForm.tsx                      (+ lot_number + expiry + quality)
│   │   ├── TransferForm.tsx
│   │   ├── LowStockWidget.tsx
│   │   ├── ExpiryCalendarWidget.tsx               ← جديد
│   │   ├── WasteEscalationWidget.tsx              ← جديد
│   │   └── reports/
│   │       ├── COGSTable.tsx
│   │       ├── VarianceChart.tsx
│   │       ├── WasteBreakdown.tsx
│   │       ├── InventoryValuation.tsx
│   │       ├── MenuEngineeringMatrix.tsx          ← جديد
│   │       ├── VendorScorecard.tsx                ← جديد
│   │       ├── DeadStockTable.tsx                 ← جديد
│   │       ├── ExpiryReport.tsx                   ← جديد
│   │       ├── PriceHistoryChart.tsx              ← جديد
│   │       ├── ABCAnalysisTable.tsx               ← جديد
│   │       └── FoodCostAnalysis.tsx               ← جديد
│   │
│   └── lib/inventory/
│       ├── excel-template.ts                      (6 sheets)
│       ├── excel-parser.ts
│       ├── export.ts
│       ├── fefo.ts                                ← جديد (FEFO logic helpers)
│       └── conversions.ts                         ← جديد (unit conversion helpers)
```

---

## قائمة التحقق (Verification Checklist)

### بعد migration 029
```sql
-- 17 جدول جديد
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN (
    'ingredients','ingredient_allergens','supplier_price_history',
    'prep_items','prep_item_ingredients','recipes',
    'inventory_stock','inventory_lots','inventory_movements',
    'purchase_orders','purchase_order_items','waste_log',
    'inventory_counts','inventory_transfers','par_levels',
    'unit_conversions','suppliers','inventory_alerts',
    'delivery_platform_mappings'
  );

-- 2 ENUMs جديدة
SELECT typname FROM pg_type WHERE typname IN ('inventory_movement_type','abc_class');

-- 3 Triggers
SELECT trigger_name FROM information_schema.triggers
  WHERE trigger_name IN ('trg_inventory_reserve','trg_inventory_finalize',
    'trg_waste_deduct','trg_po_receive_create_lot');

-- 11 RPCs
SELECT proname FROM pg_proc WHERE proname LIKE 'rpc_%';

-- 7 pg_cron jobs
SELECT jobname FROM cron.job;

-- RLS فعّال على الكل
SELECT relname FROM pg_class c JOIN pg_tables t ON t.tablename = c.relname
WHERE t.schemaname = 'public' AND NOT c.relrowsecurity
  AND t.tablename IN ('ingredients','inventory_stock','inventory_lots','waste_log');
-- يجب أن يُرجع صفر صفوف
```

### بعد Excel Import
```
✅ ingredients: N صف مُدرَج
✅ prep_items + prep_item_ingredients: N صف
✅ recipes: N صف (ingredients + prep_items)
✅ inventory_stock: أرصدة افتتاحية مع Lots
✅ par_levels: مستويات Par لكل فرع
✅ أول طلب → inventory_movements يسجل reservations
✅ delivered → on_hand ينقص، Lots تُحدَّث
✅ waste_log INSERT → escalation_level = 0
✅ 30 دقيقة بدون موافقة → escalation_level = 1 (pg_cron)
```

### اختبار Anti-Duplicate (يدوي + CSV)
```sql
-- 1. أدخل طلب يدوياً عبر POS مع platform_order_id = 'TLB-TEST-001'
-- 2. ارفع CSV يحتوي على نفس الرقم TLB-TEST-001
-- 3. تحقق: الطلب لم يُستورَد مرة ثانية
SELECT COUNT(*) FROM orders
WHERE order_source = 'talabat' AND platform_order_id = 'TLB-TEST-001';
-- يجب أن يُرجع 1 (وليس 2)

-- 4. تحقق من قائمة المتخطَّيات في نتيجة الـ Import
-- يجب أن يظهر TLB-TEST-001 في skipped_duplicates

-- 5. تحقق: inventory_movements لا يحتوي سوى على حركة واحدة للطلب
SELECT COUNT(*) FROM inventory_movements WHERE order_id =
  (SELECT id FROM orders WHERE platform_order_id = 'TLB-TEST-001');
-- يجب أن يُرجع عدد الأصناف (لا ضعفها)
```

### بعد كل Phase
```bash
npx tsc --noEmit    # صفر أخطاء TypeScript
npm run build       # Build ناجح
grep -rn "as any" src/app/\[locale\]/dashboard/inventory/  # صفر (إلا admin API)
```

---

## الجدول الزمني (8 أسابيع)

| الأسبوع | Phase | المخرج |
|---------|-------|--------|
| 1 | Phase 1 + Phase 2 | migration 029 (17 جدول) + Excel Import جاهز للتسليم |
| 2 | Phase 3 | Core UI: مكونات + prep items + وصفات + POS بجميع المصادر |
| 3 | Phase 4 | Workflows: هدر (مع تصعيد) + جرد ABC + مشتريات (مع Lots) |
| 4 | Phase 5 | 12 تقرير متقدم (Menu Engineering + Vendor + Dead Stock...) |
| 5 | Phase 6 | Dashboard integration + LowStockWidget + ExpiryWidget |
| 6 | Phase 7 | Catering planning + Budget vs Actual + Forecasting |
| 7 | Testing (الرفاع) | اختبار شامل على فرع واحد + تدريب الفريق |
| 8 | Rollout (القلالي) | توسيع للفرع الثاني + fine-tuning |

**صاحب المطعم يبدأ رفع البيانات من نهاية الأسبوع 1.**
**النظام يُفعَّل تدريجياً — كل وصفة تُدخَل تبدأ تخصم المخزون فوراً.**

---

## ملخص المزايا التنافسية

| الميزة | كهرمنة | MarketMan | BlueCart |
|--------|---------|-----------|----------|
| FEFO Lot Tracking | ✅ | ✅ | ✅ |
| Sub-recipes (Prep Items) | ✅ | ✅ | ⚠️ محدود |
| Menu Engineering Matrix | ✅ | ✅ | ❌ |
| Auto-PO Generation | ✅ | ✅ | ✅ |
| Waste Escalation Chain | ✅ | ❌ | ❌ |
| ABC Cycle Count | ✅ | ✅ | ⚠️ |
| Vendor Performance Scorecard | ✅ | ✅ | ⚠️ |
| Allergen Tracking | ✅ | ⚠️ | ❌ |
| Dynamic Par Levels | ✅ | ✅ | ❌ |
| Catering Stock Planning | ✅ | ❌ | ❌ |
| Multi-source Orders (Talabat+...) | ✅ | ❌ | ❌ |
| Budget vs Actual | ✅ | ✅ | ❌ |
| Demand Forecasting | ✅ أساسي | ✅ متقدم | ❌ |
| Barcode Support | ✅ | ✅ | ✅ |
| Price Spike Alerts | ✅ تلقائي | ✅ | ⚠️ |
| Real-time Alerts | ✅ Supabase | ✅ | ⚠️ |
| Multi-branch | ✅ | ✅ | ✅ |
| سعر الاشتراك الشهري | مدمج في المنتج | $150-400 | $100-250 |
