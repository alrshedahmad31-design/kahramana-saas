# LAST-SESSION.md — Kahramana Baghdad

**Session ID**: 55
**Date**: 2026-05-04
**Focus**: SEO priority fixes (7 issues) + Performance audit fixes + SEO/GEO re-audit fixes

---

## Summary

Three work streams completed and deployed (pushed to master, Vercel deploying).

---

## Stream 1 — SEO Priority Fixes (7 issues)

**Commit**: `d814332`

1. `src/app/page.tsx`: Removed `redirect('/ar')` — conflicted with next-intl as-needed routing. Now returns `notFound()`.
2. Contact canonical: `/${locale}/contact` → locale-aware (`/contact` for AR, `/en/contact` for EN).
3. Sitemap: Removed noindex pages `/privacy` and `/terms`. Kept `/refund-policy`.
4. Schema: Removed unconfirmed qallali aggregate rating; `foundingDate: '2018-08-01'` → `'2018'`; removed "across Bahrain delivery" and "private cabins" from description.
5. Menu `[slug]/generateStaticParams`: Removed `getItemSlugs()` — item slugs generated noindex redirect stubs.
6. Analytics (`src/lib/gtag.ts`): New utility with `view_item`, `add_to_cart`, `begin_checkout`, `whatsapp_click`, `generate_lead`. Wired into AddToCartButton, CheckoutForm, ContactForm, inquiry-form, item-detail-hero.
7. Footer: Added Contact and Refund Policy links to navigation column.

---

## Stream 2 — Performance Optimization

### First attempt (commit `2d51ba6`) — Mixed results
- ✓ GA4/Clarity: `afterInteractive` → `lazyOnload` → FCP 1.8s → 1.2s
- ✗ FeatureArtifacts dynamic import → TBT worsened 200→340ms (deferred chunk executed in TBT window)
- ✗ `decoding="async"` on hero image → LCP worsened 3.8→4.0s

### Correct fix (commit `012cc9f`) — Root cause addressed
- Reverted FeatureArtifacts to static import (fixes TBT regression)
- Reverted `decoding="sync"` on hero image (fixes LCP regression)
- **New**: `HeroAnimationsLoader.tsx` — thin 'use client' wrapper that dynamic-imports HeroAnimations with `ssr: false`. Removes GSAP (~30KB) from critical JS bundle.
- **New**: CSS `opacity: 0` in globals.css for `.hero-eyebrow`, `.hero-title-part-1`, `.hero-title-part-2`, `.hero-cta` + 3s CSS fallback animation. Replaces `gsap.set(opacity:0)` synchronous call.
- HeroAnimations: removed synchronous `gsap.set()`, added `prefers-reduced-motion` guard.

**Expected**: TBT ~130ms (was 340ms before, 200ms baseline), LCP ~3.8s, FCP 1.2s.

---

## Stream 3 — SEO/GEO Re-audit Fixes (commit `c4ea92f`)

**H2** (false alarm): gtag IS wired — 5 components import and use it.

**H3**: Privacy + Terms Arabic canonicals fixed:
- Before: `${SITE_URL}/${locale}/privacy` → produced `/ar/privacy`
- After: locale-aware → `/privacy` (AR) / `/en/privacy` (EN). Added `x-default`.

**H4**: Refund policy:
- Added `robots: { index: true, follow: true }` (aligns with sitemap inclusion)
- Added explicit canonical: `/refund-policy` (AR) / `/en/refund-policy` (EN)

**M1**: Menu `[slug]/generateMetadata` — removed unreachable item-slug noindex branch. Runtime redirect in page body kept as safety net.

**M2**: `public/llms.txt` cleaned:
- Removed "August" from founding date → "2018" only
- Removed "widely regarded as one of Bahrain's best" (unconfirmed superlative)
- Removed "private cabins" claim
- Changed "across Bahrain delivery" → "nearby areas — contact branch to confirm"

**M3**: `buildPlannedBranchSchema`: Downgraded type from `LocalBusiness` → `Thing`, removed address/locality. Non-open branch as LocalBusiness with address can mislead Maps/Knowledge Graph.

---

## Phase Gates (session 55)
- `npx tsc --noEmit`: PASS — 0 errors (src only)
- `npm run build`: PASS — 520 static pages, 0 errors
- RTL violations: PASS (spot checked changed files)
- Hardcoded phones/wa.me: PASS
- `git push origin master`: PASS — Vercel deploy triggered

---

## Remaining / Pending

1. **C1 (production drift)**: Pushed. Verify live site after Vercel deploy completes.
2. **L1**: Verify `https://kahramanat.com/sitemap.xml` reflects 386 expected URLs after deploy.
3. **L2**: Verify live `/`, `/ar`, `/en` routing behavior after deploy.
4. **M4**: Trailing slash on `/en/menu` — investigate Vercel redirect config after deploy.
5. **H1**: Schema Riffa rating (4.5/1531) and Talabat URL remain — these are confirmed facts, leaving as-is unless owner requests removal. `priceRange: '$$'` also remains.
6. **Performance**: Run Lighthouse again after deploy to confirm TBT improvement from GSAP lazy-load.

---

## Key Decisions

1. Kept `getMenuItemBySlug` + runtime redirect in `menu/[slug]/page.tsx` as safety net for direct URL access even though `generateStaticParams` no longer generates item slugs.
2. `buildPlannedBranchSchema` → `Thing` type (not `LocalBusiness`) to prevent Maps confusion for non-open location.
3. FeatureArtifacts MUST stay static import — dynamic import pushes its chunk execution into TBT window, worsening TBT. framer-motion is already in the bundle via Footer anyway.
4. `lazyOnload` for GA4/Clarity is correct and kept — significantly helped FCP.
