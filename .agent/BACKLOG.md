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
