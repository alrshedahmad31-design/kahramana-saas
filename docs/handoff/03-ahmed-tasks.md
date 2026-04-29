# Ahmed — مهامك الشخصية
> آخر تحديث: 2026-04-29
> هذه المهام لا أحد يقدر يعملها عنك:
>   - حسابات شخصية، كلمات سر، قرارات استراتيجية
>   - تأكيد بيانات العمل (أرقام، عناوين، صور)
>   - مراجعات نص ونغمة
>   - عمليات على جهازك أو حساباتك المالية

كل مهمة فيها: لماذا، الخطوات، معيار النجاح، الوقت المتوقع.

---

## 🔴 P0 — أمنيّة عاجلة

### A-01 — تغيير كلمة سر admin@kahramanat.com فوراً
- **لماذا:** الملف `supabase/migrations/015_production_admin.sql` يحتوي كلمة السر `Admin2026!Kahr` نصاً صريحاً (بصيغة bcrypt في الـ DB، لكن الأصل في الملف). الملف gitignored لكنه موجود في working tree، والكلمة ضعيفة أصلاً (14 حرف، نمط متوقع).
- **الخطوات:**
  1. https://supabase.com/dashboard/project/wwmzuofstyzworukfxkt
  2. Authentication → Users → ابحث `admin@kahramanat.com`
  3. اضغط "..." → "Send password reset" (أو "Update password")
  4. ضع كلمة سر جديدة قوية (≥ 24 حرف، عشوائية، مديرة كلمات سر)
  5. احذف الملف من القرص:
     ```powershell
     Remove-Item "C:\Users\Espresso\Desktop\kahramana-platform\kahramana-Saas\supabase\migrations\015_production_admin.sql"
     ```
  6. تأكد أنه ما زال في `.gitignore` (موجود حالياً)
- **النجاح:** قدرت تسجّل دخول بالكلمة الجديدة، الملف ما عاد موجود
- **الوقت:** 5 دقائق

