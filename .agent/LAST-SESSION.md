# LAST-SESSION.md — Session 34
> Date: 2026-05-01 | Status: `driver_security_deployed + inventory_core_migration_written_pending_apply` | Branch: `master @ acb1b4b`

---

## ما تم في هذه الجلسة

> ملاحظة: جلسة 34 لها مسارَين متوازيَين — **(A) Driver Security Hardening** (deployed) و **(B) Inventory Core Migration** (written, pending apply).

---

## (A) Driver Flow Security Hardening ✅ (DEPLOYED)

### Driver Audit Report
قراءة شاملة لتدفق السائق من الاستلام إلى تسليم النقد. تم تحديد **25 مشكلة موزّعة على 4 طبقات أولوية**:
- 🔴 4 ثغرات أمنية حرجة — **تم إصلاح 3 منها في هذه الجلسة**
- 🟠 6 أخطاء منطقية — موثّقة في `HANDOFF-DRIVER-PHASE-2.md`
- 🟡 11 فجوة UX/أداء — موثّقة في `HANDOFF-DRIVER-PHASE-2.md`
- 🟢 4 architectural — موثّقة

### Fix #1 — `submitCashHandover` server-side recompute ✅
- `src/app/[locale]/driver/actions.ts` — السيرفر يجلب الطلبات، يفحص ownership + `status='delivered'` + `payments.method='cash'`، ثم يجمع `total_bhd` من DB.
- `totalCash` المرسل من العميل **مُتجاهَل**.
- `src/components/driver/CashHandoverModal.tsx` — حذف parameter من الاستدعاء.

### Fix #2 — DispatchModal → server action ✅
- ملف جديد: `src/app/[locale]/dashboard/delivery/actions.ts` → `assignDriverToOrder()`.
- 6 طبقات فحص + optimistic concurrency + audit log.
- `src/components/delivery/DispatchModal.tsx` — استبدال DB call مباشر بـ server action، رسائل خطأ AR/EN.

### Fix #3 — Migration 034 applied to production ✅
تم تطبيق `034_driver_order_issues.sql` عبر `supabase db push`. `submitDriverIssue` يعمل في الإنتاج الآن.

### Phase Gate (Driver track) ✅
- `npx tsc --noEmit` → exit 0
- `npm run build` → 785 pages, 0 errors
- All 9 phase-gate checks PASS

### Commits
```
d771716 fix(driver): cash handover server-recompute + dispatch server action + audit log
acb1b4b fix(driver): cash handover server-recompute + dispatch server action + audit log
        (phase-state metadata follow-up)
```
Pushed to `origin/master`. Vercel auto-deploy in progress.

### Phase 2 Handoff Created
- `HANDOFF-DRIVER-PHASE-2.md` (root) — spec كامل لـ Claude Code
- يغطي 4 orange + 4 yellow fixes
- يستخدم migration numbers 035–039 كـ placeholders — يجب أن يُحدَّث Claude Code للأرقام التالية المتاحة (035 محجوز للـ inventory)

---

## (B) Inventory Core Migration ⏸️ (PENDING APPLY)

### 0. Migration 035 — Inventory Core Schema ✅

**الملف:** `supabase/migrations/035_inventory_core.sql` (2092 سطر)

**ملاحظة:** رقم 029 كان محجوزاً بـ `029_driver_cash_handover.sql` — المرقّم التالي بعد 034 هو 035.

**يشمل:**
- 2 ENUMs: `inventory_movement_type` (14 قيمة), `abc_class`
- 18 جدول بالترتيب الصحيح لـ FK dependencies
- FK مؤجّلة (deferred): alerts→ingredients, price_history→POs, lots→POs, movements→POs+waste_log
- `orders` table guards: إضافة `order_source`, `platform_order_id`, UNIQUE INDEX للـ platform dedup
- `ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'inventory_manager'`
- 4 trigger functions: `fn_inventory_reserve`, `fn_inventory_finalize_or_release`, `fn_waste_deduct`, `fn_po_receive_create_lot`
- `fn_check_price_spike` helper function
- 11 RPCs: check_stock_for_cart, low_stock_alerts, receive_purchase_order, inventory_count_submit, transfer_stock, escalate_waste_approvals, auto_generate_pos, dead_stock_report, expiry_report, menu_engineering, update_abc_classification
- 2 views: `v_dish_cogs`, `v_vendor_performance`, `v_inventory_valuation`
- 1 materialized view: `mv_variance_report` + UNIQUE INDEX للـ CONCURRENTLY refresh
- RLS policies كاملة على جميع الجداول (18 جدول + service_role bypass)
- `inventory_alerts` مضافة لـ `supabase_realtime` publication
- 7 pg_cron jobs (محمية بـ DO block + IF NOT EXISTS)
- 26 indexes
- Verification queries كـ تعليقات في نهاية الملف

