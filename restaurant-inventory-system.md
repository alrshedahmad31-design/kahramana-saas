# نظام إدارة مخزون المطاعم — وثيقة تقنية شاملة

> معدّة لفريق Backend وProduct Manager
> السياق: مطعم متعدد الفروع، Next.js 15 + Supabase (PostgreSQL) + Vercel
> التاريخ: أبريل 2026

---

## 1. هيكل Backend لإدارة المخزون

### الفلسفة المعمارية

القاعدة الذهبية: **لا يوجد كود تطبيقي يعدّل المخزون مباشرة.** كل تعديل يمر عبر:
- **Trigger** (أوتوماتيكي عند حدث DB)
- **RPC/Stored Procedure** (يُستدعى من الكود لكن المنطق في Postgres)

السبب: الـ atomicity. لو الكود يخصم المخزون والـ webhook يخصم بشكل منفصل، تحصل race conditions وخصومات مزدوجة. PostgreSQL يضمن ACID — استغل هذا.

### البنية المقترحة (3 طبقات)

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  Dashboard UI (Next.js Server Components + Client)       │
│  ├── /inventory          → Overview + Low Stock Alerts   │
│  ├── /inventory/recipes  → BOM Editor                    │
│  ├── /inventory/stock    → Live Stock per Branch         │
│  ├── /inventory/count    → Cycle Count (Mobile-first)    │
│  ├── /inventory/purchases → Purchase Orders              │
│  ├── /inventory/waste    → Waste Log                     │
│  └── /inventory/reports  → COGS + Variance + Valuation   │
└──────────────────────┬──────────────────────────────────┘
                       │ Server Actions / RPCs
┌──────────────────────▼──────────────────────────────────┐
│                    Business Logic Layer                   │
│  PostgreSQL Functions (SECURITY DEFINER)                 │
│  ├── rpc_check_stock_for_cart()    → Pre-checkout check  │
│  ├── rpc_low_stock_alerts()        → Dashboard widget    │
│  ├── rpc_inventory_count_submit()  → Cycle count apply   │
│  ├── rpc_receive_purchase_order()  → PO receipt          │
│  ├── rpc_log_waste()               → Waste entry         │
│  ├── rpc_transfer_stock()          → Inter-branch move   │
│  └── rpc_cogs_report()             → Cost analysis       │
└──────────────────────┬──────────────────────────────────┘
                       │ Triggers (automatic)
┌──────────────────────▼──────────────────────────────────┐
│                    Data Layer                             │
│  PostgreSQL Tables (RLS enforced)                        │
│  ├── ingredients          → Raw materials catalog        │
│  ├── suppliers            → Vendor directory             │
│  ├── recipes              → BOM (Bill of Materials)      │
│  ├── inventory_stock      → Denormalized live balance    │
│  ├── inventory_movements  → Immutable audit ledger       │
│  ├── purchase_orders      → Procurement                  │
│  ├── purchase_order_items → PO line items                │
│  ├── inventory_counts     → Physical count records       │
│  ├── waste_log            → Spoilage/damage tracking     │
│  └── inventory_transfers  → Inter-branch movements       │
└─────────────────────────────────────────────────────────┘
```

### لماذا Ledger + Cache Pattern؟

| المكون | الدور | المثال |
|--------|-------|--------|
| `inventory_movements` | **Source of Truth** — append-only، غير قابل للتعديل | كل حركة: شراء، حجز، استهلاك، إلغاء، هدر، جرد |
| `inventory_stock` | **Cache** — يُحسب من الـ ledger عبر trigger | `on_hand`, `reserved`, متاح = on_hand - reserved |

الفائدة: الـ ledger يوفر audit trail كامل (من عدّل ماذا ومتى). الـ cache يوفر قراءات O(1) بدل aggregations ثقيلة.

---

## 2. منطق الربط بين المبيعات والمخزون

### التدفق الكامل

```
الطلب يُنشأ (أي مصدر)
        │
        ▼
  INSERT order_items
        │
        ├──→ Trigger: trg_kds_enqueue (موجود حالياً)
        │    └── ينشئ kds_queue rows للمطبخ
        │
        └──→ Trigger: trg_inventory_reserve (جديد)
             └── لكل order_item:
                 1. اقرأ recipes WHERE menu_item_slug = item.slug
                 2. لكل مكوّن في الوصفة:
                    quantity_needed = recipe.quantity × recipe.yield_factor × item.qty
                 3. UPDATE inventory_stock SET reserved += quantity_needed
                    WHERE available >= quantity_needed
                    (ذرّي — لو المخزون لا يكفي → RAISE EXCEPTION)
                 4. INSERT inventory_movements (type='reservation')

الطلب يُسلَّم (status → 'delivered')
        │
        └──→ Trigger: trg_inventory_finalize
             └── لكل reservation سابقة:
                 1. UPDATE inventory_stock:
                    reserved -= quantity
                    on_hand -= quantity
                 2. INSERT inventory_movements (type='consumption')

الطلب يُلغى (status → 'cancelled')
        │
        └──→ Trigger: trg_inventory_release
             └── لكل reservation سابقة:
                 1. UPDATE inventory_stock:
                    reserved -= quantity
                    (on_hand يبقى كما هو — المواد ترجع للمتاح)
                 2. INSERT inventory_movements (type='release')
```

### مصادر الطلبات — الفجوة الحرجة

المطعم يستقبل طلبات من قنوات متعددة. **كل قناة لازم تمر عبر نفس pipeline:**

```
┌──────────────────┐
│  Website Orders  │──┐
├──────────────────┤  │
│  Walk-in / POS   │──┤
├──────────────────┤  │     ┌──────────────────┐     ┌─────────────────┐
│  Talabat         │──┼────▶│  orders table     │────▶│  inventory      │
├──────────────────┤  │     │  + order_items    │     │  triggers       │
│  Jahez           │──┤     │  (order_source)   │     │  (auto-deduct)  │
├──────────────────┤  │     └──────────────────┘     └─────────────────┘
│  Keeta           │──┤
├──────────────────┤  │
│  Phone Orders    │──┘
└──────────────────┘
```

الحل: إضافة عمود `order_source` على `orders`:

```sql
ALTER TABLE orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'website'
  CHECK (order_source IN (
    'website',    -- طلبات الموقع
    'walk_in',    -- طلبات داخل المطعم
    'talabat',    -- تطبيق طلبات
    'jahez',      -- تطبيق جاهز
    'keeta',      -- تطبيق كيتا
    'phone',      -- طلبات هاتفية
    'other'       -- مصادر أخرى
  ));
```

### order_source — تحقق قبل الإضافة

> ⚠️ قبل إضافة العمود في migration 029:
> ```bash
> npx supabase db diff --linked
> ```
> تحقق أن العمود غير موجود أصلاً.
> لو موجود (من migration سابقة)، تخطّى الـ ALTER TABLE.
> استخدم IF NOT EXISTS pattern:
> ```sql
> DO $$ BEGIN
>   IF NOT EXISTS (SELECT 1 FROM information_schema.columns
>     WHERE table_name='orders' AND column_name='order_source') THEN
>     ALTER TABLE orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'website'
>       CHECK (order_source IN ('website','walk_in','talabat','jahez','keeta','phone','other'));
>   END IF;
> END $$;
> ```

**الطريقة الحالية الواقعية:** الكاشير يدخل طلبات التوصيل يدوياً عبر POS dashboard. الـ triggers تخصم المخزون تلقائياً بغض النظر عن المصدر.

**الطريقة المثالية (لاحقاً):** Deliverect أو Otter يستقبل طلبات كل المنصات عبر webhook ويحولها لـ `orders` + `order_items` أوتوماتيكياً.

---

## 3. خصم المكونات تلقائياً عند البيع

### Trigger الحجز (Reserve on Order)

```sql
CREATE OR REPLACE FUNCTION fn_inventory_reserve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_branch_id UUID;
  r RECORD;
  v_required NUMERIC;
