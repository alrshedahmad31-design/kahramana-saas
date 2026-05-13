# LAST-SESSION.md — Kahramana Baghdad
> Session 94: security audit batch close-out (F-02/F-05/F-06/F-07),
> Sentry P2 hardening + webpack-plugin release alignment, CSP dedupe,
> BL-001 closure, phase-state audit
> Date: 2026-05-13
> Author: Claude Code (sole contributor this session; sibling Gemini
>         agent inactive — working tree clean at start)

## SUMMARY
Focused security/Sentry hardening session. 8 commits pushed
(`a867977` → `7f6c1f8`). Three threads:

1. **Security audit close-out** — F-02 (Sentry org_id leak via HTML
   baggage), F-05 (PDPL elements on /privacy-policy), F-06 (Sentry
   release name = full SHA), F-07 (/privacy → /privacy-policy in
   CheckoutForm). F-08 (route structure in Sentry transactions)
   re-classified verified-low after audit — no change.
2. **Sentry P2 fully closed** — DSN inlined → `process.env.NEXT_
   PUBLIC_SENTRY_DSN` across all 3 init files; `sendDefaultPii`
   normalized to `false` on client + edge (was `true`, contradicting
   server); edge `tracesSampleRate` 1 → 0.1; webpack plugin
   `release.name` bound to the same `kahramana-{ref}-{short-sha}`
   string emitted at runtime.
3. **CSP deduplication** — removed the static `Content-Security-
   Policy` block from `vercel.json`. Middleware nonce-based CSP is
   now the sole source.

Also: backlog item BL-001 (loyalty/config split) closed —
verification showed the split was already shipped with a stronger
layout (`import 'server-only'` instead of filename convention).
Migrations 114 + 115 backfilled into `phase-state.json` applied list
(they existed on disk but had drifted from the registry).

## COMMITS THIS SESSION (in order)
- `a867977` fix(security): limit Sentry trace propagation — hide
  org_id from HTML (F-02)
- `724f115` fix(footer): /privacy → /privacy-policy (F-07)
- `ef9fe86` fix(legal): PDPL compliance — add data controller, legal
  basis, review date (F-05)
- `a5f13a5` fix(security): sanitize Sentry release name — short SHA
  only (F-06)
- `a3bfba8` fix(sentry): align webpack plugin release name + P2
  config fixes
- `4707f7f` fix(security): remove duplicate CSP from vercel.json —
  middleware nonce-based CSP is sole source
- `785bc90` chore: session 94 audit — phase-state + backlog + F-08
  note
- `7f6c1f8` chore(docs): update master notes — session 94

## SECURITY AUDIT STATUS (post-session)

| ID  | Sev    | Status                              | Commit    |
|---  |---     |---                                  |---        |
| F-01| HIGH   | ⏳ Awaiting Ahmed Incognito verify  | —         |
| F-02| HIGH   | ✅ Fixed                            | `a867977` |
| F-03| HIGH   | ✅ Confirmed (CSP in response)      | (pre-94)  |
| F-04| MED    | ✅ Present (NODE_ENV gated)         | (pre-94)  |
| F-05| MED    | ✅ Fixed                            | `ef9fe86` |
| F-06| MED    | ✅ Fixed                            | `a5f13a5` |
| F-07| LOW    | ✅ Fixed                            | `724f115` |
| F-08| LOW    | ✅ Verified-low (no change)         | `785bc90` |

**F-08 rationale.** The original HTML-baggage leak that motivated the
finding was already closed by `autoInstrumentAppDirectory: false` +
`tracePropagationTargets: [/^\/api\//]` (F-02). Remaining client
router transactions only ship to Sentry's own ingest, and route
names are already public in `_buildManifest.js`. Sanitizing further
would collapse dashboard transactions into a single bucket and
destroy debugging utility. One-line note added in `next.config.ts`
next to `autoInstrumentAppDirectory: false`.

## SENTRY P2 — CHANGES ACROSS 4 FILES

`next.config.ts`
- Added module-level `sentryRelease` constant computed from
  `VERCEL_GIT_COMMIT_REF` + 7-char `VERCEL_GIT_COMMIT_SHA`.
- Passed `release: { name: sentryRelease }` into `withSentryConfig`
  so sourcemap upload binds to the same release ID used at runtime.
- F-08 verified-low comment added at
  `autoInstrumentAppDirectory: false`.

`src/instrumentation-client.ts`
- `dsn:` hardcoded → `process.env.NEXT_PUBLIC_SENTRY_DSN`.
- `release:` added (same expression, runtime branch).
- `sendDefaultPii: true → false` (aligns with server).
- `tracePropagationTargets: [/^\/api\//]` (F-02, also in this batch).

`sentry.server.config.ts`
- `dsn:` hardcoded → `process.env.NEXT_PUBLIC_SENTRY_DSN`.
- `release:` added.

`sentry.edge.config.ts`
- `dsn:` hardcoded → `process.env.NEXT_PUBLIC_SENTRY_DSN`.
- `release:` added.
- `tracesSampleRate: 1 → 0.1` (was burning quota).
- `sendDefaultPii: true → false`.

**Critical**: `NEXT_PUBLIC_SENTRY_DSN` MUST be set in Vercel for
Preview + Production. Missing DSN = silent SDK no-op. Was previously
safe because DSN was inlined — that fallback is gone.

## CSP DEDUPLICATION — `4707f7f`

