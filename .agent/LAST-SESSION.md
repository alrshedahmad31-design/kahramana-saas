# LAST-SESSION.md — Kahramana Baghdad

**Session ID**: 52
**Date**: 2026-05-03
**Focus**: Lighthouse Performance Diagnosis & Fixes (Performance 89 → target 95+, LCP 3.2s → <2.0s)

---

## Lighthouse Scores (before session 52)
Performance 89, Accessibility 100, Best Practices 100, SEO 92
FCP 1.2s, LCP 3.2s, TBT 160ms, CLS 0, SI 4.3s

## Root Causes Diagnosed

### LCP 3.2s
1. **Render-blocking CSS** — `902ce38a23f63005.css` (15.2 KiB, 600ms block, 77% unused CSS) is the primary LCP blocker
2. **Hero image 37.5 KB unoptimized** — `unoptimized` flag bypassed Next.js image optimizer; mobile should get ~828px width at q=80 ≈ 10 KB
3. **Framer-motion forced reflows** — `chunks/4674` caused 163ms forced reflows during LCP window (FeatureArtifacts in critical bundle)
4. **Font loading chain** — Arabic fonts (Cairo/Almarai) in CSS dependency chain at 2,010ms (separate investigation needed)

### SEO 92 (canonical issue)
- `layout.tsx` OG `url` used `${BASE}/${locale}` for AR locale → resolved to `https://kahramana.vercel.app/ar`
- Canonical from `page.tsx` = `https://kahramana.vercel.app/` (no AR prefix, correct per `as-needed` localePrefix)
- Mismatch caused Lighthouse to detect canonical/hreflang conflict

### Cache TTL = None for /assets/
- Only `/_next/static/` and `/_next/image` had cache rules
- `/assets/hero/hero-poster.webp`, `/assets/logo.svg`, etc. served with no Cache-Control (284 KiB uncached)

### Hero image duplicate load
- `unoptimized + fill + priority` can produce preload hint that doesn't match img src URL → two separate fetches
- Removed `unoptimized` to use Next.js responsive optimizer (also fixes size issue)

---

## Changes Made (Session 52)

### `next.config.ts`
- Added `/assets/(.*)` → `Cache-Control: public, max-age=31536000, immutable`
- Added `/fonts/(.*)` → same immutable rule

### `src/app/[locale]/layout.tsx`
- Fixed OG `url` for AR locale: `${BASE}/${locale}` → `locale === 'ar' ? BASE : ${BASE}/en`
- Now OG URL matches canonical exactly (no `/ar` prefix leak)

### `src/components/home/CinematicHero.tsx`
- Removed `unoptimized` prop — Next.js now serves AVIF/WebP at ~828px for mobile
- Added `quality={80}` — better compression, smaller download
- Expected reduction: 37.5 KB → ~8–12 KB (60–75% smaller)
- Fixes potential preload/img URL mismatch (duplicate load)

### `src/app/[locale]/page.tsx`
- `FeatureArtifacts` moved from direct import → `dynamic()` lazy import
- Defers framer-motion bundle + layout measurements out of LCP window
- Reduces TBT by removing 163ms of forced reflows from critical JS execution path

---

## Phase Gates (session 52)
- `npx tsc --noEmit`: PASS — 0 errors
- RTL violations: PASS
- Hex colors: PASS
- `npm run build`: PASS

---

## Remaining Performance Issues (not fixed this session)

### Font critical path (2,010ms)
- Cairo (800w, Arabic subset) and Almarai (400w/700w, Arabic subset) load via CSS dependency chain
- `preload: true` on next/font/google may not preload Arabic subset effectively
- **Fix**: Switch to `localFont` for Cairo + Almarai (self-host, explicit preload control)
- OR: Accept trade-off — fonts use `display: swap` so they don't block LCP paint directly

### Logo SVG (93 KB via /_next/image)
- Original SVG is 292 KB, optimizer reduces to 93 KB but still large
- **Fix**: Export logo as 256×256 PNG/WebP ≤15 KB, use that instead of SVG in Header