BEGIN
  -- جلب الفرع من الطلب الأب
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

  -- لكل مكوّن في وصفة هذا الصنف
  FOR r IN
    SELECT r.ingredient_id,
           r.quantity * COALESCE(r.yield_factor, i.yield_factor) AS qty_per_unit
    FROM recipes r
    JOIN ingredients i ON i.id = r.ingredient_id
    WHERE r.menu_item_slug = NEW.menu_item_slug
      AND (r.variant_key IS NULL
           OR r.variant_key = COALESCE(NEW.selected_variant, NEW.size))
  LOOP
    v_required := r.qty_per_unit * NEW.qty;

    -- تحقق أولاً: هل الـ row موجود أصلاً؟
    IF NOT EXISTS (
      SELECT 1 FROM inventory_stock
      WHERE branch_id = v_branch_id AND ingredient_id = r.ingredient_id
    ) THEN
      RAISE EXCEPTION 'MISSING_STOCK_RECORD: ingredient=% branch=% — run opening balance first',
        r.ingredient_id, v_branch_id
        USING ERRCODE = 'P0002';
    END IF;

    -- ثم حاول الحجز (خصم ذرّي: يفحص التوفر ويحجز في نفس اللحظة)
    UPDATE inventory_stock
       SET reserved = reserved + v_required,
           last_movement_at = NOW()
     WHERE branch_id = v_branch_id
       AND ingredient_id = r.ingredient_id
       AND (on_hand - reserved) >= v_required;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: ingredient=% required=% branch=%',
        r.ingredient_id, v_required, v_branch_id
        USING ERRCODE = 'P0001';
    END IF;

    -- تسجيل الحركة في السجل
    INSERT INTO inventory_movements
      (branch_id, ingredient_id, movement_type, quantity,
       order_id, order_item_id, performed_at)
    VALUES
      (v_branch_id, r.ingredient_id, 'reservation', v_required,
       NEW.order_id, NEW.id, NOW());
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_reserve
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_inventory_reserve();
```

### Trigger التحويل عند التوصيل/الإلغاء

```sql
CREATE OR REPLACE FUNCTION fn_inventory_finalize_or_release()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  v_type inventory_movement_type;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status IN ('delivered','completed') THEN
    v_type := 'consumption';
  ELSIF NEW.status = 'cancelled' THEN
    v_type := 'release';
  ELSE
    RETURN NEW;  -- حالات وسيطة لا تؤثر على المخزون
  END IF;

  FOR m IN
    SELECT ingredient_id, SUM(quantity) AS total_qty
    FROM inventory_movements
    WHERE order_id = NEW.id AND movement_type = 'reservation'
    GROUP BY ingredient_id
  LOOP
    UPDATE inventory_stock
       SET reserved = reserved - m.total_qty,
           on_hand  = CASE WHEN v_type = 'consumption'
                           THEN on_hand - m.total_qty
                           ELSE on_hand END,
           last_movement_at = NOW()
     WHERE branch_id = NEW.branch_id
       AND ingredient_id = m.ingredient_id;

    INSERT INTO inventory_movements
      (branch_id, ingredient_id, movement_type, quantity, order_id, performed_at)
    VALUES
      (NEW.branch_id, m.ingredient_id, v_type, m.total_qty, NEW.id, NOW());
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_finalize
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('delivered','completed','cancelled'))
  EXECUTE FUNCTION fn_inventory_finalize_or_release();
```

### لماذا Reserve → Consume بدل خصم مباشر؟

| النهج | المشكلة |
|-------|---------|
| خصم مباشر عند الطلب | لو الطلب يُلغى، تحتاج إضافة المكونات يدوياً — فوضى |
| خصم عند التوصيل فقط | المخزون يبدو متوفراً أثناء التحضير — قد تقبل طلبات أكثر من المتاح |
| **Reserve → Consume** | المخزون محجوز فوراً (لا overselling)، يتحول لاستهلاك عند التوصيل، يُفرج عند الإلغاء |

### معالجة المنتجات بدون وصفة

```sql
-- داخل fn_inventory_reserve:
-- لو المنتج ليس له recipe (مثل مشروبات معلبة)
-- الـ FOR loop لن يُنتج صفوفاً → لا حجز يحدث
-- لكن نسجّل تحذير في جدول alerts
IF NOT FOUND AND NOT EXISTS (
  SELECT 1 FROM recipes WHERE menu_item_slug = NEW.menu_item_slug
) THEN
  INSERT INTO inventory_alerts (branch_id, alert_type, message, created_at)
  VALUES (v_branch_id, 'unmapped_item',
    format('Item "%s" has no recipe — inventory not tracked', NEW.menu_item_slug),
    NOW());