### A-02 — حذف المجلد المعطوب `src/app/`[locale`]`
- **لماذا:** مجلد فاضي بأقواس backtick حرفية ناتج من خطأ shell quoting قديم. حاولت أحذفه من Linux sandbox لكنه يرفض بسبب صلاحيات NTFS.
- **الخطوات (PowerShell):**
  ```powershell
  Remove-Item -Recurse -Force "C:\Users\Espresso\Desktop\kahramana-platform\kahramana-Saas\src\app\``[locale``]"
  ```
- **النجاح:** الأمر `Get-ChildItem src\app | Select-String 'locale'` يرجع `[locale]` فقط (بدون نسخة backtick)
- **الوقت:** 30 ثانية

---

## 🟠 P1 — قرارات استراتيجية (Claude Code معلَّق على ردك)

### A-03 — قرار: هل يقدر المالك يدخل صفحة `/driver`؟
- **الوضع الحالي في الكود:** نعم يقدر. `canAccessDriver` يسمح للـ owner / general_manager / branch_manager / driver.
- **brief الفحص E2E يقول:** المالك يجب يُمنع.
- **اختر:**
  - **A) المالك مسموح:** لا تغيير كود، فقط حدّث الـ brief.
  - **B) المالك ممنوع:** Claude Code يعدّل `canAccessDriver` لـ `role === 'driver'` فقط، ويضيف `canViewDriverDispatch` للمدراء.
- **توصيتي:** A. المالك في رستوران صغير غالباً يحتاج يشوف نشاط السائقين بنفسه.
- **الوقت لاتخاذ القرار:** دقيقة

### A-04 — قرار: rate-limit للـ Contact Form
- **المطلوب اختياره:** بدائل لرفع spam-protection على `/contact`:
  | الخيار | تكلفة | سهولة | فعالية |
  |---|---|---|---|
  | Vercel KV (sliding window) | مجاني حتى 30K req/شهر | ★★★★ | ★★★★★ |
  | Upstash Redis | مجاني حتى 10K req/يوم | ★★★ | ★★★★★ |
  | hCaptcha + honeypot | مجاني تماماً | ★★★ | ★★★★ |
  | Honeypot فقط | مجاني | ★★★★★ | ★★★ |
- **توصيتي:** Vercel KV — مدمج، صفر إعداد، يصمد serverless.
- **الوقت:** دقيقة لاتخاذ القرار، Claude Code ينفّذ بعدها

### A-05 — قرار: هل صفحات legal تُفهرس أم noindex؟
- **حالياً:** قابلة للفهرسة في `/sitemap.xml` بـ priority 0.2.
- **الخيار:**
  - **A) قابلة للفهرسة (الحالي):** يساعد LLMs ChatGPT/Gemini يجدون السياسات (AEO).
  - **B) noindex:** يركّز link equity على الصفحات التسويقية.
- **توصيتي:** A. ميزة AEO تفوق خسارة link equity الصغيرة.
- **الوقت:** دقيقة

### A-06 — قرار: استبدال `xlsx` بـ `exceljs`؟
- **لماذا:** xlsx فيه ثغرة HIGH severity بدون patch.
- **التكلفة:** Claude Code يحتاج 2–3 ساعات إعادة كتابة `lib/reports/export-excel.ts`.
- **الفائدة:** صفر vulnerable dependencies في production bundle.
- **توصيتي:** نعم نفذ. الـ reports admin-only فالخطر محدود لكن `npm audit` نظيف مهم لـ client handoff.
- **الوقت:** دقيقة

---

## 🟡 P1 — تأكيد بيانات (لا أحد يعرفها غيرك)

### A-07 — تأكيد priceRange للمطعم
- **حالياً:** `'$$'` في schema.org (متوسط).
- **اختر من:** `$` (رخيص) / `$$` (متوسط) / `$$$` (مرتفع) / `$$$$` (فاخر)
- **استخدامه:** يظهر في Google rich results
- **الوقت:** ثانية

### A-08 — تأكيد ساعات العمل لكل فرع
- **حالياً في `src/constants/contact.ts`:**
  - الرفاع: يومياً 7:00 م – 1:00 ص
  - قلالي: يومياً 12:00 م – 1:00 ص
- **افحص:** هذا صحيح؟ في رمضان مختلف؟ يومي إجازة أسبوعي؟
- **النجاح:** أرسل تأكيداً بأي تعديل، Claude Code يحدّث constants + schema
- **الوقت:** دقيقة

### A-09 — تأكيد روابط Social Media الرسمية
- **حالياً في `GENERAL_CONTACT`:**
  - Instagram: `instagram.com/kahramanat_b`
  - TikTok: `tiktok.com/@kahramanat_b`
  - Snapchat: `@kahramanat_b`
  - Facebook: `facebook.com/kahramanat1`
- **افحص:** كل رابط يفتح حساب فعلي حالي ونشط؟
- **مهم لـ:** schema.org `sameAs` — Google يستخدمها للتحقق من الـ brand
- **الوقت:** دقيقتين

### A-10 — تأكيد الـ alt text لكل طبق في `menu.json`
- **لماذا:** `src/data/menu.json` فيه 168 طبقاً. حقل `alt: { ar, en }` لو فاضي يضرّ SEO + accessibility.
- **الخطوات:**
  1. افتح `src/data/menu.json` في VS Code
  2. اضغط Ctrl+F → ابحث `"alt"` → عدّ النتائج
  3. لو أقل من 168، فاضي في كثير من الأطباق
  4. تعبئة كل واحد يدوياً يأخذ ساعة. أو أعطني GO وأنا أملأها بنمط ذكي بناءً على `name` + `category`
- **الوقت:** ساعة لو يدوي، 5 دقائق لو موافق على auto-fill

### A-11 — تأكيد كلمات SEO وعناوين الصفحات
- **افتح `messages/ar.json` و `messages/en.json` تحت مفتاح `seo`:**
  - `homeTitle`, `homeDescription`, `contactTitle`, `categorySeoTitle`, إلخ
- **اقرأها كأنك زبون يبحث في Google:**
  - فيها "مطعم عراقي البحرين"؟
  - فيها أسماء الفروع (الرفاع، قلالي)؟
  - النبرة تطابق هوية كهرمانة (cinematic / formal / casual)؟
- **الوقت:** 15 دقيقة قراءة + ملاحظات

---

## 🟡 P2 — أصول تصميم تحتاج تجهيزها

### A-12 — تصميم OG image (1200×630)
- **لماذا:** schemas تشير لـ `https://kahramanat.com/assets/brand/og-image.webp` — ما تحققت من وجود الملف. لو غير موجود، مشاركات السوشيال media تظهر بدون صورة.
- **المواصفات:**
  - 1200 × 630 px
  - WebP + JPG fallback
  - Logo + brand name + tagline ("مطعم عراقي في البحرين")
  - ألوان: gold `#d19f51` على black `#110b05`
- **أين تحفظه:** `public/assets/brand/og-image.webp`
- **الوقت:** ساعة (Canva / Figma)

