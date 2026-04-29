---
name: kahramana-seo
description: >
  Pre-Launch SEO Agent for Kahramana Baghdad — a Next.js 15 bilingual (AR/EN) restaurant website
  with 175+ food item pages, two active branches (Riffa, Qallali), and a target market of Bahrain.

  Use this skill whenever the user asks to: audit SEO, fix metadata, improve search rankings,
  check crawlability, add structured data, optimize menu pages, improve local SEO, add hreflang,
  fix sitemap, prepare for Google Search Console, run pre-launch SEO check, or make the website
  appear in Arabic AND English restaurant searches in Bahrain.

  This skill operates in two modes: AUDIT (produces a classified report) and FIX (applies safe
  code changes only). It treats the 175+ individual dish pages as a Topical Authority engine —
  each page captures a unique long-tail keyword in both languages, making the site appear for
  ANY food or restaurant search in Bahrain, not only Iraqi cuisine searches.

  ALWAYS use this skill before any production deployment of the Kahramana Baghdad project.
---

# Kahramana Baghdad — Pre-Launch SEO Agent

## Strategic North Star

**Goal**: Rank for every food-related search in Bahrain — Arabic and English — not only "مطعم عراقي".

**How**: 175+ dish pages × 2 languages = 350+ unique keyword targets. Each page is a standalone
landing page for a specific dish, linking upward to category → menu → homepage, creating a
self-reinforcing topical authority pyramid.

**Topical Pyramid**:
```
Homepage (كهرمانة بغداد — مطعم في البحرين)
  └── Menu Hub (/menu)
        └── Category Pages (16 categories × 2 langs = 32 pages)
              └── Dish Pages (175+ × 2 langs = 350+ pages)
```

Each dish page must compete for:
- AR: "[اسم الطبق] في البحرين" / "[اسم الطبق] الرفاع" / "أفضل [اسم الطبق]"
- EN: "[dish name] bahrain" / "[dish name] restaurant" / "best [dish name] riffa"

---

## Before You Start — Required Reads

```
LAST-SESSION.md              → current project state
messages/ar.json             → all Arabic copy
messages/en.json             → all English copy
src/constants/contact.ts     → NAP data (phones, branches) — SINGLE SOURCE OF TRUTH
src/data/menu.json           → all 175+ dishes with slugs, prices, categories
src/app/sitemap.ts           → current sitemap logic
src/app/robots.ts            → current robots policy
src/app/[locale]/layout.tsx  → root metadata
src/lib/menu.ts              → menu data layer
next.config.ts               → i18n, image domains, headers
```

Do NOT invent any data. If a field is missing in these files, mark it as `TODO` in the report.

---

## Mode Selection

Detect mode from user message:
- `seo audit` / `فحص seo` / `ما مشاكل seo` → **AUDIT mode**
- `seo fix` / `صلح seo` / `طبق الإصلاحات` → **FIX mode**
- `seo audit --fix` → Run AUDIT then prompt user before applying FIX

---

## AUDIT Mode — 12 Inspection Pillars

Run all pillars. Output structured report (see Report Format section).

### Pillar 1 — Crawlability & Indexation

```
CHECK:
□ robots.ts — does it block /ar/ or /en/ prefixes accidentally?
□ sitemap.ts — does it include all 175+ dish pages + categories?
□ meta robots per route — no accidental noindex on public pages
□ x-robots-tag in next.config.ts headers
□ canonical on every page — matches primary URL
□ hreflang AR↔EN on every page — correct alternate URLs
□ Sitemap URL count matches: (175 dishes × 2 langs) + (16 cats × 2) + (8 static pages × 2) ≈ 398+

MUST BE INDEXED (never noindex):
  /[locale]/                    homepage
  /[locale]/menu                menu hub
  /[locale]/menu/[category]     category pages
  /[locale]/menu/[slug]         dish pages
  /[locale]/branches            branches
  /[locale]/about               about
  /[locale]/catering            catering
  /[locale]/contact             contact

MUST BE NOINDEX (never indexed):
  /[locale]/dashboard/**        all dashboard routes
  /[locale]/login               auth page
  /[locale]/checkout            transactional
  /[locale]/order/**            order tracking
  /[locale]/driver/**           driver PWA
  /api/**                       all API routes
```

### Pillar 2 — URL Architecture & Internal Linking

```
CHECK:
□ Homepage → Menu, Branches, About, Catering, Contact links
□ Menu hub → all 16 category pages
□ Category page → all dish pages in that category
□ Dish page → breadcrumb + back to category + 3–5 related dishes
□ Branches page → menu with ?branch=riffa and ?branch=qallali CTAs
□ No orphan pages (dish pages not linked from category)
□ No duplicate URLs (/menu vs /ar/menu — canonical must resolve)
□ No redirect chains
□ Footer → legal pages, branches, contact, social
```

### Pillar 3 — Local SEO (HIGHEST PRIORITY)

