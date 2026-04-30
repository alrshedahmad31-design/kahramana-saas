# LAST-SESSION.md — Session 27
> Date: 2026-04-30 | Status: `inventory_plan_enterprise`

---

## ما تم في هذه الجلسة

### Inventory Plan — Enterprise Edition ✅

الخطة أُعيد كتابتها من نسخة أساسية (6 phases, 10 جداول) إلى Enterprise:

**Commits:** 11a97e9 → 8643ad7 → 63832aa

**ما أُضيف:**
- 18 جدول بدل 10 (inventory_lots, prep_items, ingredient_allergens, supplier_price_history, par_levels, unit_conversions, delivery_platform_mappings)
- FEFO lot tracking مع تواريخ انتهاء
- Sub-recipes / Prep Items (صلصات، عجائن، مرق)
- 14 مسبب حساسية (EU+GCC)
- سلسلة تصعيد الهدر: 0h→BM, 4h→GM, 8h→Owner (pg_cron كل 30 دقيقة)
- Auto-PO generation (pg_cron يومياً)
- Menu Engineering Matrix: Star/Plowhorse/Puzzle/Dog
- Vendor Performance Scorecard
- ABC cycle count classification
- Dynamic par levels (default/weekend/ramadan/event)
- 12 تقرير متقدم بدل 4
- Barcode support + Multi-unit purchasing
- 7 مهام pg_cron

### طلبات منصات التوصيل ✅

- **الخيار A:** POS يدوي per طلب (source selector: talabat/jahez/keeta)
- **الخيار B:** CSV Import من بوابة المنصة (مجاني)
- **delivery_platform_mappings:** ربط أسماء المنصة بالـ slugs (مرة واحدة)
- صاحب المطعم يختار حسب الحجم — لا قيد

### Anti-Duplicate Protection ✅

- `platform_order_id` column على جدول orders (nullable)
- `UNIQUE INDEX (order_source, platform_order_id) WHERE NOT NULL`
- CSV import يفحص قبل الإدراج → skipped_duplicates list
- `ON CONFLICT DO NOTHING` كشبكة أمان على مستوى DB
- Import UI يعرض: ✅ 39 جديد | ⏭ 8 مُتخطَّاة (مدخَلة يدوياً)

---

## المهام المتبقية

### أولوية عالية
1. **بدء التنفيذ** — Phase 1: Migration 029 جاهزة للبناء
2. **BA-08 Tap** — منتظِر `TAP_SECRET_KEY` + `PAYMENT_WEBHOOK_SECRET` من أحمد

### أولوية متوسطة
3. **BA-14/15/17 E2E** — اختبار بعد redeploy
4. **BA-16 Rich Results** — فحص rich results للصفحات الخمس

---

## حالة النظام عند الإغلاق
- **Git**: master @ `63832aa`
- **Inventory Plan**: Enterprise Edition جاهزة — لم يُنفَّذ بعد
- **Vercel**: env vars set — redeploy pending (GA4 + Clarity)
- **Payments**: Cash + Benefit-QR functional. Tap deferred (BA-08).
- **Supabase**: 28 migrations applied

## قرارات مهمة
- منصات التوصيل: يدوي + CSV — لا API integration الآن
- Anti-duplicate: طبقتان (DB UNIQUE INDEX + code-level check)
- delivery_platform_mappings: إعداد مرة واحدة → import تلقائي 100%
