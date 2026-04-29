# Workflow: /end-session
## Description
أجرِ هذا الـ workflow في نهاية كل session قبل إغلاق Antigravity.
يحدّث `phase-state.json` و`LAST-SESSION.md` معاً.

---

## Steps

### Step 1 — جمع ما أُنجز
اجمع من هذه الجلسة:
- أي ملفات أُنشئت أو عُدِّلت
- الحالة الحالية لكل deliverable
- أي قرارات تقنية اتُّخذت
- أي موانع اكتُشفت

### Step 2 — تحديث phase-state.json
```
- انقل كل ملف أُنجز من deliverables_pending إلى deliverables_completed
- إذا اكتملت المرحلة كاملاً: set status = "done", set completed_at
- إذا لا تزال جارية: أبق status = "in-progress"
- حدّث أي blockers جديدة
```

### Step 3 — كتابة LAST-SESSION.md
اكتب الملف بهذا الهيكل الدقيق:

```markdown
# LAST SESSION — Kahramana Baghdad
> يُحدَّث بعد كل session عبر `/end-session` workflow.
> عند العمل في Claude.ai: انسخ هذا الملف كاملاً في بداية المحادثة.

---

## آخر تحديث
**التاريخ**: [اليوم]
**الأداة المستخدمة**: Antigravity
**مدة الجلسة**: [تقريباً]

---

## الحالة الحالية

**المرحلة**: Phase [N] — [اسم المرحلة]
**الحالة**: [pending / in-progress / done]

---

## ما أُنجز في هذه الجلسة
- [ملف أو feature أو قرار]
- [...]

---

## الملفات التي تم إنشاؤها / تعديلها
- `path/to/file.tsx` — [وصف مختصر]
- [...]

---

## المتبقي في المرحلة الحالية
- [ ] `path/to/pending-file`
- [...]

---

## الخطوة التالية المباشرة
[جملة واحدة — ماذا يبدأ به الـ agent في الجلسة القادمة]

---

## الموانع والملاحظات
- [أي blocker خارجي أو قرار معلق]

---

## قرارات تقنية اتُّخذت هذه الجلسة
- [مثال: قررنا استخدام Zustand بدل Context للـ cart]
- [...]
```

### Step 4 — تأكيد
اطبع:
```
OK Session saved
Document: LAST-SESSION.md updated
Analytics: phase-state.json updated

للمتابعة في Claude.ai: انسخ محتوى .agent/LAST-SESSION.md في بداية المحادثة
للمتابعة في Antigravity: اكتب /start-session
```
