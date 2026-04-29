# SITE AUDIT — kahramanat.com
> Phase 0 Audit | Date: 2026-04-27 | Auditor: Claude
> Live URL: https://kahramanat.com

---

## 1. Current Site Overview

| Field | Value |
|---|---|
| Type | Static HTML site (NOT Next.js) |
| Pages | 7 pages |
| Language | AR primary, EN secondary |
| Direction | RTL OK |
| Canonical | Set correctly OK |
| Clean URLs | Working (`.html` extension stripped server-side) |
| Ordering | `wa.me` WhatsApp links (no online payment) |
| Third-party delivery | Talabat + Keeta |

### Site Pages

| URL | Title |
|---|---|
| `/` | كهرمانة بغداد \| Kahramana Baghdad |
| `/menu` | قائمة الطعام \| Menu |
| `/story` | قصتنا \| Our Story |
| `/gallery` | المعرض \| Gallery |
| `/events` | الفعاليات \| Events |
| `/recipes` | الوصفات \| Recipes |
| `/contact` | تواصل معنا \| Contact & Branches |

---

## 2. Branch Information (Confirmed)

| Branch | Address | Hours | Phone | WhatsApp |
|---|---|---|---|---|
| الرفاع — الحجيات | منطقة الحجيات، الرفاع، البحرين | يومياً ٧:٠٠م – ١:٠٠ص | +973 1713 1413 | wa.me/97317131413 |
| المحرق — قلالي | الشارع الرئيسي، قلالي، البحرين | يومياً ١٢:٠٠م – ١:٠٠ص | +973 1713 1213 | wa.me/97317131213 |

Warning: **Hours mismatch**: Riffa opens at 7pm, Qallali opens at 12pm (noon). Different opening times — confirm with restaurant for Phase 1.

---

## 3. Menu Structure (Confirmed: 14 Categories)

| # | Category (AR) | Category (EN) | Count |
|---|---|---|---|
| 1 | الشوربات | Soups | 4 |
| 2 | السلطات | Salads | 5 |
| 3 | المقبلات الباردة | Cold Mezze | 8 |
| 4 | المقبلات الحارة | Hot Starters | 7 |
| 5 | الأطباق الرئيسية | Main Courses | 22 |
| 6 | المروقات | Stews | 3 |
| 7 | المشاوي | Grills | 10 |
| 8 | شاورما | Shawarma | TBC |
| 9 | الفطائر والمعجنات | Pastries & Pies | TBC |
| 10 | البيتزا | Pizza | TBC |
| 11 | السندويشات | Sandwiches | TBC |
| 12 | المشروبات | Beverages | TBC |
| 13 | الحلويات | Desserts | TBC |

**Confirmed total (partial count):** 59+ items across 7 counted categories. Full count pending bilingual menu data from restaurant.

---

## 4. Critical Bugs Critical

### 4.1 — 95/107 menu page images broken

**Severity:** CRITICAL  
**Page:** `/menu`  
**Cause:** Images use relative path `assets/gallery/filename.webp` instead of absolute `/assets/gallery/filename.webp`  
**Impact:** 89% of menu item photos invisible to users — destroys trust and conversion

**Broken image examples:**
```
assets/gallery/jajik-cucumber-yogurt.webp   ← should be /assets/gallery/...
assets/gallery/moutabal.webp
assets/gallery/classic-hummus.webp
assets/gallery/slow-cooked-lamb-quzi.webp
assets/gallery/kebab-with-rice.webp
... (92 more)
```

**Fix for current site:** Change all `src="assets/gallery/..."` → `src="/assets/gallery/..."`  
**Fix for Phase 1:** All images served from Sanity CMS CDN — this issue disappears entirely.

---

### 4.2 — Hero image/video broken on homepage

**Severity:** CRITICAL  
**Page:** `/`  
**Cause:** Hero section renders as empty dark placeholder — video/image not loading in viewport  
**Impact:** First impression destroyed — blank dark box instead of food visuals

---

### 4.3 — Asset folder with spaces in name

