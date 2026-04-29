# Audit Checklist — Kahramana Baghdad SEO Agent
# Granular per-pillar checklist. Check every item. Mark: ✅ PASS / ❌ FAIL / ⚠️ WARN / ➡️ TODO

---

## Pillar 1 — Crawlability & Indexation

### robots.ts
- [ ] File exists at src/app/robots.ts
- [ ] Returns valid robots.txt format
- [ ] Does NOT block /ar/ or /en/ prefixes
- [ ] Blocks /dashboard, /api, /login, /checkout, /driver, /order
- [ ] Contains Sitemap: https://[domain]/sitemap.xml

### sitemap.ts
- [ ] File exists at src/app/sitemap.ts
- [ ] Returns array of SitemapURL objects
- [ ] Includes homepage in AR + EN
- [ ] Includes /menu in AR + EN
- [ ] Includes ALL 16 category pages × 2 languages
- [ ] Includes ALL 175+ dish pages × 2 languages
- [ ] Includes /branches, /about, /catering, /contact in AR + EN
- [ ] Excludes /dashboard, /login, /checkout, /order, /driver
- [ ] lastModified values are dynamic
- [ ] priority values: homepage=1.0, menu=0.9, categories=0.8, dishes=0.7, static=0.6

### Per-Page Meta Robots
- [ ] Homepage: index, follow
- [ ] /menu: index, follow
- [ ] /menu/[category]: index, follow
- [ ] /menu/[slug]: index, follow
- [ ] /branches: index, follow
- [ ] /about: index, follow
- [ ] /catering: index, follow
- [ ] /contact: index, follow
- [ ] /dashboard: noindex, nofollow
- [ ] /login: noindex, nofollow
- [ ] /checkout: noindex, nofollow
- [ ] /order/[id]: noindex, nofollow
- [ ] /driver: noindex, nofollow
- [ ] /privacy-policy: noindex (recommended) or index (strategy choice — flag for client)
- [ ] /terms: noindex (recommended) or index
- [ ] /refund-policy: noindex (recommended) or index

### Canonical
- [ ] Every public page has canonical
- [ ] /ar/menu/[slug] canonical = itself (not /en/ version)
- [ ] /en/menu/[slug] canonical = itself
- [ ] No page canonicalizes to a noindex page
- [ ] No trailing slash inconsistency

