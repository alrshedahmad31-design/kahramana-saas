# LAST-SESSION.md — Session 35
> Date: 2026-05-01 | Status: `driver_phase2_complete` | Branch: `master @ 9fbd574`

---

## ما تم في هذه الجلسة

تنفيذ **جميع الإصلاحات الـ 8** من `HANDOFF-DRIVER-PHASE-2.md` بالترتيب الصارم، كل fix في commit مستقل مع phase-gate 9 فحوصات كاملة.

---

## الإصلاحات المنجزة (8 commits)

### 🟠 Fix #5 — Multiple cash handovers per shift ✅
- Migration `036_multiple_cash_handovers.sql`: جدول `driver_cash_handover_orders` مع `UNIQUE(order_id)` لمنع تكرار الطلب في أكثر من handover.
- `submitCashHandover`: إزالة guard الـ shift_date، تبديل لـ `createServiceClient()`، إدراج في link table، rollback على 23505.
- `DriverDashboard`: join جديد لـ `driver_cash_handover_orders`، حساب `unsettledCashOrders`.
- `CashHandoverModal`: prop `cashOrders` بدل `deliveredOrders`، prop `isPartial` لعنوان جزئي/نهائي.
- تصحيح: hex color `#ef4444` في `DispatchModal.tsx` → Tailwind.

### 🟠 Fix #6 — Enforce arrived_at before delivered ✅
- `driverBumpOrder`: إضافة `arrived_at` للـ select + guard يرفض delivered إذا كان `arrived_at IS NULL`.
- `DriverOrderCard`: ترجمة الخطأ الجديد `'Must mark as arrived before delivering'` AR/EN.

### 🟠 Fix #10 — Link orders.cash_settled_at ↔ handover ✅
- Migration `037_orders_cash_settlement.sql`: `orders.cash_settled_at` + `orders.cash_settlement_id` مع partial index + backfill.
- `submitCashHandover`: يكتب `cash_settled_at + cash_settlement_id` على الطلبات بعد نجاح الـ link insert.
- `DriverDashboard`: استبدال join بعمود مباشر، `custom-types.ts` محدّث.

### 🟠 Fix #19 — Cash reconciliation discrepancy workflow ✅
- Migration `038_cash_reconciliation_discrepancy.sql`: `actual_received`, `discrepancy` (GENERATED), `reconciliation_status`, `manager_notes`, `verified_at`.
- `reconcileCashHandover`: tolerance ±0.500 BD، notes مطلوبة للفروقات الكبيرة، audit log.
- `disputeCashHandover`: للمدير لرفع الحالة لـ 'disputed'.
- `CashReconciliationClient`: إعادة كتابة كاملة — input للمبلغ، delta real-time، 4-tab filter، 3 stats cards.

### 🟡 Fix Y1 — GPS only when active delivery + retention cleanup ✅
- `DriverDashboard`: GPS effect يشترط `activeOrder` (out_for_delivery) — يوفر البطارية عند الراحة.
- `postDriverLocation`: rate limit 15s server-side (silent throttle).
- Migration `039_driver_locations_retention.sql`: cleanup function + pg_cron job لحذف locations > 7 أيام.

### 🟡 Fix Y2 — Cash handover reminder banner ✅
- `CashHandoverReminderBanner.tsx`: component جديد، pulsing red banner مع count + total + dismiss.
- `DriverDashboard`: يظهر عند ≥4 طلبات نقدية unsettled أو عند الـ offline مع أي طلب نقدي.

### 🟡 Fix Y3 — Driver shift hours tracking ✅
- `toggleDriverAvailability`: يكتب في `time_entries` عند online/offline، يغلق entries المفتوحة orphaned.
- `driver/page.tsx`: fetch `time_entries` للـ hoursToday، تمريره لـ DriverDashboard.
- `DriverHeader`: عرض `hoursToday` في performance bar.