### A-13 — Logo SVG في `/public/assets/brand/`
- **لماذا:** schema يستخدم `${SITE}/assets/brand/logo.svg` — لو مفقود، Google لن يربط الـ Logo بـ knowledge panel.
- **المطلوب:** SVG vector، مربع، شفافية، بحد أدنى 500×500 viewport
- **أين:** `public/assets/brand/logo.svg`
- **الوقت:** نصف ساعة

### A-14 — Favicon + Apple Touch Icon
- **لماذا:** `layout.tsx` يشير إلى `/assets/favicon/favicon.ico` و `/assets/favicon/apple-touch-icon.png`.
- **افحص وجودهم:** افتح `public/assets/favicon/` في VS Code
- **لو مفقودين:** استخدم https://realfavicongenerator.net مع logo.svg
- **الوقت:** 10 دقائق

---

## 🔵 P2 — حسابات خارجية تحتاج تنشئها

### A-15 — حساب Resend
- **الخطوات:**
  1. https://resend.com/signup
  2. Add domain `kahramanat.com`
  3. اتبع تعليمات DNS (سيُسلَّم لـ Browsing Agent BA-05 لإضافة الـ records لو DNS عندك)
  4. احصل على API key → ضعه في `.env.local`:
     ```
     RESEND_API_KEY=re_xxxxx
     EMAIL_FROM=noreply@kahramanat.com
     ```
- **الوقت:** 15 دقيقة
- **ملاحظة:** ذكرت أنك سويتها فعلاً — تأكد API key نشط وdomain verified.

### A-16 — حساب Sentry (اختياري لكن موصى به)
- **لماذا:** تجميع errors من الإنتاج بدلاً من console.log.
- **الخطوات:**
  1. https://sentry.io/signup → free tier
  2. New project → Next.js → Bahrain region (أو أقرب)
  3. احصل على DSN + auth token
  4. ضعهم في Vercel env: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
  5. أبلغ Claude Code (CC-14) لربطها
- **الوقت:** 20 دقيقة

### A-17 — Vercel KV (لو وافقت على A-04 الخيار A)
- **الخطوات:**
  1. Vercel Dashboard → Project → Storage → Create Database → KV
  2. اربطه بـ Production environment
  3. variables `KV_URL`, `KV_REST_API_*` تُضاف تلقائياً
- **الوقت:** 5 دقائق

---

## 🟢 P3 — اختبارات E2E بنفسك

### A-18 — Smoke test على staging قبل client handoff
- **الخطوات:**
  - اطلب من Browsing Agent تنفيذ BA-14 + BA-15 + BA-16
  - راجع تقاريره
  - افتح ثلاثة sessions: عميل / كاشير / سائق → نفّذ طلب كامل من الكاسة الجديدة لتسليم
  - لاحظ أي UX awkward / Arabic typo / RTL break / loading flicker
- **الوقت:** 45 دقيقة

### A-19 — فحص Lighthouse + Mobile UX يدوياً
- **الخطوات:**
  - افتح الموقع على iPhone حقيقي + Android حقيقي
  - افحص: typography size readable، tap targets ≥ 44px، scroll smooth، animations not janky
- **الوقت:** 30 دقيقة

---

## 🚦 ترتيب التنفيذ المقترح

```
يوم 1:
  ✓ A-01 (تغيير كلمة سر admin)            5 دقائق
  ✓ A-02 (حذف مجلد معطوب)                 30 ثانية
  ✓ A-03..A-06 (4 قرارات سريعة)           5 دقائق
  ✓ A-07..A-09 (تأكيدات بيانات)           5 دقائق
  ✓ A-15 (Resend) + A-17 (Vercel KV)      20 دقيقة

يوم 2:
  ✓ A-10 (alt text — أعطني GO إذا تريد auto)
  ✓ A-11 (مراجعة SEO copy)                 15 دقيقة
  ✓ A-12 + A-13 + A-14 (الأصول التصميمية)  ساعتين

يوم 3:
  ✓ A-16 (Sentry — اختياري)
  ✓ A-18 (smoke test)                      45 دقيقة
  ✓ A-19 (فحص موبايل)                      30 دقيقة
```

بعد تنفيذ هذه القائمة، تكون جاهزاً لـ:
- نشر للإنتاج بثقة
- تسليم للعميل
- مرحلة Phase 2 (تكامل WhatsApp Business، Loyalty، إلخ)

---

## 📞 إذا تعطّلت

- **مشاكل في كود:** أرسل لـ Claude Code محتوى `01-claude-code-tasks.md` + المهمة الفاشلة
- **مشاكل في إعدادات خارجية:** أرسل لـ Browsing Agent محتوى `02-browsing-agent-tasks.md` + تفاصيل الفشل
- **مشاكل قرار / تصميم:** اسألني — قراراتك أنت
