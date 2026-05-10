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

### BL-002 — Provision Cloudflare Turnstile env vars in Vercel

- **Type:** ops task (no code change)
- **Severity:** med (Turnstile is dormant until both vars exist; honeypot still active as fallback)
- **Effort:** S (≈ 10 min across two dashboards)
- **Origin:** session 87 audit Fix 5 (`8d46326` — Turnstile shipped behind a soft-launch guard)

**Why this exists.** Fix 5 added `@marsidev/react-turnstile` + server-side
`siteverify` integration in `/contact`, but did NOT (and could not) provision
the Cloudflare account or the Vercel env vars. The server action treats a
missing `TURNSTILE_SECRET_KEY` as "fall back to honeypot only" so the form
keeps working — but the Turnstile widget never renders client-side either,
because `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is also unset. The CAPTCHA defense
is effectively inert until both vars land.

**Steps.**

1. **Cloudflare side** — https://dash.cloudflare.com → Turnstile → "Add site":
   - Site name: `kahramanat.com`
   - Hostnames: `kahramanat.com`, `www.kahramanat.com`, plus the Vercel
     preview wildcard if you want CAPTCHA on previews too
   - Widget mode: **Managed** (lowest friction; Cloudflare picks the
     challenge type automatically)
   - Save → copy the **Site Key** (public) and **Secret Key** (private)

2. **Vercel side** — Project → Settings → Environment Variables → "Add New":

   | Key | Value | Scope | Sensitive? |
   |---|---|---|---|
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key from step 1 | Production + Preview | no (it's public — embedded in client bundle) |
   | `TURNSTILE_SECRET_KEY`           | secret key from step 1 | Production + Preview | **yes** — toggle Sensitive on |

   Do NOT add to Development scope unless you also want Turnstile firing
   during local `npm run dev`. The widget rendering can interfere with
   automated test scripts.

3. **Trigger redeploy** so the new env vars take effect (any commit will do,
   or use Vercel UI → Deployments → "..." → Redeploy).

4. **CSP already allows Turnstile** — verified in session 87:
   `script-src` includes `https://challenges.cloudflare.com` and
   `frame-src` allows the same origin for the challenge iframe. No middleware
   change needed when env vars land.

**Verification when done.**

- Visit `https://kahramanat.com/contact` → Turnstile widget renders below
  the message field (not blank).
- Submit without completing the widget → red error "يرجى إكمال التحقق…" /
  "Please complete the human verification…" appears.
- Complete the widget + submit → success.
- Tail Sentry server logs for any `siteverify` 4xx/5xx → if seen, secret
  key may be wrong scope (Production vs Preview).

**Rollback if needed.**

Remove both env vars from Vercel → next deploy → Turnstile goes dormant
again, honeypot remains active. No code change needed.

---

## Change log

| Date | Author | Change |
|---|---|---|
| 2026-05-10 | Claude Code session 86 | File created; BL-001 added (loyalty helpers split) |
| 2026-05-10 | Claude Code session 87 | BL-002 added (Turnstile env-var provisioning in Cloudflare + Vercel) |