### hreflang
- [ ] Every public page has hreflang x-default
- [ ] Every AR page has hreflang ar → /ar/[path]
- [ ] Every EN page has hreflang en → /en/[path]
- [ ] hreflang URLs are absolute (https://), not relative

---

## Pillar 2 — URL Architecture & Internal Linking

- [ ] Homepage has nav links to: /menu, /branches, /about, /catering, /contact
- [ ] /menu links to all 16 category pages
- [ ] Each category page links to all its dish pages
- [ ] Each dish page has breadcrumb component
- [ ] Each dish page has "back to [category]" link
- [ ] Each dish page has 3–5 related dishes from same category
- [ ] /branches has CTA → /menu?branch=riffa
- [ ] /branches has CTA → /menu?branch=qallali
- [ ] Footer contains links to legal pages
- [ ] Footer contains links to branches, contact
- [ ] No dish page is orphan (not linked from category)
- [ ] No redirect chains detected
- [ ] /menu and /ar/menu resolve consistently (check canonical)

---

## Pillar 3 — Local SEO

### Schema Present
- [ ] Restaurant schema on homepage
- [ ] LocalBusiness schema for Riffa branch
- [ ] LocalBusiness schema for Qallali branch
- [ ] Budayi branch NOT shown as active in schema

### Data Integrity
- [ ] All phone numbers match src/constants/contact.ts
- [ ] No invented address strings
- [ ] No invented openingHours
- [ ] No invented geo coordinates
- [ ] No invented priceRange (or flagged as TODO)
- [ ] No aggregateRating in schema

### NAP Consistency Audit
- [ ] Header phone = constants phone
- [ ] Footer phone = constants phone
- [ ] Contact page phone = constants phone
- [ ] Schema phone = constants phone
- [ ] Branch name consistent: "كهرمانة بغداد" / "Kahramana Baghdad" everywhere

---

## Pillar 4 — Structured Data

- [ ] Organization/Restaurant on homepage — valid JSON
- [ ] LocalBusiness × 2 on branches — valid JSON
- [ ] BreadcrumbList on category pages — valid JSON
- [ ] BreadcrumbList on dish pages — valid JSON
- [ ] MenuItem schema on dish pages — valid JSON
- [ ] FAQPage on homepage (if FAQ section exists) — valid JSON
- [ ] No undefined values in any JSON-LD
- [ ] No empty required fields
- [ ] @context = "https://schema.org" (not "http://")
- [ ] Script type = "application/ld+json"
- [ ] No fake ratings / reviews / nutrition

---

## Pillar 5 — Arabic-First SEO

### HTML Attributes
- [ ] /ar/ routes: <html lang="ar" dir="rtl">
- [ ] /en/ routes: <html lang="en" dir="ltr">

### Per Page Metadata (spot check 5 pages of each type)
- [ ] Homepage AR has unique title with كهرمانة بغداد + مطعم + البحرين
- [ ] Homepage EN has unique title with Kahramana Baghdad + Iraqi Restaurant + Bahrain
- [ ] Each page has unique <title> (no duplicate titles)
- [ ] Each page has unique <meta description> ≤ 160 chars
- [ ] Each page has exactly ONE H1
- [ ] H1 content matches page purpose

### Keywords
- [ ] No keyword stuffing detected
- [ ] Target keywords appear naturally in: title, H1, first paragraph, meta description
- [ ] Arabic copy uses natural Gulf dialect where appropriate

---

## Pillar 6 — Menu SEO

Spot-check: run on 10 dish pages randomly selected + all category pages.

### Per Dish Page
- [ ] Unique slug
- [ ] Unique Arabic title
- [ ] Unique English title
- [ ] Meta description includes dish name + كهرمانة / Kahramana
- [ ] Canonical correct
- [ ] hreflang AR + EN correct
- [ ] Image alt = dish name in page language
- [ ] BreadcrumbList present
- [ ] Price from data layer (not hardcoded)
- [ ] No dish missing Arabic name in data
- [ ] No dish missing slug in data

### Sitemap Coverage
- [ ] Count dishes in src/data/menu.json
- [ ] Count dish URLs in sitemap.ts output
- [ ] AR dish pages in sitemap = dish count
- [ ] EN dish pages in sitemap = dish count
- [ ] Category pages in sitemap = 16 × 2 = 32

---

## Pillar 7 — Image & Asset SEO

- [ ] All dish images use <Image> from next/image (not <img>)
- [ ] All dish images have alt prop (non-empty)
- [ ] Hero image has priority={true}
- [ ] No other image has priority={true}
- [ ] All images have width + height OR fill + sizes
- [ ] OG image exists: src/app/opengraph-image.tsx or /public/og-image.jpg
- [ ] favicon.ico at src/app/favicon.ico (NOT at public/favicon.ico)
- [ ] apple-touch-icon present
- [ ] public/manifest.json icons exist at their declared paths
- [ ] No broken image paths (verify against public/ directory listing)

---

## Pillar 8 — Core Web Vitals (Code Audit)

### Per Route: homepage, /menu, /menu/[slug], /branches, /about
- [ ] No multiple priority={true} images
- [ ] Images have explicit dimensions (no layout shift)
- [ ] Fonts loaded with font-display: swap or optional
- [ ] No unnecessary "use client" on static components
- [ ] Large imports not loaded on initial route (check next.js bundle)
- [ ] No unoptimized images prop on next/image

---

## Pillar 9 — Analytics

- [ ] GA4 measurement ID present in code (or TODO marked)
- [ ] Microsoft Clarity ID present (or TODO marked)
- [ ] Search Console verification ready (meta tag or file)
- [ ] /api/health endpoint exists
- [ ] robots.ts Sitemap: directive present
- [ ] Event: view_menu tracked (or TODO)
- [ ] Event: select_branch tracked (or TODO)
- [ ] Event: view_item tracked (or TODO)
- [ ] Event: add_to_cart tracked (or TODO)
- [ ] Event: begin_checkout tracked (or TODO)
- [ ] Event: whatsapp_order_click tracked (or TODO)
- [ ] Event: catering_inquiry_submit tracked (or TODO)
- [ ] Event: contact_submit tracked (or TODO)

---

## Pillar 10 — AEO

- [ ] Homepage answers: "What is Kahramana Baghdad?"
- [ ] Branches page answers: "Where are the branches?"
- [ ] Branches page answers: "Is Budayi branch open?" (must say Coming Soon)
- [ ] Homepage or menu answers: "How do I order?"
- [ ] Catering page answers: "Do you do catering?"
- [ ] About or homepage answers: "What type of food?"
- [ ] FAQPage schema present with safe questions
- [ ] No page claims delivery zones not confirmed
- [ ] No page claims opening hours not confirmed

---

## Pillar 11 — Legal / Trust

- [ ] /privacy-policy page exists
- [ ] /terms page exists
- [ ] /refund-policy page exists
- [ ] Footer links to all three legal pages
- [ ] Checkout page shows Privacy Policy link
- [ ] Contact page has business contact details
- [ ] Legal pages have noindex (or documented policy)

---

## Pillar 12 — Fix Safety (Pre-Fix Verification)

Before running FIX, confirm:
- [ ] Read src/constants/contact.ts — know the exact NAP data
- [ ] Read src/data/menu.json — know dish count and slugs
- [ ] Read current sitemap.ts — know current state
- [ ] Read current robots.ts — know current policy
- [ ] All planned fixes listed and shown to user
- [ ] No fix invents data not present in project files
- [ ] fix-guardrails.md consulted