END IF;
```

### معالجة أخطاء المخزون في Next.js

```typescript
// src/app/[locale]/checkout/actions.ts
export async function createOrder(formData: FormData) {
  // 1. Pre-check: هل المخزون يكفي؟
  const { data: stockCheck } = await supabase.rpc('rpc_check_stock_for_cart', {
    p_branch_id: branchId,
    p_items: cartItems.map(i => ({ slug: i.slug, quantity: i.qty, variant: i.variant }))
  });

  const insufficient = stockCheck?.filter(s => !s.is_sufficient);
  if (insufficient?.length) {
    return {
      error: 'INSUFFICIENT_STOCK',
      items: insufficient.map(s => ({
        slug: s.menu_item_slug,
        ingredient: s.ingredient_name,
        required: s.required,
        available: s.available
      }))
    };
  }

  // 2. إنشاء الطلب (trigger يحجز المخزون)
  const { error } = await supabase.from('order_items').insert(items);

  if (error?.message.includes('INSUFFICIENT_STOCK')) {
    // Race condition: شخص آخر أخذ المخزون بين الـ check والـ insert
    return { error: 'STOCK_CHANGED', message: 'المخزون تغيّر، حاول مرة أخرى' };
  }

  if (error?.message.includes('MISSING_STOCK_RECORD')) {
    // مكوّن بدون رصيد افتتاحي — مشكلة إعداد
    console.error('Missing stock record:', error.message);
    return { error: 'SYSTEM_ERROR', message: 'خطأ في النظام، تواصل مع الإدارة' };
  }
}
```

الأماكن التي تحتاج تعديل في الكود الحالي:
- `src/app/[locale]/checkout/` — إضافة rpc_check_stock_for_cart قبل الإنشاء
- `src/components/checkout/CheckoutForm.tsx` — عرض أسماء الأصناف غير المتوفرة
- `src/app/[locale]/dashboard/pos/` (جديد) — نفس المعالجة
- `src/components/menu/ItemCard.tsx` — اختيارياً: تعطيل زر "أضف للسلة" لو المنتج نافد

### التعامل مع نفاد صنف واحد من الطلب

**المشكلة:** الزبون يطلب 3 أصناف، الثالث غير متوفر. الـ exception الحالي يلغي الطلب كلياً.

**الحل — Pre-check + UI flow:**

- `rpc_check_stock_for_cart()` يُشغَّل قبل الـ INSERT
- لو أصناف غير متوفرة: → UI يعرض: "الأصناف التالية غير متوفرة حالياً: [قائمة]"
  - خيارات: [إتمام الطلب بدون هذه الأصناف] [إلغاء الطلب]
- الزبون يقرر → الطلب يُنشأ بالأصناف المتوفرة فقط
- لا يصل أبداً للـ RAISE EXCEPTION (الـ pre-check يمسكه)

**لماذا لا نعدّل الـ trigger نفسه؟**

الـ trigger يبقى كـ safety net — لو race condition بين الـ check والـ insert. لكن في الحالة العادية، الـ UI يمنع الوصول لهذه الحالة.

---

## 4. إدارة الوصفات — Bill of Materials (BOM)

### الجدول الأساسي

```sql
CREATE TABLE recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_slug  TEXT NOT NULL REFERENCES menu_items_sync(slug) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity        NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  is_optional     BOOLEAN NOT NULL DEFAULT false,
  variant_key     TEXT,           -- 'size:large', 'variant:with_broth'
  yield_factor    NUMERIC(5,3),  -- NULL = استخدم قيمة ingredients. override لحالات خاصة فقط
  notes           TEXT,
  updated_by      UUID REFERENCES staff_basic(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PostgreSQL 15+: NULL = NULL في UNIQUE constraint
  -- بدونها يمكن إدخال نفس المكوّن مرتين لنفس الطبق عندما variant_key = NULL
  UNIQUE NULLS NOT DISTINCT (menu_item_slug, ingredient_id, variant_key)
);
```

### مثال عملي: كباب لحم (Lamb Kebab)

| المكوّن | الكمية | الوحدة | yield_factor | الفعلي |
|---------|--------|--------|--------------|--------|
| لحم ضأن | 250 | g | 1.15 | 287.5g (15% فاقد تنظيف) |
| بصل | 50 | g | 1.10 | 55g |
| بهارات كباب | 5 | g | 1.00 | 5g |
| ملح | 2 | g | 1.00 | 2g |
| خبز عراقي | 1 | unit | 1.00 | 1 |
| طماطم مشوية | 80 | g | 1.05 | 84g |
| سماق | 1 | g | 1.00 | 1g |

عند بيع 3 كباب، المخزون يخصم:
- لحم ضأن: 287.5 × 3 = 862.5g
- بصل: 55 × 3 = 165g
- ... وهكذا

### yield_factor — لماذا هو حرج؟

`yield_factor` = المعامل الحقيقي للاستهلاك بعد حساب الفاقد الطبيعي:
- لحم خروف: تشتري 1 كيلو، بعد التنظيف يبقى ~870g → factor = 1.15
- بصل: تشتري 1 كيلو، بعد التقشير يبقى ~900g → factor = 1.10
- توابل جافة: فاقد صفري → factor = 1.00

**بدون yield_factor:** المخزون النظري يبدو أكثر من الفعلي دائماً → variance مستمر.

> **yield_factor مزدوج:** القيمة الافتراضية في `ingredients` (فاقد اللحم 15% ثابت).
> Override في `recipes` فقط عند اختلاف (لحم مفروم 5% vs قطع 15% من نفس المكوّن).
> `COALESCE(recipe.yield_factor, ingredient.yield_factor)` يختار الأدق.

```sql
-- في جدول ingredients (حقل جديد في migration 029):
yield_factor    NUMERIC(5,3) NOT NULL DEFAULT 1.000,  -- الفاقد الافتراضي للمكوّن

-- في جدول recipes (nullable — override فقط عند الحاجة):
yield_factor    NUMERIC(5,3),  -- NULL = استخدم قيمة ingredients
```

### التعامل مع Variants و Sizes

```
كوزي (Quzi):
├── size:small  → لحم 400g, أرز 300g, مكسرات 30g
├── size:large  → لحم 800g, أرز 600g, مكسرات 60g
└── variant:with_broth → نفس الأحجام + مرق 200ml
```

الـ `variant_key` في `recipes` يطابق `order_items.size` أو `order_items.variant`:

```sql
WHERE menu_item_slug = 'quzi'
  AND (variant_key IS NULL                    -- مكونات مشتركة
       OR variant_key = 'size:' || item.size  -- مكونات خاصة بالحجم
       OR variant_key = 'variant:' || item.variant)
```

### BOM Editor UI (أهم شاشة في النظام)

```
┌──────────────────────────────────────────────────────┐
│  📝 وصفة: كباب لحم (Lamb Kebab)                      │
│  تكلفة الطبق: 0.850 د.ب | سعر البيع: 2.500 د.ب     │
│  هامش الربح: 66% ✅                                   │
├──────────────────────────────────────────────────────┤
│  المكوّن          │ الكمية │ الوحدة │ التكلفة │ الفاقد│
│  ─────────────────┼────────┼────────┼─────────┼──────│
│  لحم ضأن          │  250   │   g    │  0.500  │  15% │
│  بصل              │   50   │   g    │  0.015  │  10% │
│  بهارات كباب      │    5   │   g    │  0.025  │   0% │
│  خبز عراقي        │    1   │  unit  │  0.050  │   0% │
│  طماطم مشوية      │   80   │   g    │  0.040  │   5% │
│  ─────────────────┴────────┴────────┴─────────┴──────│
│  [+ إضافة مكوّن]                      الإجمالي: 0.630│
│                                                       │
│  ⚠️ تحذير: هامش الربح أقل من 60% لو ارتفع اللحم 20% │
│  [💾 حفظ]  [📋 نسخ وصفة]  [🗑 حذف]                   │
└──────────────────────────────────────────────────────┘
```

---

## 5. تتبع الهدر والتلف والمرتجعات والإلغاءات

### جدول الهدر

```sql
CREATE TABLE waste_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id),
  quantity        NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  reason          TEXT NOT NULL CHECK (reason IN (
    'expired',          -- انتهت صلاحيته
    'damaged',          -- تلف في التخزين/النقل
    'spillage',         -- انسكاب
    'overproduction',   -- تحضير زيادة
    'quality',          -- لا يصلح للتقديم
    'returned',         -- مرتجع من الزبون
    'theft_suspected',  -- اشتباه سرقة
    'other'
  )),
  cost_bhd        NUMERIC(12,3) NOT NULL,
  notes           TEXT,
  photo_url       TEXT,          -- صورة الإثبات (مهم لمنع التلاعب)
  reported_by     UUID NOT NULL REFERENCES staff_basic(id),
  approved_by     UUID REFERENCES staff_basic(id),  -- الموافقة من مدير
  approved_at     TIMESTAMPTZ,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: عند INSERT في waste_log → خصم من inventory_stock
CREATE TRIGGER trg_waste_deduct
  AFTER INSERT ON waste_log
  FOR EACH ROW EXECUTE FUNCTION fn_waste_deduct();