**Severity:** HIGH  
**Path:** `/assets/Three%20Pillars%20of%20Excellence/` (URL-encoded spaces)  
**Files:** `iraqi-heritage.webp`, `the-charcoal-grill.webp`, `the-royal-feast.webp`  
**Impact:** URL-encoded paths are fragile and cause issues with CDN caching  
**Fix for Phase 1:** Rename to `three-pillars/` and migrate files

---

## 5. SEO Issues Medium

### 5.1 — Page title too long

| Page | Current Title | Length | Limit |
|---|---|---|---|
| Homepage | كهرمانة بغداد \| Kahramana Baghdad — سفير المذاق العراقي في البحرين \| The Ambassador of Iraqi Taste in Bahrain | 94 chars | 60 |
| Menu | قائمة الطعام \| كهرمانة بغداد — Menu \| Kahramana Baghdad | 54 chars | OK |
| Story | قصتنا \| كهرمانة بغداد — Our Story \| Kahramana Baghdad | 52 chars | OK |
| Contact | تواصل معنا \| كهرمانة بغداد — Contact & Branches \| Kahramana Baghdad | 66 chars | Warning: |

### 5.2 — No Schema.org structured data

Missing JSON-LD for:
- `Restaurant` schema (name, address, phone, hours, cuisine, priceRange)
- `Menu` schema (categories + items)
- `BreadcrumbList` on inner pages
- `LocalBusiness` with geo coordinates

### 5.3 — Image alt text quality

Some images use generic alt text (`"Grills"`, `"Mains"`) — should include restaurant name and dish description for image SEO.

---

## 6. UX Issues Medium

### 6.1 — WhatsApp order message English-only

**Current wa.me links:**
```
wa.me/97317131413?text=Hello%2C%20I%27d%20like%20to%20order%20from%20Kahramana%20Riffa
wa.me/97317131213?text=Hello%2C%20I%27d%20like%20to%20order%20from%20Kahramana%20Muharraq
```

Primary audience is Arabic-speaking — pre-filled message should be in Arabic.

### 6.2 — No cart / order builder

User sees menu items but cannot add items to a structured order. They must manually type what they want in WhatsApp — high friction, high error rate.

### 6.3 — No price display on menu items

The current menu page shows dish names and descriptions but no prices visible from audit data. Prices are a key decision-making factor.

### 6.4 — Contact form sends via WhatsApp

The contact form "أرسل استفسارك عبر واتساب" — no backend, no email fallback, no confirmation.

---

## 7. Performance Observations

| Item | Status |
|---|---|
| Static HTML | OK Fast baseline |
| WebP images (where loading) | OK Correct format |
| Broken images (95) | NO Failed requests waste bandwidth |
| No lazy loading evidence | Warning: 107 images on menu page potentially blocking |
| hero-menu.mp4 video | NO Not loading in viewport |

---

## 8. What Phase 1 Solves

| Current Problem | Phase 1 Solution |
|---|---|
| Broken menu images (relative paths) | All images from Sanity CDN — absolute URLs |
| No cart / order builder | Full cart + checkout flow |
| WhatsApp English-only messages | Structured order with branch selection |
| No price display | Prices from Sanity CMS |
| No schema.org | Next.js metadata API + JSON-LD |
| Static HTML, no SSR | Next.js 15 App Router with SSR/SSG |
| No analytics beyond basic | GA4 + Microsoft Clarity |

---

## 9. Assets to Carry Forward into Phase 1

| Asset | Status | Notes |
|---|---|---|
| Brand identity (name, tagline, colours) | OK Use | "Midnight Mesopotamian Luxe" direction already reflected |
| Bilingual approach (AR/EN) | OK Keep | next-intl |
| Founder story content | OK Migrate | To Sanity CMS |
| Branch data (addresses, hours, phones) | OK Confirmed | See Section 2 |
| Social handles | OK Confirmed | @kahramanat_b (IG/TT/SC), kahramanat1 (FB) |
| Menu category structure (14 cats) | OK Use | As Sanity schema |
| wa.me fallback ordering | OK Keep in Phase 1 | Replace in Phase 6 |
