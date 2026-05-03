# LAST-SESSION.md — Kahramana Baghdad

**Session ID**: 53
**Date**: 2026-05-03
**Focus**: Full SEO Audit Fix — all issues from 10-agent parallel audit + Google Rich Results validation

---

## Summary

Two-part session. Part 1: complete fixes from the full `/seo audit` report. Part 2: applied real data Ahmed provided from Google Maps + Rich Results Test.

---

## Part 1 — Audit Report Fixes

### Priority 1 — Critical / NAP Consistency

**`src/app/[locale]/layout.tsx`** — Fixed "Qalali" → "Qallali" spelling in 3 places

**`messages/ar.json`**:
- `home.hero.branches`: "تواصل معنا" → "فروعنا"
- `home.features.telemetry.eyebrow`: "حالة النظام" → "معيار مطبخنا"
- `home.features.telemetry.title`: "البث المباشر للجودة" → "فحص الجودة المباشر"
- Telemetry steps → plain kitchen language
- `home.features.proximity.link`: "احجز طاولتك" → "تعرف على فروعنا"

**`messages/en.json`**:
- `home.hero.branches`: "Contact Us" → "Our Branches"
- Telemetry steps → plain kitchen language
- `home.features.proximity.link`: "Book Your Table" → "View Our Branches"

### Priority 2 — Canonical / hreflang Fixes

All 4 inner pages fixed (removed `headers()`/nonce from JSON-LD, fixed `/ar/` prefix bug in canonical, updated hreflang to `ar-BH`/`en-BH`):
- `src/app/[locale]/about/page.tsx`
- `src/app/[locale]/branches/[branchId]/page.tsx`
- `src/app/[locale]/branches/page.tsx`
- `src/app/[locale]/catering/page.tsx`

### Priority 3 — Schema & Structured Data

**`src/lib/seo/schemas.ts`**:
- Added branch image + description to `buildBranchLocalBusiness` (from `BRANCH_EXTENDED_DATA`)
- Expanded `buildOrganizationSchema` description to 100+ word citable block

**`src/components/schema/RestaurantSchema.tsx`**:
- Removed hardcoded fallback phone → uses `riffa?.phone` directly
- `wa.me/` URL → `buildWaLinkForPhone(riffa.phone)` (no hardcoded URLs in components)
- Fixed branch URLs: `/ar/branches/` → `/branches/` (correct as-needed routing)

### Priority 4 — GEO / AI Crawlability

**`src/components/home/HomeFAQ.tsx`** — CONVERTED client component → server component:
- Removed `'use client'`, `useState`, `AnimatePresence`
- All 7 FAQ answers now SSR-rendered in initial HTML (visible to AI crawlers)
- Uses `<details>/<summary>` with CSS `group-open:rotate-180` chevron

**`public/llms.txt`** — Expanded ~200 → ~900 words with bilingual FAQ, dish descriptions, RSL 1.0

### Priority 5 — SXO

**`src/components/home/FeatureArtifacts.tsx`**:
- Artifact 3 CTA: `BRANCHES.riffa.waLink` → `isRTL ? '/branches' : '/en/branches'`
- Removed unused `BRANCHES` import

---

## Part 2 — Google Data Applied

Ahmed provided: Riffa Maps embed, review counts, Rich Results Test errors, Talabat URL.

### Changes

**`src/constants/contact.ts`** — Riffa coordinates fixed:
- `latitude: 26.1366914 → 26.1358149` (matches Maps embed)
- `longitude: 50.5593132 → 50.5748089` (matches Maps embed)

**`src/lib/seo/schemas.ts`**:
- `BRANCH_RATINGS.riffa.reviewCount`: `'1519'` → `'1531'`
- Organization description: 1,519 → 1,531 (both AR and EN)
- `buildOrganizationSchema.sameAs`: added Talabat URL
- `buildMenuBreadcrumb`: added `'@id': SITE${prefix}/menu#breadcrumb` — fixes **critical** Rich Results error (BreadcrumbList was referenced by `buildMenuWebPageSchema` but had no `@id` for Google to match them)
- `buildMenuWebPageSchema`: fixed remaining `/${locale === 'en' ? 'en/' : ''}` pattern → `${prefix}` variable

**`src/app/[locale]/menu/page.tsx`**:
- Removed `headers()` + nonce from JSON-LD scripts
- Fixed canonical: `/ar/menu` → `/menu` for AR
- Fixed hreflang: `ar`/`en` → `ar-BH`/`en-BH`

**`src/components/home/CinematicHero.tsx`** — trust signal: 1,519 → 1,531

**`public/llms.txt`** — review count: 1,519 → 1,531 (3 instances)

---

## Phase Gates (session 53)
- `npx tsc --noEmit`: PASS — 0 errors
- RTL violations: PASS
- Hardcoded phones/wa.me: PASS
- `npm run build`: PASS — 856 static pages, 0 errors

---

## Remaining Items (External / Needs Ahmed)

1. **Postal codes** — `postalCode` in branch address schema is optional but flagged. Bahrain doesn't use standard postal codes, so this can be ignored unless Ahmed has specific codes.
2. **Talabat listings** — URL confirmed and added to schema. Off-site profile still needs to be created/claimed.
3. **Qallali GBP coordinates** — `latitude: 26.269074, longitude: 50.6433552` in contact.ts doesn't match mapsUrl (`26.27678350000001, 50.657156999999984`). Ahmed should confirm.
4. **YouTube channel URL** — If channel exists, add to `GENERAL_CONTACT` in contact.ts.

---

## Decisions Made

1. **Breadcrumb `@id` pattern**: `buildMenuBreadcrumb` now spreads over `buildBreadcrumb` output and adds `@id` — matches the reference in `buildMenuWebPageSchema`. This is the correct JSON-LD `@id` linking pattern.
2. **Riffa coordinates**: Embed iframe is authoritative. `latitude`/`longitude` fields now match `mapsUrl` and `embedSrc`.
3. **Review count source**: Google Business Profile is the source of truth — updated from 1,519 to 1,531.

---

## Next Steps

1. Deploy to Vercel and re-run Google Rich Results Test — breadcrumb error should be gone
2. Re-run Lighthouse — SEO score should improve from 92+ to 100
3. Confirm Qallali coordinates in contact.ts
4. Consider `DeliveryStrip` + `BranchQuickAccess` homepage components (from audit recommendation, not yet implemented)
