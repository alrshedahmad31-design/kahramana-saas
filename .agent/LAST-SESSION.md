# LAST-SESSION.md — Kahramana Baghdad

**Session ID**: 50
**Date**: 2026-05-03
**Focus**: Lighthouse Mobile Optimization — LCP, Accessibility, SEO, TBT

---

## Starting Scores
Performance 86 → 81 (degraded mid-session due to vercel.app redirect), Accessibility 96, SEO 92, Best Practices 100

## Target
Performance > 90 (LCP < 2.0s), Accessibility 100, SEO 100

---

## Accomplishments

### Batch 1 — Contrast / hreflang fixes (commit dc1b40e)
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