```

### تصنيف الفقدان

```
┌─────────────────────────────────────────────────────────┐
│               مصادر فقدان المخزون                        │
├──────────────────┬──────────────────────────────────────┤
│  مصدر            │  كيف يُسجل                          │
├──────────────────┼──────────────────────────────────────┤
│  بيع عادي        │  consumption (تلقائي عبر trigger)     │
│  هدر/تلف         │  waste_log (يدوي + موافقة مدير)       │
│  إلغاء طلب       │  release (تلقائي عبر trigger)         │
│  مرتجع من زبون   │  waste_log reason='returned'          │
│  تحويل بين فروع  │  transfer_out/transfer_in             │
│  تعديل جرد       │  count_adjust (يدوي + موافقة)         │
│  سرقة مشتبهة     │  waste_log reason='theft_suspected'   │
│  فاقد طبيعي      │  محسوب في yield_factor                │
└──────────────────┴──────────────────────────────────────┘
```

### Workflow الهدر

```
1. الموظف يسجّل هدر (مكوّن + كمية + سبب + صورة اختيارية)
2. لو الكمية > حد معين (مثلاً 500g لحم) → تحتاج موافقة مدير
3. المدير يوافق أو يرفض
   لو المدير لم يوافق خلال 4 ساعات: → escalation تلقائي لـ GM (تنبيه + إيميل)
   لو GM لم يوافق خلال 8 ساعات: → تنبيه للـ Owner
   لا يوجد auto-approve أبداً — لمنع التلاعب
   المخزون الفعلي يبقى مختلفاً عن النظام حتى الموافقة → يظهر في dashboard كـ "هدر معلّق: X items"
4. عند الموافقة → trigger يخصم من inventory_stock + يسجل movement
5. لو السبب 'theft_suspected' → تنبيه فوري للمالك
```

### Workflow الإلغاء

```
حالة 1: الطلب يُلغى قبل التحضير
  → trigger يُفرج الحجز (release)
  → المكونات ترجع للمتاح
  → لا هدر

حالة 2: الطلب يُلغى بعد التحضير (الأكل جاهز)
  → trigger يُفرج الحجز
  → الموظف يسجّل waste_log reason='overproduction'
  → المكونات تُخصم نهائياً
  → تظهر في تقرير الهدر

حالة 3: مرتجع من الزبون (الأكل وصل لكن رُفض)
  → الطلب يبقى 'delivered' (الاستهلاك حصل)
  → يُسجّل waste_log reason='returned'
  → يظهر في تقرير المرتجعات
```

---

## 6. آليات منع التلاعب والسرقة

### 6.1 Audit Logs (سجل غير قابل للتعديل)

```sql
-- inventory_movements = audit log مدمج
-- كل حركة تُسجّل: من، متى، ماذا، لماذا
-- الجدول append-only: لا UPDATE، لا DELETE

-- RLS: لا أحد يحذف أو يعدّل
CREATE POLICY "movements_immutable"
  ON inventory_movements
  FOR UPDATE TO authenticated
  USING (false);  -- لا أحد يعدّل

CREATE POLICY "movements_no_delete"
  ON inventory_movements
  FOR DELETE TO authenticated
  USING (false);  -- لا أحد يحذف
```

### 6.2 صلاحيات المستخدمين (RBAC)

```
┌──────────────────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  الإجراء         │ Owner│  GM  │ BM   │ Chef │Cashir│Invent│
├──────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ عرض المخزون      │  ✅  │  ✅  │ فرعه │  ✅  │  ❌  │ فرعه │
│ تعديل وصفة       │  ✅  │  ✅  │  ❌  │  ✅  │  ❌  │  ❌  │
│ تسجيل هدر        │  ✅  │  ✅  │  ✅  │  ✅  │  ❌  │  ✅  │
│ موافقة هدر كبير  │  ✅  │  ✅  │  ✅  │  ❌  │  ❌  │  ❌  │
│ إنشاء PO         │  ✅  │  ✅  │  ✅  │  ❌  │  ❌  │  ✅  │
│ استلام PO        │  ✅  │  ✅  │  ✅  │  ❌  │  ❌  │  ✅  │
│ جرد فعلي         │  ✅  │  ✅  │  ✅  │  ❌  │  ❌  │  ✅  │
│ موافقة جرد       │  ✅  │  ✅  │  ❌  │  ❌  │  ❌  │  ❌  │
│ تحويل بين فروع   │  ✅  │  ✅  │  ✅  │  ❌  │  ❌  │  ❌  │
│ عرض التقارير     │  ✅  │  ✅  │ فرعه │  ❌  │  ❌  │ فرعه │
│ تعديل أسعار مواد │  ✅  │  ✅  │  ❌  │  ❌  │  ❌  │  ❌  │
│ حذف مكوّن        │  ✅  │  ❌  │  ❌  │  ❌  │  ❌  │  ❌  │
│ عرض COGS         │  ✅  │  ✅  │  ❌  │  ❌  │  ❌  │  ❌  │
└──────────────────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

### تعديلات مطلوبة على RBAC

```sql
-- إضافة دور مدير المخزون
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'inventory_manager';

-- تحديث auth_user_role() لتشمل الدور الجديد (لو لازم)
-- تحديث كل RLS policies التي تفحص الأدوار
```

> ملاحظة: هذا يؤثر على `auth_user_role()` وجميع الـ RLS policies الحالية.
> يُنفَّذ كجزء من migration 029.

### 6.3 تنبيهات الفروقات (Variance Alerts)

```sql
-- Materialized View: مقارنة الاستهلاك النظري بالفعلي
CREATE MATERIALIZED VIEW mv_variance_report AS
SELECT
  i.id AS ingredient_id,
  i.name_ar,
  i.name_en,
  s.branch_id,
  -- النظري: ما كان يجب أن يُستهلك بناءً على المبيعات
  COALESCE(theoretical.total, 0) AS theoretical_usage,
  -- الفعلي: ما استُهلك فعلاً (consumption + waste)
  COALESCE(actual.total, 0) AS actual_usage,
  -- الفرق
  COALESCE(actual.total, 0) - COALESCE(theoretical.total, 0) AS variance,
  -- النسبة
  CASE WHEN COALESCE(theoretical.total, 0) > 0
    THEN ROUND(
      ((COALESCE(actual.total, 0) - COALESCE(theoretical.total, 0))
       / COALESCE(theoretical.total, 1)) * 100, 1
    )
    ELSE NULL
  END AS variance_pct
FROM ingredients i
CROSS JOIN inventory_stock s
LEFT JOIN LATERAL (
  -- حساب الاستهلاك النظري من المبيعات
  SELECT SUM(r.quantity * COALESCE(r.yield_factor, i.yield_factor) * oi.qty) AS total
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN recipes r ON r.menu_item_slug = oi.menu_item_slug
                AND r.ingredient_id = i.id
  WHERE o.branch_id = s.branch_id
    AND o.status IN ('delivered','completed')
    AND o.created_at > NOW() - INTERVAL '7 days'
) theoretical ON true
LEFT JOIN LATERAL (
  -- حساب الاستهلاك الفعلي
  SELECT SUM(quantity) AS total
  FROM inventory_movements
  WHERE ingredient_id = i.id
    AND branch_id = s.branch_id
    AND movement_type IN ('consumption','waste')
    AND performed_at > NOW() - INTERVAL '7 days'
) actual ON true
WHERE s.ingredient_id = i.id
WITH NO DATA;

-- Refresh كل ساعة عبر pg_cron
SELECT cron.schedule(
  'refresh-variance',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_variance_report'
);

CREATE UNIQUE INDEX idx_mv_variance
  ON mv_variance_report (ingredient_id, branch_id);
```

> مع 50,000+ حركة/شهر، الـ View العادي يصبح بطيئاً بعد 6 أشهر.
> Materialized View + CONCURRENTLY refresh = قراءة فورية بدون blocking.

