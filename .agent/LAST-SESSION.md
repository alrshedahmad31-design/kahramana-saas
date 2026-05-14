# LAST-SESSION.md — Kahramana Baghdad
> Session 104: CI red on every push (lockfile drift from next-intl v4) + Sentry `parentNode` crash on /menu (Clarity snippet). Both root-caused and fixed. 2 commits pushed, master at `b6faf06`. E2E green again.
> Date: 2026-05-14
> Author: Claude Code (Opus 4.7)

## SESSION 104 — SUMMARY

Two commits made this session (1ef49c9, b6faf06), both pushed to origin/master. E2E Tests workflow verified green post-push (run 25863209506, Auth E2E in 1m20s — vs. the 12–20s install-step failures that had been red on every push since 0f95f5a / next-intl v4 upgrade).

Items closed this session:

- **E2E CI red since 0f95f5a (next-intl v3→v4)** — `npm ci` failing in CI with `Missing: @swc/helpers@0.5.21 from lock file`. Root cause: `next@15.5.18` hard-pins `@swc/helpers@0.5.15` while `next-intl@4.12.0`'s nested `@swc/core@1.15.33` has peer `>=0.5.17`. Windows local `npm install` tolerates the mismatch (warns) and never updates the lockfile; Linux CI's `npm ci` aborts. First-attempt fix (`rm -rf node_modules && npm install`) produced **zero lockfile delta** — local resolver had nothing to change. Real fix in commit `1ef49c9`: added `"@swc/helpers": "^0.5.17"` to `package.json` `overrides`, which forced `npm install` to hoist `0.5.21` everywhere. `npm ls @swc/helpers` clean, no peer warnings. Pattern saved to memory as `feedback_npm_peer_override_pattern.md` for next time.

- **Sentry `TypeError: Cannot read properties of null (reading 'parentNode')` on /menu** — Could not pull live stack trace (`SENTRY_AUTH_TOKEN` in shell env returns 401 — expired/wrong scope). Static analysis: the only `.parentNode` access in `src/` is the inline Microsoft Clarity bootstrap snippet at `src/components/layout/Analytics.tsx:56`, doing `y.parentNode.insertBefore(t, y)` where `y = document.getElementsByTagName('script')[0]`. Under Next.js 15 App Router + `strategy="afterInteractive"`, React can detach the first script during hydration; `y.parentNode` then null → throw. Cart drawer ruled out (no `.parentNode` references anywhere in CartDrawer.tsx). Fixed in commit `b6faf06`: guarded with `if(y && y.parentNode){…}else{(l.head||l.body||l.documentElement).appendChild(t);}` — keeps Clarity loading in the rare null case rather than silently dropping it.

Also done this session (smaller items):