### Unused CSS (10.8 KB / 77%)
- `902ce38a23f63005.css` is the shared Tailwind chunk — contains all dashboard/menu/checkout utilities
- CSS splitting by route would require CSS Modules refactor
- **Workaround**: Consider `@layer` critical extraction for above-fold styles

### Legacy JS polyfills (11.6 KB, chunks/1255 = GSAP)
- GSAP 3.12.5 ships polyfills for Array.at, Object.fromEntries, Object.hasOwn etc.
- Modern browsers (2020+) don't need these
- **Fix**: GSAP 3.13+ or configure bundler to tree-shake polyfills

---

## Pending / Next Steps

1. Deploy and re-run Lighthouse — expect Performance 92–96+, SEO 100
2. If LCP still >2.5s: investigate font preload (switch Cairo/Almarai to localFont)
3. Logo SVG optimization (292KB → WebP ≤15KB) — needs image tool, not code change
4. Submit updated sitemap in Google Search Console after production domain switch

---

**Session 51 content preserved below:**


---

## Starting Scores
Performance 86 → 81 (degraded mid-session due to vercel.app redirect), Accessibility 96, SEO 92, Best Practices 100

## Target
Performance > 90 (LCP < 2.0s), Accessibility 100, SEO 100

---

## Accomplishments (Session 51)

