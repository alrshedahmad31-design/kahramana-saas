# Backlog — Kahramana

Items to handle before a known deadline. Move to PLAN.md when scheduled.

## Due 2026-06-02 — GitHub Actions Node.js 24 forced upgrade

Bump every `actions/*` reference in `.github/workflows/` from `@v4` → `@v5`
(or whichever line supports Node.js 24). Currently flagged by GitHub:

> "Actions will be forced to run with Node.js 24 by default starting
> June 2nd, 2026. Node.js 20 will be removed from the runner on
> September 16th, 2026."

Files touched today still on v4:
- `.github/workflows/e2e.yml` — `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`
- `.github/workflows/playwright.yml` — likely same

Quick check before bumping: `actions/setup-node@v5` requires Node 20+ in
the `node-version:` field (we're already on Node 20). No breaking inputs
expected. Verify the `cache: npm` key still works post-bump.

Risk: low. Reversible by reverting the workflow files.

## Session 111 — Side findings + P3 pivot

- **Logo sizes prop**: `src/components/layout/Header.tsx:162` — logo `<Image>` lacks `sizes`; defaults to 100vw, fetches w=1080 on mobile. Add `sizes="(max-width: 768px) 160px, 200px"` → ~-35KB mobile.
- **Dashboard HTML cache leak**: `/dashboard` and other authenticated routes inherit `public, s-maxage=86400` from `next.config.ts` headers wildcard → stale-data / auth-bleed risk on shared CDN cache. Need `private, no-store` rule for `/dashboard/*`, `/account/*`, `/driver/*`, `/waiter/*`, `/api/*` BEFORE wildcard.
- **LCP ceiling root cause**: renderDelay 3.2s on `/ar` traced to `HeroAnimationsLoader` blocking first paint (GSAP + Framer chunk loads sync with hero). Bundle reduction alone won't fix it — must defer load via `requestIdleCallback` gate after dynamic import.
- **P3 pivot**: public-page JS (homepage hero + below-fold sections) is the LCP lever in Session 112, not dashboard bundle. Dashboard routes left untouched to avoid touching auth-gated code paths.

## Session 144 — Public-surface audit deferred items

Two P2 findings from `.agent/public-audit-2026-05-18.md` deferred from
the T3-B hygiene pass (commit `a572bdb`). Both are hygiene-tier, not
exploitable.

### PUB-007 — RPC error sentinel matching via substring

- **File**: `src/app/[locale]/reserve/actions.ts:210-216`
- **Pattern today**: `if (message.includes('RESERVATION_CONFLICT'))` etc.
  — JS layer detects sentinel by substring of `error.message`.
- **Risk**: Works today because the RPC raises a fixed sentinel, but a
  future RPC refactor that wraps the error context will silently degrade
  to the generic `server_error` branch. The checkout-side equivalent
  (`checkout/actions.ts:723-735`) has the same pattern but is paired
  with code checks too.
- **Suggested fix**: Have the RPC `RAISE` with a SQLSTATE code
  (`P0001` + a structured `MESSAGE`) and switch the JS to a code-based
  match.
- **Why deferred**: Needs a Supabase migration to alter the RPC body.
  Per the T3 ground rules ("no migrations unless strictly required") it
  stays open for a future session. Group with PUB-009 in the next
  hygiene lane.

### PUB-009 — `as unknown as OrderWithItems` cast hides Supabase type drift

- **File**: `src/app/[locale]/order/[id]/page.tsx:65` (now ~70 after
  force-dynamic addition in commit `67f9f59`)
- **Pattern today**: `order = data as unknown as OrderWithItems` after
  an explicit-column `.select(...)`.
- **Risk**: The select column list is hand-written; if those columns
  drift from `OrderWithItems`, TypeScript won't catch it. Not
  exploitable, just a refactor hazard.
- **Suggested fix**: Define a narrow row type literally enumerating the
  selected columns (or migrate to a typed helper using
  `.returns<NarrowOrder[]>()`) so the cast becomes a structural assert,
  not a blind one.
- **Why deferred**: ~15-line type definition for hygiene-only payoff,
  and the page is currently the cleanest gold-standard customer route
  (T1-5 column allowlist + force-dynamic both pinned). Pair with PUB-007.