- **Turbopack stale-module debugging** — User reported cart still showing old single-CTA layout after `783d1f3` despite `.next` wipes and dev server restarts. Root cause is a known Turbopack module-registry bug (in-browser registry serves stale component code). User worked around by running `next dev` (webpack mode) without `--turbopack`. Added `dev:webpack` escape-hatch script to `package.json` (hitchhiked into commit `1ef49c9`'s diff — see Decisions below).

- **Backlog created** — New file `.agent/BACKLOG.md` (didn't previously exist) tracking the GitHub Actions Node-24 forced upgrade due **2026-06-02**: bump every `actions/*@v4` in `.github/workflows/` to `@v5`. Files affected: `e2e.yml`, `playwright.yml`.

## COMMITS THIS SESSION (in order)

| Hash | Subject |
|---|---|
| `1ef49c9` | fix(deps): override @swc/helpers >=0.5.17 — resolve CI lockfile drift |
| `b6faf06` | fix(analytics): guard Clarity parentNode null — fixes Sentry crash |

Both pushed (`git push` succeeded, `783d1f3..b6faf06 master -> master`).

## MIGRATIONS APPLIED TO PROD (session 104)

None. No SQL touched this session.

## DECISIONS LOGGED

- **`@swc/helpers` override pinned to `^0.5.17` (not `0.5.21` exact)** — CI was complaining specifically about 0.5.21, but the actual constraint is `>=0.5.17`. Caret range lets npm pick the latest patch (0.5.21 at resolution time) without us re-pinning when @swc bumps. Risk: low; `@swc/helpers` is a tiny runtime helpers library, patch bumps don't break.
- **Clarity null-path = head/body fallback, not silent drop** — User suggested `if (y && y.parentNode) { y.parentNode.insertBefore(t, y); }`. I added an `else { (l.head||l.body||l.documentElement).appendChild(t); }` branch so the analytics script still loads when the first-script-detached race happens, rather than getting silently skipped. Same outcome the original vendor snippet would have if it didn't throw.
- **`dev:webpack` script hitchhiked into commit `1ef49c9`** — User's deps recipe ran `git add package.json package-lock.json`, which captured both the override AND a `dev:webpack` script line I had added earlier (with prior approval, uncommitted). The commit message references only the deps fix; the dev:webpack line is innocuous. Called out transparently in-session; user did not request a split. Future amend if message/diff symmetry matters.
- **Sentry investigated without live API access** — Token in shell env (`SENTRY_AUTH_TOKEN`) returns 401. Root cause derived from static `grep` of `parentNode` references across `src/` — found exactly one match (the Clarity snippet). High-confidence diagnosis without the stack trace; verified by absence of any DOM-manipulation code paths in the cart components.

## STATUS AT SESSION END

- **TSC**: not re-run this session (no `.ts`/`.tsx` other than the 1-line Clarity edit which is inside a template string — no type surface changed)
- **Build**: not re-run this session
- **CI**: ✅ **E2E Tests green** — run 25863209506 (b6faf06) passed Auth E2E in 1m20s. Realtime RLS Tests job remains skipped (gated on `vars.E2E_ENABLED == 'true'`, unset)
- **Migrations**: LOCAL=144 | REMOTE=144 (unchanged from session 103 close — session 103 added 142, session ?? added 143/144 via cowork before this session)
- **Git**: master at `b6faf06`, pushed and synced with origin
- **Working tree**: many pre-existing dirty/untracked files unchanged by this session. New uncommitted from THIS session:
  - `.agent/LAST-SESSION.md` (modified for this writeup)
  - `.agent/BACKLOG.md` (NEW)
  - `package.json` still carries the `dev:webpack` line — *already in the committed override*; the working-tree diff resolves to zero against HEAD now

## OPEN CARRY-FORWARD

### Operator actions (Ahmed)
- 🟠 **`SENTRY_AUTH_TOKEN` rotation** — current token returns 401 against the Sentry API. If Claude is to investigate future Sentry issues, rotate via Sentry org settings and update local env. Org `kahramana-4f`, project `javascript-nextjs`.
- 🟠 **`npx supabase migration repair --status applied 125 129 130 139 140 141 142 143 144 --linked`** — carried from session 103, expand to include 143/144 added since
- 🟠 **Populate `TAP_WEBHOOK_ALLOWED_IPS` in Vercel prod env** (carried from 103)
- 🟠 **Triage `سندويش/`** — still untracked (carried from 102+)
- 🟠 Cloudflare DNS → Vercel for kahramanat.com (carried)
- 🟠 Tap merchant keys + Turnstile keys in Vercel env (carried)
- 🟠 Supabase Free → Pro toggle (carried)

### Dev actions (session 105)
- **Verify Clarity fix landed in next deploy** — Sentry should stop grouping new `parentNode` events to this issue after the b6faf06 release tag ships. Existing event group will auto-resolve in Sentry once no new events come in.
- **Backlog 2026-06-02** — Bump `actions/*@v4 → @v5` in `.github/workflows/e2e.yml` and `playwright.yml`. See `.agent/BACKLOG.md` for the full note.
- **Investigate Realtime RLS Tests job** — currently always skipped because `vars.E2E_ENABLED` is unset on the staging env. Either set the var or remove the gate so the job actually runs.
- **Decide on Sentry CLI auth** — `npx sentry-cli` is available and works; just need a valid token. Could be stored as a `.sentryclirc` (gitignored) or in `SENTRY_AUTH_TOKEN` env if Ahmed wants Claude to triage future issues from terminal.
- **Optional commit cleanup** — `.agent/BACKLOG.md` + `LAST-SESSION.md` writeup are uncommitted; can fold into the next batched chore commit.

### Long-blocked (external)
- Meta verification → Sprint 6B (WhatsApp API)
- CBB merchant approval → Sprint 6C (Benefit Pay native)
- Deliverect contract → Phase 7b

## SESSION 105 — STARTING POINT

1. Confirm Sentry `parentNode` issue is auto-resolving in production post-b6faf06 deploy (check via Sentry UI — Claude can't access until token rotation)
2. If user wants strict commit hygiene, optionally split commit `1ef49c9` to extract `dev:webpack` into its own chore commit (low priority — diff is 1 line)
3. Triage backlog: workflow Node-24 upgrade (`.agent/BACKLOG.md`) — well before 2026-06-02
4. Commit `.agent/BACKLOG.md` + this `LAST-SESSION.md` writeup
5. Next vulns from PCI/audit backlog

## MEMORY ADDS (session 104)

- `feedback_npm_peer_override_pattern.md` — When CI's `npm ci` fails with "Missing: X@Y from lock file" but local `npm install` is clean: transitive peer range conflicts with another dep's hard pin. Fix via `overrides` in package.json, not by re-running install.
- `feedback_turbopack_module_registry_stale.md` — (added at session start) Deeper Turbopack bug: in-browser module registry can serve OLD component code even after `.next` delete + dev server restart. Fix: drop `--turbopack` and run `npx next dev` (webpack).