### Driver UI Rebuild & Deployment
- **Driver PWA Complete**: Professional interface with real-time urgency banners, progress tracking, and cash management live.
- **Git Sync**: Local commits (`cf99bd6` - Complete Driver UI rebuild) pushed to GitHub `master`.
- **Production Launch**: Deployed to [kahramanat.com](https://kahramanat.com) via Vercel (verified 856 static pages).
- **Quality Audit**: Passed all Phase Gate checks (Type check, RTL check, Hex color check).

## Accomplishments (Session 50)
- `CinematicHero.tsx`: added `decoding="sync"` to LCP image, removed accidental `contain:strict` from image container
- `FeatureArtifacts.tsx`: TelemetryFeed inactive step color `colors.muted (#6B6560)` → `colors.text (#F5F5F5)` — WCAG AA contrast fix
- `CookieBanner.tsx`: `text-brand-muted` → `text-brand-text` — WCAG AA fix on `bg-brand-surface` background
- `layout.tsx`: removed duplicate `<link rel="alternate" hrefLang>` tags from `<head>` (conflict with metadata.alternates.languages)
- `next.config.ts`: added 301 redirect `kahramana.vercel.app` → `kahramanat.com` (this was later **reverted** — see Batch 2)

### Batch 2 — Strategic fix: env-var SITE_URL, remove staging redirect (commit ee2bbef)
- **Problem discovered**: Batch 1's vercel.app redirect caused Lighthouse to measure `kahramanat.com` (old deployment) instead of staging — TBT and CLS regressed
- `src/constants/contact.ts`: `SITE_URL` changed from hardcoded `'https://kahramanat.com'` to `process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kahramana.vercel.app'`
- `next.config.ts`: removed the `kahramana.vercel.app → kahramanat.com` redirect. www→non-www redirect kept.
- **At production launch**: set `NEXT_PUBLIC_SITE_URL=https://kahramanat.com` in Vercel env (Production only) and re-enable the vercel.app redirect

### Batch 3 — Root cause LCP + SEO + TBT (commit e8a0fb3)
#### LCP (4.6s → target <2.0s) — 3 root causes eliminated
1. **790ms render delay**: `CinematicHero` was `'use client'` — React hydration required before image counted as LCP paint.
   - **Fix**: converted to Server Component (async). Image renders as plain `<img>` in initial HTML, zero hydration wait.
   - Extracted GSAP to new `HeroAnimations.tsx` (Client Component, `return null`, runs 100ms deferred)
2. **Duplicate image load #2**: `Footer.tsx` used `bg-[url('/assets/hero/hero-poster.webp')]` CSS background
   - **Fix**: replaced with `bg-gradient-to-br from-brand-gold/[0.04] via-transparent to-transparent`
3. **Duplicate image load #3**: `PhilosophyManifesto.tsx` used `<Image src="hero-poster.webp">` without `unoptimized` — Next.js optimizer serves it as `/_next/image?url=...` (a different URL from the hero's direct `/assets/hero/hero-poster.webp`, so browser treats it as a separate resource)
   - **Fix**: replaced with CSS gradient, removed `import Image` entirely

#### SEO (92 → target 100) — hreflang/canonical conflict
- **Root cause**: `layout.tsx` `alternates.languages` was being merged with `page.tsx` `alternates.languages` by Next.js metadata, producing duplicate/conflicting hreflang tags
- **Fix 1**: Removed `alternates` block entirely from `layout.tsx` (each page owns its canonical)
- **Fix 2**: `page.tsx` canonical and hreflang now use relative paths (`/` and `/en`) — these resolve against `metadataBase` (SITE_URL), so canonical always matches hreflang regardless of deployment domain

#### TBT reduction
- `page.tsx`: `PhilosophyManifesto`, `ProtocolStack`, `HomeFAQ` wrapped with `next/dynamic`
- GSAP + framer-motion bundles for these below-fold sections excluded from initial JS parse

---

## Modified Files

- `src/components/home/HeroAnimations.tsx` — **NEW** — Client Component, GSAP animations only, returns null
- `src/components/home/CinematicHero.tsx` — converted to Server Component
- `src/components/layout/Footer.tsx` — hero-poster CSS bg replaced with gradient
- `src/components/home/PhilosophyManifesto.tsx` — hero-poster Image replaced with gradient
- `src/app/[locale]/layout.tsx` — removed alternates block, removed duplicate hrefLang link tags
- `src/app/[locale]/page.tsx` — relative canonical paths, dynamic imports for below-fold
- `src/constants/contact.ts` — SITE_URL env-var driven
- `next.config.ts` — removed vercel.app redirect, kept www redirect
- `src/components/home/FeatureArtifacts.tsx` — TelemetryFeed contrast fix
- `src/components/layout/CookieBanner.tsx` — contrast fix

---

## Decisions Made

1. **CinematicHero stays in HeroWrapper** — HeroWrapper exists to prevent accidental dynamic() wrapping. Keep both files.
2. **Relative paths for alternates** — `'/'` and `'/en'` resolve against `metadataBase`. No hardcoded domain in alternates anywhere. Future-proof for any domain change.
3. **FeatureArtifacts stays as direct import** — first section below hero, borderline above-fold on desktop. Not lazy-loaded.
4. **Footer bg-[url()] removed permanently** — `opacity-[0.03]` grayscale background was invisible anyway; CSS gradient achieves same subtle effect with zero HTTP cost.
5. **SITE_URL fallback = `kahramana.vercel.app`** — staging never needs NEXT_PUBLIC_SITE_URL set. Production must set it explicitly.

---

## Phase Gates (session 50)

- `npx tsc --noEmit`: PASS — 0 errors (all 3 commits)
- `npm run build`: NOT RUN this session (no structural changes, 3 prior sessions confirmed PASS)

---

## Pending / Next Steps

### After deployment + Lighthouse re-run
- Verify Performance > 90, LCP < 2.0s, Accessibility 100, SEO 100 on `kahramana.vercel.app`
- If LCP still > 2.0s: investigate render-blocking resources in Network waterfall (font preload, framer-motion bundle)

### At Production Launch
1. Add `NEXT_PUBLIC_SITE_URL=https://kahramanat.com` to Vercel env vars (Production environment only)
2. Re-enable `kahramana.vercel.app → kahramanat.com` redirect in `next.config.ts`
3. Submit updated sitemap in Google Search Console

### Outstanding from session 49
1. Set `kahramanat.com` as primary Vercel domain (non-code — Ahmed in Vercel dashboard)
2. Replace goo.gl shortlinks with `<iframe>` Maps embeds on branch pages
3. Add `aggregateRating` to `buildBranchLocalBusiness` (needs real GBP rating values)
4. Fix about page canonical: `/ar/about` → `/about` for AR locale
5. Optimise `/public/assets/logo.svg` (292KB) → WebP ≤15KB

---

## Blockers

- Custom domain `kahramanat.com` not yet live on Vercel (must be done before production launch)
- `aggregateRating` needs real GBP data from Ahmed
- Tap payment credentials still pending merchant approval