### 🟡 Fix Y4 — Tips support on cash deliveries ✅
- Migration `040_tips.sql`: `orders.tip_bhd NUMERIC(10,3) NOT NULL DEFAULT 0`.
- `driverBumpOrder`: optional `tipBhd` parameter، يكتب في DB مع guard 50 BD.
- `DriverOrderCard`: حقل tip اختياري في dialog تأكيد النقد.
- `CashHandoverModal`: يجمع `total_bhd + tip_bhd`، يعرض tip بلون أخضر.
- `submitCashHandover`: يشمل `tip_bhd` في الـ total الموثوق.

---

## الـ Migrations المكتوبة (غير مطبّقة على الإنتاج)

| # | الملف | الوصف |
|---|-------|-------|
| 035 | `035_inventory_core.sql` | نظام المخزون الكامل (من session 34) |
| 036 | `036_multiple_cash_handovers.sql` | link table لـ cash handover orders |
| 037 | `037_orders_cash_settlement.sql` | cash_settled_at + cash_settlement_id على orders |
| 038 | `038_cash_reconciliation_discrepancy.sql` | discrepancy workflow على driver_cash_handovers |
| 039 | `039_driver_locations_retention.sql` | cleanup function + pg_cron |
| 040 | `040_tips.sql` | tip_bhd على orders |

---

## حالة النظام عند الإغلاق

| العنصر | الحالة |
|--------|--------|
| Git | `master @ 9fbd574` — محلي فقط، لم يُدفع بعد |
| TypeScript | 0 أخطاء ✅ |
| Build | ✅ Compiled successfully |
| Phase-gate | 9/9 PASS ✅ |
| Migration 035 (inventory) | مكتوبة، dry-run ✅، **لم تُطبَّق** |
| Migrations 036–040 (driver phase 2) | مكتوبة، **لم تُطبَّق** |
| HANDOFF-DRIVER-PHASE-2.md | **مكتمل 100%** — يمكن حذفه أو الاحتفاظ به للمرجع |

---

## الخطوات المطلوبة من أحمد

1. **Git push**:
   ```bash
   git push
   ```
   Vercel سيعيد النشر تلقائياً.

2. **تطبيق الـ migrations على الإنتاج بالترتيب**:
   ```bash
   supabase db push
   ```
   سيطبّق 035 → 036 → 037 → 038 → 039 → 040 بالترتيب.

3. **اختبار على الإنتاج**:
   - السائق يسلّم نقد → تسليم جزئي → تسليم ثانٍ → كلاهما ينجح.
   - السائق يضغط "تم التسليم" بدون "وصلت" → رسالة خطأ.
   - المدير يفتح Cash Reconciliation → يدخل مبلغ مع فرق > 0.500 → notes مطلوبة.
   - السائق يضيف إكرامية عند التسليم → يظهر في handover modal.

---

## قرارات مهمة (Session 35)

- **Migration numbers 036–040**: HANDOFF استخدم 035–039 placeholders، لكن 035 محجوز للـ inventory → تم تصحيح الأرقام لـ 036–040.
- **`as any` casts**: استُخدمت لجداول 036, 037, 038 الجديدة غير الموجودة في generated types — ستزول عند regenerate types بعد apply الـ migrations.
- **`hoursToday` كـ server-side prop**: يُحسب عند تحميل الصفحة فقط؛ لا يتحدّث live خلال الجلسة — مقبول للبيانات المستخدمة للإشارة لا للمحاسبة الدقيقة.
- **dispatchModal hex fix**: تصحيح `#ef4444` pre-existing في Fix #5 لأنه كُشف بواسطة phase-gate check.

---

## Outstanding Follow-ups

- 🟢 Architecture: dead `returning` driver status، payments embed cardinality، realtime channel scoping — لم تُجدول.
- Manager hours dashboard على `/dashboard/staff/[id]` — مقترح من HANDOFF كـ out-of-scope follow-up.
- Inventory migration 035 — تطبيق على production عند جاهزية المخزون.
- Regenerate Supabase types بعد apply الـ migrations: `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts`

---

## الجلسة السابقة (34) — للمرجع

شاهد session 34 في الملف الأقدم للتفاصيل الكاملة عن Driver Security Hardening وInventory Core Migration.