**قواعد التنبيه:**

| Variance % | التصنيف | الإجراء |
|------------|---------|---------|
| ≤ 3% | 🟢 طبيعي | لا شيء |
| 3-7% | 🟡 تحذير | إشعار لمدير الفرع |
| 7-15% | 🟠 خطر | إشعار لمدير الفرع + GM |
| > 15% | 🔴 حرج | إشعار للمالك + طلب تحقيق فوري |

### 6.4 الجرد الدوري (Cycle Counting)

```
الاستراتيجية المقترحة:
├── يومي: Top 10 مكونات أغلى (لحوم، دجاج، أسماك)
├── أسبوعي: مكونات متوسطة القيمة (خضار، ألبان)
├── شهري: مكونات منخفضة (توابل، مواد تغليف)
└── ربع سنوي: جرد شامل لكل شيء

القواعد:
- شخصان يعدّان بشكل مستقل (dual verification)
- الفرق > 5% يحتاج موافقة Owner/GM
- كل تعديل يُسجل في inventory_movements type='count_adjust'
- صورة إثبات مطلوبة لفروقات > 10%
```

### 6.5 مؤشرات السرقة (Red Flags)

```
النظام يرصد ويُنبّه تلقائياً عند:

1. هدر متكرر لنفس المكوّن من نفس الموظف
   → query: GROUP BY reported_by, ingredient_id HAVING COUNT > 3 per week

2. Variance عالٍ في مكونات غالية (لحوم، مأكولات بحرية)
   → v_variance_report WHERE variance_pct > 10 AND category = 'protein'

3. طلبات ملغاة كثيرة بعد التحضير
   → orders WHERE status='cancelled'
     AND EXISTS (kds_queue WHERE status='ready')

4. جرد متتالي بفروقات بنفس الاتجاه (نقص دائم)
   → inventory_counts WHERE variance < 0 
     GROUP BY ingredient_id HAVING COUNT(*) >= 3

5. تعديل وصفة بدون سبب (تقليل الكمية → حفظ الفرق)
   → audit_logs WHERE action='recipe_updated'
     AND old_value->>'quantity' > new_value->>'quantity'

6. PO يتم استلامه بكمية أقل من المطلوبة بشكل متكرر
   → purchase_order_items
     WHERE quantity_received < quantity_ordered * 0.9
```

---

## 7. قاعدة البيانات — الجداول والعلاقات

### ERD (Entity Relationship Diagram)

```
┌──────────────┐       ┌──────────────┐
│  suppliers   │──────▶│  ingredients │
│              │  1:N  │              │
└──────────────┘       └──────┬───────┘
                              │
                    ┌─────────┼──────────┐
                    │         │          │
              ┌─────▼───┐ ┌──▼────────┐ │
              │ recipes  │ │ inventory │ │
              │ (BOM)    │ │ _stock    │ │
              └─────┬────┘ └──┬───────┘ │
                    │         │         │
         ┌──────────┘    ┌────┘    ┌────┘
         │               │        │
  ┌──────▼──────┐  ┌─────▼──────┐ │  ┌───────────────┐
  │ menu_items  │  │ inventory  │ │  │  waste_log    │
  │ _sync       │  │ _movements │ │  │               │
  └──────┬──────┘  └─────┬──────┘ │  └───────────────┘
         │               │        │
  ┌──────▼──────┐  ┌─────▼──────┐ │  ┌───────────────┐
  │ order_items │  │  orders    │ │  │ inventory     │
  │             │──│            │ │  │ _counts       │
  └─────────────┘  └────────────┘ │  └───────────────┘
                                  │
                           ┌──────▼──────────┐
                           │ purchase_orders  │
                           │ + PO_items       │
                           └─────────────────┘

                           ┌─────────────────┐
                           │ inventory       │
                           │ _transfers      │
                           └─────────────────┘
```

### ملخص الجداول

| الجدول | الوصف | الصفوف المتوقعة |
|--------|-------|-----------------|
| `ingredients` | المواد الخام | ~150-250 |
| `suppliers` | الموردون | ~10-30 |
| `recipes` | BOM لكل طبق | ~1500-3000 (194 طبق × ~8 مكونات) |
| `inventory_stock` | الرصيد الحالي per branch | ~300-500 (مكونات × فروع) |
| `inventory_movements` | سجل الحركات | ~50,000+/شهر (ينمو) |
| `purchase_orders` | أوامر الشراء | ~50-100/شهر |
| `purchase_order_items` | تفاصيل PO | ~200-500/شهر |
| `inventory_counts` | سجلات الجرد | ~200-500/شهر |
| `waste_log` | سجلات الهدر | ~100-300/شهر |
| `inventory_transfers` | تحويلات بين الفروع | ~20-50/شهر |
| `inventory_alerts` | تنبيهات النظام | ~50-200/شهر |

---

## 8. ربط النظام مع الأنظمة الأخرى

### 8.1 لوحة الطلبات (Orders Dashboard)

```
┌─────────────────────────────────────────────┐
│  Integration Point: order_items INSERT      │
│                                             │
│  Existing:  order → order_items             │
│             └──→ trg_kds_enqueue (KDS)      │
│                                             │
│  New:       order_items INSERT              │
│             └──→ trg_inventory_reserve      │
│                  └── checks stock           │
│                  └── reserves ingredients   │
│                  └── logs movement          │
│                                             │
│  On status change:                          │
│    delivered → trg_inventory_finalize       │
│    cancelled → trg_inventory_release        │
│                                             │
│  ⚠️ Checkout يحتاج: pre-check + معالجة      │
│  أخطاء INSUFFICIENT_STOCK و MISSING_RECORD  │
│  (انظر قسم "معالجة أخطاء المخزون في Next.js")│
└─────────────────────────────────────────────┘
```

### 8.2 منصات التوصيل (Talabat/Jahez/Keeta)

**المرحلة 1 — الإدخال اليدوي (MVP):**

```
┌──────────────────────────────────────────────┐
│  Cashier POS Dashboard                       │
│  /dashboard/pos                              │
│                                              │
│  [📦 Website] [🏪 Walk-in] [🚗 Talabat]     │
│  [🛵 Jahez]  [🛵 Keeta]  [📞 Phone]         │
│                                              │
│  الكاشير يختار المصدر → يختار الأصناف        │
│  → النظام يتعامل مع الطلب كأي طلب آخر       │
│  → triggers تخصم المخزون تلقائياً             │
│                                              │
│  الكاشير ينسخ الطلب من tablet التطبيق        │
│  إلى POS الداخلي — عملية 30-60 ثانية         │
└──────────────────────────────────────────────┘
```

**المرحلة 2 — Webhook Integration (مع Deliverect):**

```
Talabat ──┐
Jahez  ───┤──→ Deliverect ──→ POST /api/webhooks/deliverect
Keeta  ───┘                        │
                                   ▼
                    Normalize to kahramana format:
                    {
                      order_source: 'talabat',
                      branch_id: map(store_id),
                      items: [
                        { slug: map(external_id), qty, size, variant }
                      ]
                    }
                                   │
                                   ▼
                    INSERT orders + order_items
                    → triggers fire automatically
                    → inventory reserved
                    → KDS gets the order
```

**المرحلة 3 — Direct API (لو Deliverect غير متاح في البحرين):**

كل منصة لها API مختلف. الحل: webhook adapter لكل منصة:

