# LAST-SESSION.md — Kahramana Baghdad

**Session ID**: 57
**Date**: 2026-05-04
**Focus**: LCP + CLS root cause diagnosis and fixes (commit `902f213`)

---

## Summary

Diagnosed 2 independent root causes for LCP=4.1s and 1 for CLS=0.151. All 3 fixed in one commit.

---

## Root Causes Discovered

### LCP = 4.1s

#### Cause A: Hero preload arrives late in SSR stream
`<link rel="preload">` was inside `CinematicHero` (async Server Component). In Next.js 15 streaming SSR, async components resolve after the initial `<head>` bytes are sent. The preload hint arrived late in the stream — AFTER the browser's preload scanner already finished its pass. Image was discovered only via body HTML parsing (~1s later).

**Fix**: Moved preload to `HeroWrapper` (synchronous Server Component). Sync components are processed before async work begins → preload is guaranteed to be in the initial `<head>` bytes.

#### Cause B: Font swap pushing LCP timestamp
Next.js 15.5.15 does not generate `<link rel="preload" as="font">` tags in the HTML for fonts declared in layouts (only in page-level components). Fonts were discovered late (via CSS parsing), loaded at ~2-3s, and when they swapped, Chrome re-recorded LCP at the swap timestamp.

For editorialNew specifically: no `adjustFontFallback` was generated (CSS had no `size-adjust`/`ascent-override`). Cairo, Almarai, Satoshi all had it — only editorialNew was missing it. Font swap on large EN hero title (h1 at text-7xl) → Chrome re-recorded LCP at ~4s.

**Fix**: Added `adjustFontFallback: "Times New Roman"` to editorialNew. Generates fallback @font-face with `size-adjust:97.60%`, `ascent-override:90.16%`, `line-gap-override:10.25%`. Text block dimensions now stay identical through the swap → Chrome doesn't re-record LCP.

### CLS = 0.151

**Cause**: Same as LCP Cause B — editorialNew lacked size-adjust CSS for its fallback. Large h1 text on EN pages swapped dimensions when font loaded → layout shift.

**Fix**: Same — `adjustFontFallback: "Times New Roman"` now generates the correct CSS.

---

## Secondary Fix

- Changed `decoding="sync"` → `decoding="async"` on hero `<img>`. `decoding="sync"` forces main-thread decode and can block compositing under Lighthouse 4× CPU throttle. `async` allows background thread decode while main thread runs hydration/GSAP.

- Reordered editorialNew src: Bold (700) first → Bold is now the preloaded `.p.woff2` variant (hero title on EN uses `font-bold`).

---

## Commits This Session

| Commit | Change |
|--------|--------|
| `902f213` | preload timing fix + editorialNew adjustFontFallback + decoding async |

---

## Current State (after session 57)

**HeroWrapper.tsx**:
- Has `<link rel="preload" as="image" href="/assets/hero/hero-poster.webp" fetchPriority="high" />` in sync Server Component

**CinematicHero.tsx**:
- Preload link removed (moved to HeroWrapper)
- `decoding="async"` on hero img

**layout.tsx** (editorialNew):
- `adjustFontFallback: 'Times New Roman'` ← new
- Bold first in src array ← new

**CSS verification (d8ab2e66c56022d1.css)**:
```
editorialNew Fallback: src:local("Times New Roman"); size-adjust:97.60%; ascent-override:90.16%; descent-override:30.74%; line-gap-override:10.25%
```

---

## Expected Metrics After Deploy

- **LCP**: ~1.2–1.8s (FCP≈LCP if image preload works correctly)
- **CLS**: ~0.05–0.08 (size-adjust eliminates editorialNew swap CLS; Cairo/Satoshi already had it)
- **Performance score**: 90+

---

## Remaining / Pending

1. **Run Lighthouse after Vercel deploy** to confirm improvements
2. **Hero image replacement** (HIGH PRIORITY from session 56): `hero-poster.webp` is 800×420px — too small for a full-screen hero. Replace with 1920×1080 WebP.
3. **Font preloads missing from HTML** (MEDIUM): Next.js 15.5.15 does not auto-generate `<link rel="preload" as="font">` for layout-level fonts. All fonts are discovered via CSS. If LCP is still driven by font swap after this session's fixes, consider adding explicit preload hints to layout `<head>` (but requires hardcoding hashed filenames).
4. **Previous session L1/L2/M4**: sitemap, routing, trailing slash — still pending verification.

---

## Key Decisions

1. **adjustFontFallback: "Times New Roman"** for editorialNew — serif system font gives the closest metric profile for an editorial serif font.
2. **Preload in sync wrapper, not layout** — avoids preloading hero image on all pages (branches, menu, about, etc.).
3. **decoding="async" not "sync"** — sync was added in session 56 as a performance hint but actually hurts on throttled CPUs by blocking the main thread.