```
CHECK — only from src/constants/contact.ts:
□ Schema Restaurant + LocalBusiness for Riffa branch
□ Schema Restaurant + LocalBusiness for Qallali branch
□ Al-Budayi branch marked as "coming_soon" — NOT as active branch in schema
□ NAP consistent: same name/phone in header, footer, contact page, schema
□ WhatsApp numbers from constants only — never hardcoded elsewhere
□ Contact page shows correct branch data
□ Google Business Profile readiness (checklist item, not auto-fixable)

FORBIDDEN — never invent:
  × address string
  × openingHours
  × geo coordinates (latitude/longitude)
  × sameAs links
  × priceRange unless confirmed
  × aggregateRating
```

**Read**: `references/schema-templates.md` → Section LOCAL_BUSINESS for safe schema structure.

### Pillar 4 — Structured Data & Rich Results

```
REQUIRED SCHEMAS (safe only):
□ Organization / Restaurant → homepage
□ LocalBusiness / Restaurant → /branches (one per active branch)
□ BreadcrumbList → category pages, dish pages, branches, about, catering
□ Menu + MenuItem → /menu and /menu/[slug] (entity understanding, NOT rich result guarantee)
□ FAQPage → homepage and branches (from confirmed data only)
□ ContactPoint → /contact (phones from constants only)

VALIDATION:
□ No undefined values in JSON-LD output
□ No empty string for required fields
□ No fake openingHours, rating, review, address, geo
□ Valid JSON (run JSON.parse check mentally)
□ @context is "https://schema.org"
```

**Read**: `references/schema-templates.md` for safe JSON-LD templates.

### Pillar 5 — Arabic-First SEO

```
CHECK:
□ <html lang="ar" dir="rtl"> for /ar/ routes
□ <html lang="en" dir="ltr"> for /en/ routes
□ Every page has unique <title> in correct language
□ Every page has unique <meta name="description"> ≤ 160 chars
□ One H1 per page — in correct language
□ H1 on homepage includes: كهرمانة بغداد + مطعم + البحرين
□ No keyword stuffing — natural language only
□ Arabic titles for dish pages follow pattern:
    "[اسم الطبق] — كهرمانة بغداد | مطعم عراقي البحرين"
□ English titles follow:
    "[Dish Name] — Kahramana Baghdad | Iraqi Restaurant Bahrain"

TARGET KEYWORDS (natural integration):
  Arabic: مطعم عراقي البحرين، مطعم عراقي الرفاع، مطعم عراقي قلالي،
          مشاوي عراقية، مسكوف البحرين، منيو كهرمانة، طعام عراقي أصيل
  English: Iraqi restaurant Bahrain, Iraqi restaurant Riffa, masgouf Bahrain,
           Iraqi food Bahrain, best Iraqi restaurant, Kahramana Baghdad menu
```

**Read**: `references/keyword-matrix.md` for full keyword targets per page type.

### Pillar 6 — Menu SEO (175+ Pages as Topical Authority)

```
CHECK per dish page:
□ Unique URL slug (no duplicates)
□ Unique Arabic title
□ Unique English title
□ Meta description uses dish name + category + كهرمانة / Kahramana
□ Canonical correct (/ar/menu/[slug] canonicalizes to itself)
□ hreflang: ar → /ar/menu/[slug], en → /en/menu/[slug]
□ Alt text on dish image = dish name in page language
□ BreadcrumbList: Home > Menu > [Category] > [Dish]
□ Price shown from data layer only — no invented prices
□ Related dishes: 3–5 from same category
□ No dish missing Arabic name
□ No dish missing slug
□ Sitemap includes ALL dish pages

SITEMAP COUNT AUDIT:
  Expected dish pages: dish_count × 2 (AR + EN)
  Expected category pages: 16 × 2 = 32
  Compare against sitemap.ts output
```

### Pillar 7 — Image & Asset SEO

```
CHECK:
□ All dish images use next/image
□ All images have alt text (from dish name, not empty)
□ No broken image paths (check against public/ directory)
□ Images have explicit width + height or fill + sizes
□ Hero image has priority={true} — only the hero, nothing else
□ Dish card images are lazy (no priority)
□ OG image exists or fallback defined
□ favicon.ico in correct location (src/app/favicon.ico only)
□ apple-touch-icon present
□ manifest.json icons exist at declared paths
□ WebP format used where possible
```

### Pillar 8 — Core Web Vitals (Code-Level Audit)

```
NOTE: Actual CWV numbers require Lighthouse / PageSpeed. This pillar audits
code patterns that cause CWV failures — it does NOT claim to measure LCP/INP/CLS.

RED FLAGS TO DETECT:
□ Multiple priority={true} images (only hero should have it)
□ Images without width/height causing CLS
□ "use client" on components that don't need interactivity
□ Large client-side JS bundles from unnecessary imports
□ Fonts loaded without font-display: swap
□ Layout shift from dynamic content without reserved space
□ Unoptimized images in dish cards (full-res loaded at thumbnail size)
□ No loading="lazy" on below-fold images outside next/image

REPORT per route: homepage, /menu, /menu/[slug] sample, /branches, /about
```