Removed the `Content-Security-Policy` line from `vercel.json` while
keeping the other static security headers (`X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).

**Why**: the static `vercel.json` CSP was missing key origins the
runtime needs (`challenges.cloudflare.com` for Turnstile, Sentry
ingest, Speed Insights, Unsplash, OpenStreetMap tiles, `worker-src`,
nonce + `'strict-dynamic'`). Middleware's nonce-based CSP in
`buildCsp()` was already overriding it on every middleware-matched
response, so the static entry was dead weight that broke any
static-asset path the middleware excluded.

**Trade-off accepted**: paths excluded from the middleware matcher
(`_next/static`, `_next/image`, `/auth/*`, asset files by extension)
now serve **no CSP**. Standard pattern — those responses don't
execute scripts. No defense-in-depth fallback added.

## BL-001 — CLOSED (no code change this session)

`src/lib/loyalty/config.ts` split was already shipped pre-session-94
with a layout better than the backlog proposal:

```
src/lib/loyalty/
├── config.ts          # 2-line barrel — re-exports types + config.server
├── config.server.ts   # `import 'server-only'` — fetchLoyaltyConfig
├── calculations.ts    # pure math helpers
└── types.ts           # LoyaltyConfig + DEFAULT_LOYALTY_CONFIG
```

The `import 'server-only'` directive is a Next.js build-time guard —
client components importing `config.server.ts` get a compile error,
which is stronger than the originally-proposed `helpers.ts` filename
convention. Closure documented in `docs/qa/post-launch-backlog.md`.

## PHASE-STATE AUDIT (`785bc90`)

- `last_updated` refreshed: session 94 summary.
- `last_git_commit` advanced to `a3bfba8` with session 94 commit
  series.
- `migration_status` corrected: "090-113" → "090-122".
- **Backfilled**: `114_reservations.sql` (2026-05-12) and
  `115_delivery_proof.sql` (2026-05-12) into `applied_db_migrations`
  — they existed on disk but were missing from the registry.

## OPEN ISSUES (carry to next session)

### Sentry sourcemap pipeline — verification still pending
Build logs for `a3bfba8` + `4707f7f` not yet inspected. Scan for:
- ✅ `Successfully uploaded N files` from `@sentry/webpack-plugin`
  with release matching `kahramana-master-{short-sha}`.
- ❌ Any `could not auto-detect referenced sourcemap` lines on
  `.next/server/**` or `.next/static/**`.
- ❌ `no auth token` / `missing token` / `skipping` from the plugin.

### Vercel env vars — verify before next deploy
- `NEXT_PUBLIC_SENTRY_DSN` must exist for **Preview + Production**
  (DSN is no longer inlined as of `a3bfba8`).
- `SENTRY_AUTH_TOKEN` confirmed in Production; **Preview never
  explicitly checked** — verify.

### i18n completeness script — referenced in CLAUDE.md gate 8
`scripts/check-i18n.ts` does not exist; gate 8 has been outputting
WARN across multiple sessions. Pure TS script, unblocked.

### `/dashboard/payments` empty-state scaffold
Listed as `deliverables_pending` in Phase 6 (`phase-state.json`).
UI-only — doesn't need Tap merchant keys to scaffold an empty state.

### Master notes file (kahramana-conversation-master-notes.md)
Synced through session 93 content in `7f6c1f8`. Does NOT yet
contain session 94 content. The next claude.ai sync should pick it
up, or update manually if claude.ai isn't being used.

### Other unblocked queue items (session 95+ candidates)
- `vercel.json` headers vs `next.config.ts:headers()` — there's
  partial duplication of `X-Frame-Options` etc. across both files.
  Lower priority than CSP because they don't conflict — but worth
  a consolidation pass.
- `/monitoring` tunnel collision check confirmed clean this
  session (middleware matcher correctly excludes it). No action.

## DECISIONS LOGGED
- **F-08 not actively sanitized** — destroying Sentry debugging
  utility to hide route names that are already in
  `_buildManifest.js` is a bad trade. Documented in
  `next.config.ts` comment.
- **No CSP fallback for static asset paths** — accepting the
  standard pattern that asset responses don't need CSP. If we add
  a publicly-reachable HTML route to the middleware exclusion list
  in the future, revisit.
- **DSN moved to env (`NEXT_PUBLIC_SENTRY_DSN`)** — accepts the
  silent-no-op failure mode in exchange for not committing the DSN
  string to git. Mitigation: this LAST-SESSION.md flags the env
  dependency loudly.
- **Single commit for session 94 audit** — phase-state + backlog +
  F-08 comment bundled into `785bc90` rather than three doc commits.

## MEMORY UPDATES
None new this session. Existing memories (esp.
`feedback_sentry_sourcemaps_nextjs15`,
`feedback_orders_delete_fks`) still accurate.

## STATUS
- **TSC**: clean after every commit (verified `npx tsc --noEmit`
  after `a3bfba8` and `4707f7f`).
- **Local `npm run build`**: clean after `4707f7f`. Only warning
  is a pre-existing `@sentry/nextjs` deprecation notice for
  `unstable_sentryWebpackPluginOptions` (carry-over from session
  93, unrelated to this batch).
- **Git**: local `master` == `origin/master` (last push:
  `7f6c1f8`).
- **Migrations**: no new migrations this session. 122 still the
  latest. Phase-state registry now matches disk (114 + 115
  backfilled).
- **Working tree**: clean at end of session.
