# Backlog — Kahramana

Items to handle before a known deadline. Move to PLAN.md when scheduled.

## Session 111 — Side findings + P3 pivot

- **Logo sizes prop**: `src/components/layout/Header.tsx:162` — logo `<Image>` lacks `sizes`; defaults to 100vw, fetches w=1080 on mobile. Add `sizes="(max-width: 768px) 160px, 200px"` → ~-35KB mobile.
- **Dashboard HTML cache leak**: `/dashboard` and other authenticated routes inherit `public, s-maxage=86400` from `next.config.ts` headers wildcard → stale-data / auth-bleed risk on shared CDN cache. Need `private, no-store` rule for `/dashboard/*`, `/account/*`, `/driver/*`, `/waiter/*`, `/api/*` BEFORE wildcard.
- **LCP ceiling root cause**: renderDelay 3.2s on `/ar` traced to `HeroAnimationsLoader` blocking first paint (GSAP + Framer chunk loads sync with hero). Bundle reduction alone won't fix it — must defer load via `requestIdleCallback` gate after dynamic import.
- **P3 pivot**: public-page JS (homepage hero + below-fold sections) is the LCP lever in Session 112, not dashboard bundle. Dashboard routes left untouched to avoid touching auth-gated code paths.