```
src/app/api/webhooks/
├── deliverect/route.ts   → Deliverect (يغطي الكل)
├── talabat/route.ts      → Talabat direct API
├── jahez/route.ts        → Jahez direct API
└── keeta/route.ts        → Keeta direct API

src/lib/delivery-platforms/
├── normalizer.ts         → يحول كل format لـ Kahramana format
├── talabat-mapper.ts     → خريطة أصناف Talabat → menu_item_slug
├── jahez-mapper.ts
└── keeta-mapper.ts
```

### 8.3 تقارير المبيعات (Reports)

```
التقارير تجمع من كل المصادر عبر order_source:

SELECT
  order_source,
  COUNT(*) AS total_orders,
  SUM(subtotal_bhd) AS revenue,
  AVG(subtotal_bhd) AS avg_order_value
FROM orders
WHERE status IN ('delivered','completed')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY order_source
ORDER BY revenue DESC;

النتيجة:
┌────────────┬───────────┬──────────┬──────────────┐
│ المصدر     │ الطلبات   │ الإيرادات │ متوسط الطلب  │
├────────────┼───────────┼──────────┼──────────────┤
│ talabat    │    487    │ 2,435 BD │   5.00 BD    │
│ website    │    234    │ 1,404 BD │   6.00 BD    │
│ walk_in    │    189    │   945 BD │   5.00 BD    │
│ jahez      │    156    │   780 BD │   5.00 BD    │
│ keeta      │     89    │   445 BD │   5.00 BD    │
│ phone      │     45    │   270 BD │   6.00 BD    │
└────────────┴───────────┴──────────┴──────────────┘
```

---

## 9. KPIs والتقارير

### 9.1 تكلفة البضاعة المباعة (COGS)

```sql
-- COGS لكل طبق
CREATE VIEW v_dish_cogs AS
SELECT
  mis.slug,
  mis.name_ar,
  mis.name_en,
  mis.price_bhd AS selling_price,
  SUM(r.quantity * r.yield_factor * i.cost_per_unit) AS cost_bhd,
  mis.price_bhd - SUM(r.quantity * r.yield_factor * i.cost_per_unit) AS profit_bhd,
  ROUND(
    (1 - SUM(r.quantity * r.yield_factor * i.cost_per_unit) / NULLIF(mis.price_bhd, 0)) * 100
  , 1) AS margin_pct
FROM menu_items_sync mis
JOIN recipes r ON r.menu_item_slug = mis.slug
JOIN ingredients i ON i.id = r.ingredient_id
GROUP BY mis.slug, mis.name_ar, mis.name_en, mis.price_bhd
ORDER BY margin_pct ASC;  -- الأقل ربحاً أولاً
```

**المعايير الصحية:**
- Food Cost Target: 28-35% من سعر البيع
- أقل من 25%: ممتاز
- 35-40%: يحتاج مراجعة التسعير أو الوصفة
- أكثر من 40%: خسارة — أوقف البيع أو عدّل

### 9.2 لوحة KPIs الرئيسية

```
┌──────────────────────────────────────────────────────────┐
│  📊 Inventory Dashboard                                  │
├──────────────────┬──────────────────┬────────────────────┤
│  🔴 Out of Stock │  🟡 Low Stock    │  📦 Pending POs    │
│      3 items     │     12 items     │      4 orders      │
├──────────────────┼──────────────────┼────────────────────┤
│  🗑 Waste %      │  📉 Variance     │  💰 Inventory Val  │
│     2.8% ✅      │     4.2% ⚠️      │    8,450 BD        │
├──────────────────┴──────────────────┴────────────────────┤
│  📈 Food Cost Trend (Last 4 Weeks)                       │
│  ████████████ 31% → 29% → 32% → 28%                     │
├──────────────────────────────────────────────────────────┤
│  🏆 Top 5 Most Consumed Ingredients (This Week)         │
│  1. لحم ضأن    45.2 kg    |  4. طماطم     23.1 kg       │
│  2. أرز بسمتي  38.7 kg    |  5. بصل       19.4 kg       │
│  3. دجاج       31.5 kg    |                              │
├──────────────────────────────────────────────────────────┤
│  ⚠️ Days to Stockout (Critical Items)                    │
│  لحم ضأن: 3 أيام | دجاج: 5 أيام | أرز: 12 يوم          │
├──────────────────────────────────────────────────────────┤
│  📊 Sales by Channel (This Month)                        │
│  Talabat: 42% | Website: 20% | Walk-in: 16%             │
│  Jahez: 13%   | Keeta: 6%   | Phone: 3%                 │
└──────────────────────────────────────────────────────────┘
```

### 9.3 التقارير التفصيلية

| التقرير | الوصف | التكرار | من يراه |
|---------|-------|---------|---------|
| **COGS Report** | تكلفة كل طبق + هامش الربح | أسبوعي | Owner, GM |
| **Waste Report** | كمية + تكلفة الهدر per reason | يومي/أسبوعي | Owner, GM, BM |
| **Variance Report** | نظري vs فعلي per ingredient | أسبوعي | Owner, GM |
| **Low Stock Alert** | مكونات تحت حد الطلب | realtime | BM, Inventory |
| **Days to Stockout** | تقدير نفاد كل مكوّن | يومي | BM, Inventory |
| **Channel Revenue** | مبيعات per order_source | يومي/أسبوعي | Owner, GM |
| **Supplier Cost Trend** | تغيّر أسعار الموردين | شهري | Owner, GM |
| **Inventory Valuation** | قيمة المخزون الإجمالية | نهاية الشهر | Owner, GM |
| **PO Fulfillment** | % استلام vs طلب per supplier | شهري | Owner, GM |
| **Top Sellers vs Cost** | الأكثر مبيعاً × التكلفة | أسبوعي | Owner, GM |
| **Employee Waste Log** | هدر per employee (red flag) | أسبوعي | Owner, GM |
| **Cycle Count Accuracy** | دقة الجرد per branch | شهري | Owner, GM |

### 9.4 التنبيهات الأوتوماتيكية

```sql
-- جدول التنبيهات
CREATE TABLE inventory_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID REFERENCES branches(id),
  alert_type  TEXT NOT NULL CHECK (alert_type IN (
    'low_stock',          -- مخزون تحت حد الطلب
    'out_of_stock',       -- نفاد كامل
    'high_waste',         -- هدر يومي > 5%
    'variance_warning',   -- variance > 7%
    'variance_critical',  -- variance > 15%
    'unmapped_item',      -- صنف بدون وصفة
    'expiring_soon',      -- صلاحية تنتهي خلال 3 أيام
    'theft_suspected',    -- مؤشرات سرقة
    'po_overdue',         -- PO متأخر عن الموعد
    'cost_spike'          -- ارتفاع مفاجئ في تكلفة مكوّن
  )),
  severity    TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message     TEXT NOT NULL,
  ingredient_id UUID REFERENCES ingredients(id),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime: الـ dashboard يشترك في التنبيهات
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_alerts;
```

---

## 10. أدوات مجانية ومفتوحة المصدر

### ما نستخدمه (Stack الحالي — تكلفة صفر إضافية)