**Dry-run:** ✅ `npx supabase db push --dry-run` نجح بدون أخطاء

---

## حالة النظام عند الإغلاق

| العنصر | الحالة |
|--------|--------|
| Git | `master @ acb1b4b` — pushed ✅ |
| TypeScript | 0 أخطاء ✅ |
| Build | 785 pages ✅ |
| Migration 034 (driver issues) | **APPLIED** ✅ |
| Migration 035 (inventory core) | **WRITTEN, dry-run passed, NOT YET applied** |
| Driver cash handover | secure (server-recompute) ✅ |
| Driver dispatch | secure (server action + audit) ✅ |
| Vercel deploy | تلقائي من push على master ✅ |
| `HANDOFF-DRIVER-PHASE-2.md` | جاهز في root ✅ |

---

## الخطوات المطلوبة من أحمد (next session)

1. **اختبار حي على production** للـ driver fixes:
   - تسليم طلب كاش، التحقق من المبلغ المحسوب من السيرفر.
   - ضغط "مشكلة في الطلب" — تأكد البلاغ يُحفَظ.
   - تعيين سائق لطلب ready كمدير، تأكد سطر جديد في `audit_logs`.

2. **تطبيق Migration 035 (inventory)**:
   ```bash
   supabase db push
   ```

3. **بدء Driver Phase 2** — عبر Claude Code:
   ```
   اقرأ HANDOFF-DRIVER-PHASE-2.md ونفذ الإصلاحات بالترتيب.
   ملاحظة: استخدم migration numbers بدءاً من 036 (035 محجوز للـ inventory).
   ```

---

## قرارات مهمة (Session 34)

- **`totalCash` لا يُقبل من العميل أبداً** — السيرفر هو source of truth الوحيد.
- **`assignDriverToOrder`** يستخدم `createServiceClient()` لتفادي edge cases في RLS، لكن مع 6 طبقات فحص في الكود.
- **`picked_up_at = now()`** عند dispatch — semantics غير دقيقة (السائق لم يستلم فعلاً)، أُبقيت للحفاظ على backward compat. تحسينها مدرج في handoff كـ follow-up.
- **migration 034 طُبّقت** عبر `supabase db push` بنجاح.
- **`HANDOFF-DRIVER-PHASE-2.md` في root** وليس `docs/handoff/` — قرار مقصود ليكون discoverable لـ Claude Code فوراً.
- **Migration 035 محجوز للـ inventory** — driver Phase 2 سيستخدم 036+.

---

## Outstanding Follow-ups