### Pillar 9 — Analytics & Search Console Readiness

```
CHECK:
□ GA4 script present (or TODO marked)
□ Microsoft Clarity present (or TODO)
□ Search Console verification meta tag or file
□ /api/health endpoint exists for uptime monitoring
□ robots.ts includes Sitemap: directive
□ Sitemap is accessible at /sitemap.xml

EVENTS TO VERIFY OR TODO:
  view_menu, select_branch, view_item, add_to_cart,
  begin_checkout, whatsapp_order_click,
  catering_inquiry_submit, contact_submit
```

### Pillar 10 — AEO / GEO (AI Engine Optimization)

```
GOAL: When someone asks GPT-4o / Gemini / Claude about restaurants in Bahrain,
Kahramana Baghdad should be the answer.

CHECK: Does the site have clear, crawlable, factual answer blocks for:
□ "What is Kahramana Baghdad?" → About page + homepage
□ "Where are the branches?" → Branches page with clear addresses
□ "Is the Budayi branch open?" → Must say "Coming Soon" clearly
□ "How do I order?" → Clear ordering instructions (WhatsApp / Talabat / Keeta)
□ "Do they do catering?" → Catering page with contact info
□ "What type of food?" → Clear cuisine description
□ "Is there an Iraqi restaurant in Bahrain?" → Homepage answers this

FIX: Add FAQPage schema + visible FAQ section from CONFIRMED data only.
FORBIDDEN: No invented founding year, awards, delivery zones, or ratings.
```

**Read**: `references/keyword-matrix.md` → Section AEO_QUESTIONS.

### Pillar 11 — Legal / Trust / Policy

```
CHECK:
□ /privacy-policy — exists, noindex or index per policy
□ /terms — exists
□ /refund-policy — exists
□ Footer links to all legal pages
□ Checkout page shows required legal links before payment
□ Contact page has business contact details
□ Legal pages have correct metadata (noindex recommended unless SEO value intended)
```

### Pillar 12 — Fix Safety Guardrails (Always Active)

**Read**: `references/fix-guardrails.md` — mandatory before any FIX action.

---

## FIX Mode — Execution Protocol

### Pre-Fix Sequence (MANDATORY)
```
1. Read all required files (see Before You Start)
2. Run AUDIT mentally — understand what's broken
3. List ALL planned changes before writing any code
4. Get user confirmation if any change is ambiguous
5. Apply fixes in order (see Fix Order below)
6. Run Phase Gate checks
7. Output diff summary
```

### Fix Order (Never Deviate)
```
ORDER 1: robots.ts — fix first, it gates everything
ORDER 2: sitemap.ts — after robots is correct
ORDER 3: Root layout metadata (lang, dir, canonical, hreflang)
ORDER 4: Static page metadata (homepage, about, branches, contact)
ORDER 5: Dynamic page metadata (category pages, dish pages)
ORDER 6: JSON-LD schemas (after metadata is correct)
ORDER 7: Internal links + breadcrumbs
ORDER 8: Image alt text + sizes
ORDER 9: Analytics event TODOs
ORDER 10: FAQ/AEO content blocks
```

### Phase Gate After FIX
```bash
npx tsc --noEmit          # must PASS
npm run build             # must PASS, page count must not decrease
```

---

## Report Format (AUDIT Output)

```md
# Pre-Launch SEO Audit — Kahramana Baghdad
**Date**: [date]  **Mode**: AUDIT

## Executive Summary
| Metric | Value |
|--------|-------|
| Total routes audited | |
| Sitemap URLs | |
| Expected sitemap URLs | |
| Critical issues | |
| High issues | |
| Medium issues | |
| Low issues | |

## Critical Issues
| ID | Pillar | File/Route | Problem | Evidence | Fix | Auto-fixable |
|----|--------|-----------|---------|----------|-----|-------------|

## High Issues
[same table]

## Medium Issues
[same table]

## Low Issues
[same table]

## Sitemap Coverage
| Type | Expected | Found | Missing |
|------|----------|-------|---------|
| Dish pages (AR) | | | |
| Dish pages (EN) | | | |
| Category pages (AR) | | | |
| Category pages (EN) | | | |
| Static pages | | | |

## Local SEO Status
[Per branch: Riffa / Qallali / Budayi]

## AEO Readiness
[Per question: answered / missing / TODO]

## Client Confirmation Needed
[List of items that require restaurant owner input before fixing]

## Fix Plan
[If --fix flag: ordered list of safe changes to apply]
```

---

## Reference Files

| File | When to Read |
|------|-------------|
| `references/keyword-matrix.md` | Pillar 5, 6, 10 — keyword targets per page type |
| `references/schema-templates.md` | Pillar 3, 4 — safe JSON-LD structure |
| `references/audit-checklist.md` | Full granular checklist for each pillar |
| `references/fix-guardrails.md` | Before ANY write operation in FIX mode |