| الأداة | الاستخدام | التكلفة |
|--------|----------|---------|
| **Supabase** (PostgreSQL) | DB + Auth + RLS + Realtime + RPCs | مجاني (حتى 500MB) |
| **Next.js 15** | Dashboard UI + Server Actions | مجاني |
| **Vercel** | Hosting | $20/شهر (موجود أصلاً) |
| **Tailwind CSS** | UI styling | مجاني |
| **Recharts** | Charts في التقارير | مجاني |
| **SheetJS (xlsx)** | Export تقارير Excel | مجاني |
| **React Email** | تنبيهات بالإيميل | مجاني |
| **Resend** | إرسال الإيميلات | مجاني حتى 100/يوم |

### أدوات خارجية مقترحة

| الأداة | الاستخدام | التكلفة | متى |
|--------|----------|---------|-----|
| **Upstash Redis** | Caching لـ stock checks (optional) | مجاني حتى 10K req/day | Phase 3.3 |
| **ERPNext** | لو أراد المالك ERP كامل (open source) | مجاني self-hosted | مستقبلي |
| **Metabase** | BI dashboards متقدمة (يتصل بـ Supabase مباشرة) | مجاني self-hosted | Phase 3.4 |
| **n8n** | Automation workflows (تنبيهات WhatsApp، PO أوتوماتيكي) | مجاني self-hosted | Phase 3.4 |
| **Barcode Scanner** | جرد سريع عبر كاميرا الجوال | مجاني (Web API) | Phase 3.3 |

### لماذا لا نستخدم نظام مخزون جاهز؟

| الخيار | المشكلة |
|--------|---------|
| Odoo | ثقيل جداً، يحتاج self-hosting، لا يتكامل مع Supabase |
| ERPNext | جيد لكن PHP/Python — لا يتناسب مع Next.js stack |
| uniCenta POS | Java — لا يعمل في بيئة web |
| MarginEdge | SaaS مدفوع ~$300/شهر |
| Lightspeed | SaaS مدفوع ~$200/شهر |

**القرار:** نبني نظام مخزون مخصوص داخل Supabase — يتكامل بـ 0 friction مع الأنظمة الموجودة (Orders, KDS, Driver, RBAC) عبر triggers. لا حاجة لـ APIs خارجية أو sync بين أنظمة مختلفة.

---

## 11. خطة التنفيذ على مراحل

### Phase 3.0 — Data Collection (قبل أي كود)

**المدة:** 2-4 أسابيع
**المسؤول:** الشيف + مدير المطعم + Ahmed

```
المخرجات:
1. Excel template مملوء بـ recipes لـ 194 طبق
2. قائمة المكونات الخام (~150-250 مكوّن)
3. أسعار الشراء الحالية per unit
4. قائمة الموردين + lead times
5. PAR levels مبدئية per branch (حد إعادة الطلب)
6. أرصدة افتتاحية (Opening balances) per branch
```

### Phase 3.1 — MVP (أسبوعين)

```
Sprint 3.1A — Foundation (الأسبوع 1):
├── Migration 029_inventory_core.sql
│   ├── 10 جداول جديدة
│   ├── 3 triggers (reserve, finalize, purchase)
│   ├── 3 RPCs (stock check, low alerts, count submit)
│   ├── RLS policies
│   └── Indexes
├── Seed ingredients (~150 مكوّن)
├── Seed recipes (194 طبق — من Excel الشيف)
├── Opening balances (لكل فرع)
└── order_source column على orders

Sprint 3.1B — Core UI (الأسبوع 2):
├── /inventory → Overview (low stock + KPIs)
├── /inventory/stock → Live stock per branch (read-only)
├── /inventory/recipes → BOM viewer (read-only أول — editor لاحقاً)
└── Low stock alerts (realtime widget في dashboard الرئيسي)

الهدف: "المخزون يخصم أوتوماتيكياً مع كل طلب من أي مصدر"
```

### Phase 3.2 — Enhanced (أسبوعين)

```
Sprint 3.2A — Workflows (الأسبوع 3):
├── /inventory/recipes/[slug] → BOM editor (drag & drop)
├── /inventory/waste → Waste log entry + approval workflow
├── /inventory/count → Cycle count (mobile-first)
├── Waste deduction trigger
└── Count adjustment trigger + approval

Sprint 3.2B — Procurement (الأسبوع 4):
├── /inventory/purchases → PO list
├── /inventory/purchases/new → Create PO (auto-suggest from low stock)
├── /inventory/purchases/[id] → Receive PO (partial allowed)
├── Purchase receipt trigger (adds stock)
└── Supplier management CRUD
```

### Phase 3.3 — Professional (أسبوعين)

```
Sprint 3.3A — Reports & Analytics (الأسبوع 5):
├── /inventory/reports/cogs → Cost per dish + margins
├── /inventory/reports/consumption → Theoretical vs actual
├── /inventory/reports/valuation → Total inventory value
├── Channel revenue breakdown (order_source)
├── Excel export for all reports
└── Variance alerts (auto-notifications)

Sprint 3.3B — Advanced Features (الأسبوع 6):
├── /inventory/transfers → Inter-branch transfers
├── Barcode scanning (Web API) for cycle counts
├── Expiry date tracking (batch-level — optional)
├── Auto-suggest PO based on consumption trends
├── Dashboard alerts widget (realtime)
└── Email digest: daily waste + low stock summary
```

### Phase 3.5 — Cashier POS (أسبوعين — مستقل)

```
├── /dashboard/pos → Touch-friendly POS
│   ├── Category browser → Item cards → Cart
│   ├── Source selector (walk_in, talabat, jahez, keeta, phone)
│   ├── Pre-checkout stock check (rpc_check_stock_for_cart)
│   ├── Payment method selector
│   └── Receipt generator (optional printer integration)
├── createPosOrder() server action
│   └── Same pipeline as website checkout
└── POS-specific analytics (walk-in vs delivery mix)
```

### الجدول الزمني الواقعي

```
Week 0-4:  Data collection (الشيف يملأ الـ templates)
Week 5-6:  Phase 3.1 MVP (migration + seed + core UI)
Week 7-8:  Phase 3.2 (BOM editor + waste + counting + PO)
Week 9-10: Phase 3.3 (reports + alerts + transfers)
Week 11:   Testing on Riffa branch only
Week 12:   Rollout to Qallali
Week 13-14: Phase 3.5 POS (optional)
```

---

## 12. الأخطاء الشائعة التي يجب تجنبها

### ❌ أخطاء قاتلة

| الخطأ | لماذا خطير | الحل |
|-------|------------|------|
| **خصم المخزون في الكود (TypeScript)** | Race conditions، double-deductions، لا atomicity | Triggers + RPCs في PostgreSQL فقط |
| **إهمال yield_factor** | المخزون النظري أعلى من الفعلي دائماً → variance مستمر يُقرأ كسرقة | قس الفاقد الحقيقي لكل مكوّن مع الشيف |
| **عدم تسجيل طلبات التوصيل** | 50-70% من المبيعات لا تخصم المخزون → أرقام خاطئة | order_source على كل طلب + POS للإدخال اليدوي |
| **بناء النظام قبل recipes** | النظام كامل لكن لا يخصم شيئاً → أسوأ من عدم وجوده (وهم الأمان) | ابدأ بـ 10 أطباق pilot قبل أي كود |
| **شخص واحد يجرد ويعدّل** | باب مفتوح للتلاعب | dual verification: شخصان يعدّان + مدير يوافق |
| **لا صور إثبات للهدر** | أي شخص يقول "انكسر" بدون دليل | حقل photo_url + شرط للموافقة |

### ⚠️ أخطاء شائعة

