# Post-Launch Backlog — Kahramana Baghdad

> Items deferred until **after** initial production launch.
> Source: per `docs/qa/pre-launch-checklist.md` §7 ("`-` fails → log for post-launch backlog").
> Created: 2026-05-10 (session 86).

---

## Conventions

| Field | Meaning |
|---|---|
| ID | Stable reference (use in commits, e.g. `BL-001`) |
| Severity | `low` / `med` / `high` — risk if left unfixed long-term |
| Effort | `S` (≤ 1h) / `M` (1–4h) / `L` (> 4h) |
| Origin | Where the item was discovered (session, audit, gate, incident) |

---

## Items

### BL-001 — Split loyalty pure helpers from server-only fetcher

- **File:** `src/lib/loyalty/config.ts`
- **Severity:** low
- **Effort:** S
- **Origin:** session 86 phase-completion gate 8 (service-role-key bundle scan)

**Problem.** `src/lib/loyalty/config.ts` co-locates two unrelated concerns:
1. Server-only DB fetcher: `fetchLoyaltyConfig`, `getLoyaltyConfig` (uses
   `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`, wrapped in
   `unstable_cache`).
2. Pure helpers explicitly marked "server or client":
   `pointsToCredit`, `bhdToPointsFromCfg`, `calcPointsEarnedFromCfg`,
   `maxRedeemablePointsFromCfg`, plus `DEFAULT_LOYALTY_CONFIG` and the
   `LoyaltyConfig` type.

When a client component imports any pure helper, the bundler drags the entire
module — including `@supabase/supabase-js` and the literal string
`process.env.SUPABASE_SERVICE_ROLE_KEY` — into the client bundle. Confirmed in
session 86: `.next/static/chunks/app/[locale]/dashboard/settings/page-*.js`
contains the env reference.

**Risk.** **No secret leak** — Next.js does not inline non-`NEXT_PUBLIC_*` env
vars on the client, so `process.env.SUPABASE_SERVICE_ROLE_KEY` evaluates to
`undefined` in the browser and the early-return in `fetchLoyaltyConfig` (line 51)
trips. Pure bundle-bloat smell, not a security issue.

**Fix.** Extract pure helpers into `src/lib/loyalty/helpers.ts`:

```
src/lib/loyalty/
├── config.ts    # server-only — fetchLoyaltyConfig, getLoyaltyConfig
└── helpers.ts   # server+client — types, defaults, pure math helpers
```

Then update every importer of the helpers to point at the new file. Verify by
re-running gate 8 (`Get-ChildItem .next/static -Recurse -Include *.js |
Select-String SUPABASE_SERVICE_ROLE_KEY`) — should return zero hits.

**Acceptance.**
- Client `.next/static/**/*.js` has zero `SUPABASE_SERVICE_ROLE_KEY` references.
- `npx tsc --noEmit` clean.
- `npm run build` clean.
- All 9 phase-completion gates still pass.

---

## Change log

| Date | Author | Change |
|---|---|---|
| 2026-05-10 | Claude Code session 86 | File created; BL-001 added (loyalty helpers split) |