- 🟠 4 fixes orange (#5, #6, #10, #19) في `HANDOFF-DRIVER-PHASE-2.md`.
- 🟡 4 fixes yellow (Y1–Y4) في `HANDOFF-DRIVER-PHASE-2.md`.
- 🟢 Architecture: dead `returning` driver status، payments embed cardinality، realtime channel scoping — لم تُجدول.
- Manager hours dashboard على `/dashboard/staff/[id]` — مقترح في Y3.
- Inventory migration 035 — تطبيق على production.

---

## الجلسة السابقة (33) — للمرجع

### 1. Language Toggle — لوحة التحكم ✅

**الملفات:**
- `src/components/dashboard/LanguageToggle.tsx` — مكوّن جديد لتبديل اللغة
- `src/components/dashboard/DashboardSidebar.tsx` — إضافة `<LanguageToggle />` في footer

**التفاصيل:**
- يستخدم `useRouter` + `usePathname` من `@/i18n/navigation` (next-intl)
- `router.push(pathname, { locale: isAr ? 'en' : 'ar' })` — تبديل بدون reload
- يظهر "English" في الواجهة العربية و"عربي" في الإنجليزية
- `min-h-[44px]` touch target، تصميم مطابق لأزرار الـ sidebar

---

### 2. Middleware Locale Verification ✅

قراءة فقط — `src/middleware.ts` صحيح بالفعل:
- `loginUrl()` → `/en/login` أو `/login`
- `dashboardUrl()` → `/en/dashboard` أو `/dashboard`
- `driverUrl` → `/en/driver` أو `/driver`
- لا تغييرات مطلوبة

---

### 3. Driver Screen Full UX Upgrade ✅

#### الملفات المضافة/المعدّلة:

| الملف | التغيير |
|-------|---------|
| `src/components/driver/DriverOrderCard.tsx` | إعادة كتابة كاملة |
| `src/components/driver/IssueReportModal.tsx` | مكوّن جديد |
| `src/app/[locale]/driver/actions.ts` | إضافة `submitDriverIssue` |
| `supabase/migrations/034_driver_order_issues.sql` | migration جديدة |
| `src/lib/supabase/types.ts` | إضافة `driver_order_issues` |
| `src/lib/supabase/custom-types.ts` | إضافة `DriverOrderIssueInsert` |

#### تفاصيل DriverOrderCard.tsx:
- **Stepper 4 خطوات**: جاهز → استُلم → وصل → تم (مدفوع بـ `arrived_at` وليس status enum)
- **"الخطوة التالية" card**: بطاقة ذهبية تعرض الخطوة القادمة فوق CTA
- **تأكيد النقد**: dialog داخلية قبل التسليم النهائي للطلبات النقدية
- **بطاقة الاستلام + التوصيل**: منفصلتان مع نقاط ملوّنة (ذهبي/أخضر)
- **عرض النقد**: `text-2xl` مع "المبلغ المطلوب تحصيله"
- **زر الإبلاغ عن مشكلة**: في أسفل البطاقة → يفتح IssueReportModal
- **شارة الحالة**: تعرض "وصل للزبون" عند `arrived_at !== null`

#### تفاصيل IssueReportModal.tsx:
- Bottom sheet من أسفل الشاشة
- 7 أسباب في grid عمودين
- textarea للملاحظات (300 حرف)
- حالة نجاح مع checkmark + إغلاق تلقائي بعد 1.4 ثانية

#### تفاصيل submitDriverIssue (actions.ts):
- سلسلة أمان: auth → role check → reason validation → order fetch → branch guard → ownership guard
- `driver_id` دائماً من الـ server — لا يمكن تزويرها
- `createServiceClient()` للإدراج

#### migration 034:
- جدول `driver_order_issues`: id, order_id, driver_id, reason, notes, created_at
- RLS: السائق يُدرج فقط (بـ `driver_id = auth.uid()`)؛ القراءة: ذاتية للسائق + branch managers + owners/GMs
- indexes على order_id و driver_id

---

## نتائج التحقق (Phase Gate)

| الفحص | النتيجة |
|-------|---------|
| `npx tsc --noEmit` | ✅ نجح (بعد إضافة types) |
| RTL violations | ✅ لا مخالفات |
| Forbidden fonts | ✅ لا مخالفات (setInterval false-positive تم التأكيد) |
| Forbidden colors | ✅ لا مخالفات |
| Raw hex colors | ✅ لا مخالفات |
| `npm run build` | ✅ نجح — 785 صفحة، 0 أخطاء |

---

## حالة النظام عند الإغلاق

| العنصر | الحالة |
|--------|--------|
| Git | master — uncommitted changes |
| TypeScript | 0 أخطاء ✅ |
| Build | نجح — 785 صفحة ✅ |
| Migration 034 | **مكتوبة — لم تُطبَّق على الإنتاج بعد** |
| Driver UX | مُحدَّثة — 4-step stepper + issue reporting |
| Language Toggle | مُضاف للـ sidebar ✅ |

---

## الخطوات المطلوبة من أحمد

1. **تطبيق Migration 034**: افتح Supabase SQL Editor وشغّل محتوى `supabase/migrations/034_driver_order_issues.sql`
2. **Commit وDeploy**: `git add -A && git commit -m "feat: driver ux upgrade + language toggle + migration 034"`
3. **اختبار السائق**: تأكيد عمل الـ stepper + زر الإبلاغ عن مشكلة على الجهاز المحمول
4. **`./update-context.sh "session 33: driver ux upgrade (4-step stepper, issue reporting), language toggle, migration 034 pending"`**

---

## قرارات مهمة

- **"وصل للزبون"** مدفوع بـ `arrived_at timestamp` وليس بقيمة في enum الحالة — لا تغيير لـ DB schema
- **IssueReportModal** تستورد `submitDriverIssue` مباشرة — لا تغيير لواجهة `DriverDashboard` أو الصفحة الأم
- **Cash confirmation** تظهر فقط عند: `isOnRoad && hasArrived && isCash` — ثلاثة شروط معاً
- **driver_order_issues** أُضيف يدوياً لـ `types.ts` بدلاً من regenerate — migration 034 لم تُطبَّق على Supabase prod بعد
