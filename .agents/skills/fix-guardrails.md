# Fix Guardrails — Kahramana Baghdad SEO Agent
# Read this file BEFORE writing any code in FIX mode.

---

## ABSOLUTE PROHIBITIONS — Never Do These

### Data Integrity
- NEVER invent branch address (not confirmed in codebase)
- NEVER invent openingHours or opening times
- NEVER invent geo coordinates (latitude/longitude)
- NEVER invent aggregateRating or ratingValue
- NEVER invent reviews or reviewCount
- NEVER invent sameAs URLs unless social links confirmed
- NEVER invent delivery zones or service areas
- NEVER add online payment claims (Phase 6 not started)
- NEVER invent nutrition data
- NEVER invent founding year
- NEVER invent awards or certifications
- NEVER change dish prices — from data layer only
- NEVER change dish names — from data layer only
- NEVER change WhatsApp/phone numbers — from constants only

### Architecture
- NEVER delete any route or page
- NEVER add new pages without explicit approval
- NEVER change dashboard, KDS, or RBAC logic
- NEVER change RLS or auth policies
- NEVER change checkout flow
- NEVER change database schema
- NEVER rename existing routes
- NEVER change i18n routing structure

### Content
- NEVER change legal page content (privacy, terms, refund)
- NEVER remove existing metadata that is correct
- NEVER add noindex to public marketing pages
- NEVER remove noindex from protected pages (dashboard, login, checkout, driver)

---

## SAFE FIXES — Allowed Without Confirmation

### Metadata
- Add missing <title> from page name + confirmed data
- Add missing <meta description> from confirmed data
- Fix incorrect lang/dir attributes
- Add missing canonical tag
- Fix incorrect canonical URL
- Add missing hreflang alternate links
- Add missing Open Graph tags from existing data

### Structured Data
- Add BreadcrumbList from route structure (no external data needed)
- Add Restaurant schema using confirmed phone numbers only
- Add MenuItem schema from menu.json data
- Add FAQPage schema from SAFE_FAQS list in schema-templates.md

### Sitemap
- Add missing dish pages to sitemap.ts
- Add missing category pages to sitemap.ts
- Fix priority values
- Fix changefreq values
- Remove protected routes from sitemap

### Robots
- Fix robots.ts to correctly block: /dashboard, /login, /checkout, /order, /driver, /api
- Ensure robots.ts allows all public marketing pages
- Add Sitemap: directive to robots.ts output

### Images
- Add alt text from dish.nameAr / dish.nameEn — never invented
- Add explicit width/height where missing and values are known
- Add sizes prop to next/image components
- Remove priority={true} from non-hero images
- Add loading="lazy" to below-fold images

### Internal Linking
- Add breadcrumb component to category and dish pages
- Add "related dishes" section from same category data
- Add branch CTA links to menu pages
- Fix footer links to legal pages if missing
- Add missing nav links

### Analytics
- Add TODO comments for missing GA4 events — never add fake tracking
- Add data-track attributes as TODO markers

---

## REQUIRES CLIENT CONFIRMATION — Ask First

- Adding sameAs social media URLs (need to verify official accounts)
- Adding priceRange to schema (confirm with restaurant)
- Adding hasMap with Google Maps URL (need confirmed URL)
- Adding image URLs to branch schema (need confirmed photos)
- Setting legal pages as index or noindex (depends on strategy decision)
- Adding opening hours in any form (restaurant must confirm in writing)
- Adding delivery zones (restaurant must confirm coverage)
- Adding catering service area (restaurant must confirm)

---

## FIX Output Format

Every FIX operation must output:

```md
## Fix Applied: [Fix ID]
**Pillar**: [1-12]
**File**: `path/to/file.tsx`
**Reason**: [Why this was broken]
**Change**: [What was changed]

### Before
```[language]
[old code]
```

### After
```[language]
[new code]
```

**Tests run**: tsc --noEmit [PASS/FAIL], build [PASS/FAIL]
**Page count**: [before] → [after] (must not decrease)
```

---

## Phase Gate — Run After ALL Fixes Complete

```bash
# 1. TypeScript check
npx tsc --noEmit
# Expected: 0 errors

# 2. Production build
npm run build
# Expected: PASS, page count ≥ previous count (391+)

# 3. Verify no protected routes in sitemap
# Check: /dashboard, /login, /checkout, /driver not in sitemap output

# 4. Verify all public routes in sitemap
# Check: /menu, /menu/[slug], /branches, /about, /catering, /contact present
```

All gates must PASS before declaring FIX complete.