| الخطأ | التأثير | الحل |
|-------|---------|------|
| جرد مرة بالشهر فقط | تكتشف المشاكل متأخراً جداً | يومي للمكونات الغالية، أسبوعي للباقي |
| عدم مطابقة وحدات القياس | الوصفة بالغرام والجرد بالكيلو → أخطاء × 1000 | `unit_base` موحد في `ingredients` + تحويل أوتوماتيكي |
| تجاهل variance reports | كأنك ما عندك نظام أصلاً | تنبيهات أوتوماتيكية + review أسبوعي إجباري |
| Over-engineering من اليوم الأول | 6 أشهر بدون نتيجة | MVP أولاً → iterate |
| عدم تدريب الموظفين | يدخلون بيانات خاطئة | تدريب 2 ساعة + UI بسيط (mobile-first) |
| خلط المخزون بين الفروع | فرع يبدو ناقص والثاني فائض | `branch_id` على كل شيء + RLS |
| عدم تحديث أسعار المكونات | COGS خاطئ → قرارات تسعير خاطئة | تحديث أسعار مع كل PO جديد |
| Recipes ثابتة أبداً | الشيف يغيّر الكميات والنظام لا يعكس | audit log على كل تعديل + مراجعة شهرية |

---

## 13. مثال عملي: تدفق بيع وجبة وتأثيرها على المخزون والتقارير

### السيناريو: زبون يطلب 2 كباب لحم + 1 تمن عراقي عبر Talabat

```
═══════════════════════════════════════════════════════════
  الخطوة 1: الكاشير يدخل الطلب في POS (مصدر: Talabat)
═══════════════════════════════════════════════════════════

INSERT INTO orders (branch_id, order_source, subtotal_bhd, status)
VALUES ('riffa-uuid', 'talabat', 7.500, 'new');
-- order_id = 'abc-123'

INSERT INTO order_items (order_id, menu_item_slug, qty, unit_price_bhd)
VALUES
  ('abc-123', 'lamb-kebab', 2, 2.500),
  ('abc-123', 'iraqi-timman', 1, 2.500);

═══════════════════════════════════════════════════════════
  الخطوة 2: Trigger trg_inventory_reserve يعمل تلقائياً
═══════════════════════════════════════════════════════════

لـ lamb-kebab × 2:
  لحم ضأن:   250g × 1.15 × 2 = 575g   → reserved += 575g
  بصل:        50g × 1.10 × 2 = 110g   → reserved += 110g
  بهارات:      5g × 1.00 × 2 =  10g   → reserved += 10g
  خبز:         1  × 1.00 × 2 =   2    → reserved += 2 units
  طماطم:      80g × 1.05 × 2 = 168g   → reserved += 168g

لـ iraqi-timman × 1:
  أرز بسمتي: 300g × 1.05 × 1 = 315g   → reserved += 315g
  زيت:        30ml × 1.00 × 1 =  30ml  → reserved += 30ml
  بهارات أرز:  8g × 1.00 × 1 =   8g   → reserved += 8g

inventory_movements يسجّل 8 rows (type='reservation')

═══════════════════════════════════════════════════════════
  الخطوة 3: Trigger trg_kds_enqueue يعمل (موجود أصلاً)
═══════════════════════════════════════════════════════════

kds_queue:
  - lamb-kebab × 2 → station: grill → status: pending
  - iraqi-timman × 1 → station: rice → status: pending

═══════════════════════════════════════════════════════════
  الخطوة 4: المطبخ يحضّر → KDS يحدّث → status = 'ready'
═══════════════════════════════════════════════════════════

(لا تأثير على المخزون — المكونات محجوزة بالفعل)

═══════════════════════════════════════════════════════════
  الخطوة 5: السائق يوصل → status = 'delivered'
═══════════════════════════════════════════════════════════

Trigger trg_inventory_finalize يعمل:
  لكل reservation سابقة:
    reserved -= quantity
    on_hand  -= quantity (الخصم النهائي)
    INSERT inventory_movements (type='consumption')

═══════════════════════════════════════════════════════════
  التأثير النهائي على المخزون (فرع الرفاع)
═══════════════════════════════════════════════════════════

┌──────────────┬──────────┬────────────┬──────────┐
│ المكوّن      │ قبل      │ المحجوز    │ بعد      │
├──────────────┼──────────┼────────────┼──────────┤
│ لحم ضأن      │ 15,000g  │ 575g       │ 14,425g  │
│ بصل          │  8,000g  │ 110g       │  7,890g  │
│ بهارات كباب  │  2,000g  │  10g       │  1,990g  │
│ خبز عراقي    │     150  │   2        │     148  │
│ طماطم        │ 10,000g  │ 168g       │  9,832g  │
│ أرز بسمتي    │ 25,000g  │ 315g       │ 24,685g  │
│ زيت          │  5,000ml │  30ml      │  4,970ml │
│ بهارات أرز   │  1,500g  │   8g       │  1,492g  │
└──────────────┴──────────┴────────────┴──────────┘

═══════════════════════════════════════════════════════════
  التأثير على التقارير
═══════════════════════════════════════════════════════════

COGS لهذا الطلب:
  كباب × 2:  0.630 × 2 = 1.260 BD
  تمن × 1:   0.450 × 1 = 0.450 BD
  إجمالي التكلفة: 1.710 BD
  إجمالي البيع:   7.500 BD
  صافي الربح:     5.790 BD (77.2% margin ← ممتاز)

  لكن Talabat يأخذ عمولة ~20-30%:
  عمولة تقديرية: 7.500 × 0.25 = 1.875 BD
  صافي بعد العمولة: 5.790 - 1.875 = 3.915 BD (52.2%)

Channel Report يُحدَّث:
  talabat: orders += 1, revenue += 7.500 BD

Variance Report (نهاية الأسبوع):
  لحم ضأن: نظري = 575g, فعلي = 600g → variance = 25g (4.3%) ⚠️
  (ممكن over-portioning أو الشيف أضاف إضافي)

Low Stock Alert (لو لحم < 5,000g):
  "تنبيه: لحم الضأن سيتوفر لـ 3 أيام فقط بالمعدل الحالي"
```

---

## ملخص تنفيذي

### الأولويات بالترتيب

```
1. 📋 احصل على البيانات أولاً
   └── Recipes من الشيف = الـ blocker الوحيد الحقيقي

2. 🗄️ Migration واحدة شاملة
   └── 10 جداول + 3 triggers + 3 RPCs + RLS

3. 🔗 اربط بالأنظمة عبر Triggers فقط
   └── لا كود TypeScript يلمس inventory_stock

4. 📊 Dashboard بـ 3 موجات
   └── MVP → Enhanced → Professional

5. 🏪 ابدأ بفرع واحد (الرفاع)
   └── أسبوعين test → ثم Qallali

6. 📱 POS للكاشير
   └── لتسجيل طلبات Talabat/Jahez/Keeta يدوياً
   └── حتى يتوفر Deliverect webhook
```

### التكلفة الإضافية: $0/شهر

كل شيء يعمل ضمن Supabase + Vercel الحاليين. لا أدوات إضافية مدفوعة مطلوبة في MVP.

### المعادلة النهائية

```
نظام مخزون فعّال =
  Recipes دقيقة (من الشيف)
  + Triggers ذرّية (في PostgreSQL)
  + كل المبيعات تمر عبر النظام (order_source)
  + جرد دوري (dual verification)
  + variance monitoring (أسبوعي)
  + تدريب الموظفين (2 ساعة)
```
