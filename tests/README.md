# E2E Test Suite — Run Locally in 5 Minutes

60 Playwright specs covering auth, RBAC, middleware, invite, password reset, and
Realtime/RLS. They skip cleanly when `.env.test` is missing — that's the current
state. Follow the steps below to make them runnable.

## What you need
- A Supabase project (staging preferred; production is acceptable — test users
  are auto-namespaced under `*@test.kahramana` and auto-deleted after the run)
- Service-role key for that project
- Local repo with deps installed (`npm install`)
- Playwright browsers (`npx playwright install chromium`)

## Setup — one-time

### 1. Create `.env.test`
```bash
cp .env.test.example .env.test
```

Then open `.env.test` and replace the three placeholders:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` `secret` key (⚠ keep private) |

Leave `E2E_BASE_URL` and `E2E_TEST_PASSWORD` at their defaults unless you want
to run against Vercel (set `E2E_BASE_URL=https://kahramana.vercel.app`).

### 2. Verify Realtime is enabled (one-time)
The `realtime-rls.spec.ts` suite requires the Supabase Realtime publication to
include `orders` and `order_items`. Run once in Supabase SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
```

If they're already members, the statement is a no-op (it just errors with
"relation already exists in publication" — safe to ignore).

### 3. Install Playwright browsers (one-time)
```bash
npx playwright install chromium
```

That's it. The 6 test users get auto-provisioned the first time the suite runs.

---

## Run

| Command | What it does |
|---|---|
| `npm run test:e2e` | Full suite (auth + realtime) — ~3 min |
| `npm run test:e2e:auth` | 49 auth specs only — ~2 min, **headed Chrome** |
| `npm run test:e2e:realtime` | 11 RLS/realtime specs — ~30 s, no browser |
| `npx playwright test --ui` | Interactive UI mode |
| `npx playwright show-report` | Open HTML report after a run |

**Note:** Playwright auto-starts `npm run dev` on port 3000 the first time it
runs (~30 s warm-up). Subsequent runs reuse the running server.

---

## Architecture

```
tests/
├── global-setup.ts        # Creates 6 test users via Supabase Admin API
├── global-teardown.ts     # Deletes them + any e2e-invite-* leftovers
├── fixtures/
│   ├── users.ts           # Test user matrix + env loader
│   └── auth-helpers.ts    # loginAs(), logout(), cookie assertions
└── e2e/
    ├── auth/              # 49 specs — login, logout, middleware, RBAC, invite, reset
    └── realtime-rls.spec.ts  # 11 specs — RLS isolation + realtime channel
```

### Test user matrix (auto-created on first run)

| Email | Role | Branch |
|---|---|---|
| `e2e-owner@test.kahramana` | `owner` | — (global) |
| `e2e-manager@test.kahramana` | `general_manager` | — (global) |
| `e2e-branch-mgr@test.kahramana` | `branch_manager` | `riffa` |
| `e2e-cashier-riffa@test.kahramana` | `cashier` | `riffa` |
| `e2e-cashier-qallali@test.kahramana` | `cashier` | `qallali` |
| `e2e-driver@test.kahramana` | `driver` | `riffa` |

All share `E2E_TEST_PASSWORD` (default `E2eTest!2026`). Don't reuse this
password anywhere else.

---

## Failure recovery

| Symptom | Cause | Fix |
|---|---|---|
| `[E2E setup] env vars missing — skipping` warning | `.env.test` not found / values empty | Re-check step 1 |
| All specs marked **skipped** | Same as above | Same |
| `createUser failed: User already registered` | Stale users from a crashed teardown | Run `npm run test:e2e:teardown` (or delete manually in Supabase Studio) |
| `realtime channel timeout` | Realtime publication missing tables | Re-run the `ALTER PUBLICATION` from step 2 |
| `redirect to /login?error=no_staff_profile` in invite spec | `staff_basic` upsert failed (FK to non-existent branch) | Confirm branches `riffa` and `qallali` exist (`SELECT id FROM branches`) |
| Headed browser flashes red on AR text rendering | Cairo / Almarai font not loaded yet (race condition on first run) | `npm run dev` once standalone, then run tests |

---

## CI

`.github/workflows/e2e.yml` runs the suite on push to `master`. It needs these
GitHub repository **secrets**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_TEST_PASSWORD`

And one repository **variable** (not secret):

- `E2E_ENABLED=true` — gates the workflow on/off

Workflow uses `environment: staging` so secrets are scoped per env.

---

## Adding a new spec

1. Drop a `.spec.ts` file in `tests/e2e/auth/` or create a new sub-folder
2. Import helpers: `import { loginAs, expectAuthCookiesPresent } from '../../fixtures/auth-helpers'`
3. Reference test users via `TEST_USERS.cashierRiffa` etc.
4. Skip-guard at the top of every spec:

   ```ts
   import { test } from '@playwright/test'
   import { E2E_CONFIGURED } from '../../fixtures/users'

   test.skip(!E2E_CONFIGURED, 'Requires .env.test — see tests/README.md')
   ```

5. Run `npx playwright test path/to/your.spec.ts --headed` to debug
