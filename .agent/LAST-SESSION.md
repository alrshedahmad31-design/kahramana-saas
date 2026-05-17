# LAST-SESSION.md — Kahramana Baghdad
> Session 144: Public-surface hygiene audit + T3 cleanup. 6 commits
> landed (bc0811c session-143 carry + c55f0c9 + 94e01c0 + 4444c3d +
> 67f9f59 + a572bdb). All 9 gates green at HEAD. Two P2s deferred to
> BACKLOG.md.
> Date: 2026-05-18
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 144 — SUMMARY

Long session that pivoted from a stale pending-list to a real audit.
The user's opening prompt listed four "pending dev items" — all four
were already merged on master. Verified each against disk + git log,
flagged the discrepancy, then took a fresh direction.

### Phase 1 — Carry-over commits

Pushed session-143's chore commit (`bc0811c`) that was sitting unpushed
on master since the prior session close-out. Then dropped the
`as unknown as Record<string, never>` cast on the `notified_at` UPDATE
in `src/app/api/cron/birthday-notify/route.ts` — `src/lib/supabase/types.ts`
already had the column on `birthday_point_credits.Update` thanks to
session 142's MCP regen. One commit (`c55f0c9`).

**Self-inflicted stumble**: my first attempt used `git commit -am`
which staged the dirty `.agent/CURRENT-SESSION.md` + `LAST-SESSION.md`
alongside the route fix. Caught it before pushing, ran
`git reset --soft HEAD~1 && git restore --staged .`, then staged the
route file by name. Hit the "git add -p always — never stage sibling
work" rule. Lesson re-learned.

### Phase 2 — The phantom audit list

User asked to "surface the 19 P2 findings from session 141's
public-audit list". After grepping `.agent/`, `docs/audit/`,
`BACKLOG.md`, and every commit message: **the list never existed in
the repo**. The bridge file (`.agent/CLAUDE-AI-CONTEXT.md`)
referenced it as a candidate next-lane but the actual triage was
presumably done in a Claude.ai conversation and never persisted.

Offered the user two options: (a) paste the list from wherever it
lived, or (b) generate a fresh public-surface hygiene scan. They
chose (b).

### Phase 3 — Fresh public-surface audit

Spawned a general-purpose subagent with a scoped prompt covering all
public routes (`/`, `/menu`, `/branches`, `/about`, `/contact`,
`/reserve`, `/catering`, `/order/[id]`, `/account/**`, `/checkout`,
`/payment/[orderId]`, `/login`) plus their server actions and
customer-triggered API routes. Out of scope: dashboard, driver, waiter,
clock, KDS, POS, cron, webhooks.

Output landed at `.agent/public-audit-2026-05-18.md`:

- **0 P0** (deploy blockers) — session-142 T1/T2 visibly raised the floor
- **6 P1** (this sprint) — PUB-001 / 002 / 003 / 004 / 013 / 014
- **9 P2** (hygiene) — PUB-005 / 006 / 007 / 008 / 009 / 010 / 011 /
  012 / 015
- **Total: 15 findings**

Each finding cites a file + line, evidence, P-rating rationale, and a
one-sentence suggested fix. Read-only, no code touched in this phase.

### Phase 4 — Batched execution (T3-A and T3-B)

Per the user's instruction: one commit per logical P1 group, all P2s
folded into a single hygiene commit, TSC clean after each.

**T3-A1 — fail-closed login surfaces** (`94e01c0`, 2 files, +75/−49):
- `account/login/actions.ts`: `verifyTurnstile` returns false in
  production when secret unset; `checkRateLimit` (login/register)
  + `checkEmailRateLimit` capture-message + return false when Upstash
  unset; try/catch wraps the limit calls.
- `forgot-password/actions.ts`: same pattern on `verifyTurnstile` +
  `checkRateLimit`. Adds `import * as Sentry from '@sentry/nextjs'`
  to the file.

Closes PUB-003, PUB-004, PUB-014 + the note-155 forgot-password
Turnstile fall-through (audit ID was scoped to one file, the actual
defect was on two). Mirrors the staff `/login` + contact/reserve
post-T1 pattern.

**T3-A2 — Sentry on /payment page** (`4444c3d`, 1 file, +12/−3):
Replaced two `console.warn` / `console.error` calls in
`payment/[orderId]/page.tsx` with `Sentry.captureException` with
stage tags (`payment_page.order_fetch`, `payment_page.fatal`). Closes
PUB-001. CLAUDE.md "No console.error swallowing" rule.

**T3-A3 — force-dynamic pin** (`67f9f59`, 4 files, +20/−0):
Added `export const dynamic = 'force-dynamic'` to
`/order/[id]/page.tsx`, `/payment/[orderId]/page.tsx`,
`/account/page.tsx`, `/checkout/page.tsx`. Each gets a 3-line comment
explaining the structural-pin reasoning. Closes PUB-013.

**T3-B — P2 hygiene pass + PUB-002** (`a572bdb`, 9 files, +111/−30):
- New `src/lib/validation/phone.ts` exports `PUBLIC_PHONE_RE`.
- Contact / reserve / catering imports from the shared module
  (PUB-015).
- PUB-002 (P1, folded in): UUID regex guard on `/payment/[orderId]`
  `orderId` param before the Supabase round-trip. Same gate as
  `/order/[id]/page.tsx:48`.
- PUB-005: `registerSchema` Zod object replaces ad-hoc manual checks
  in registerAction. Specific error codes derived from
  `parsed.error.flatten().fieldErrors`.
- PUB-006: `.max(50)` on contact `branch_id`.
- PUB-008: `q` searchParam clamped to 100 chars before passing to
  MenuPageClient.
- PUB-010: `.max(72)` on `newPassword` in setPasswordAction with a
  `too_long` error code (matches loginSchema, matches bcrypt limit).
- PUB-011: `checkSetPasswordRateLimit` — 5/15m sliding window keyed on
  the live-session user id. Fail-closed in production when Upstash
  unset.
- PUB-012: `Sentry.captureException` in `checkout/error.tsx`
  `useEffect`, alongside the console reference (kept as a comment-free
  trail).
- Three P2s **not** in this commit:
  - PUB-007 (RPC SQLSTATE refactor — needs migration; deferred to
    `.agent/BACKLOG.md`)
  - PUB-009 (narrow row type for `/order/[id]` — ~15-line refactor;
    deferred to BACKLOG.md)
  - PUB-002 was actually a P1, folded into the P2 batch since it
    lives on the same surface as PUB-001 from T3-A2. Loud in the
    commit message.

### Phase 5 — Close-out (this session)

- Appended PUB-007 + PUB-009 to `.agent/BACKLOG.md` with full audit
  context (severity, file, evidence, suggested fix, why-deferred).
- Refreshed `.agent/CLAUDE-AI-CONTEXT.md`: header bumped to session 144;
  CURRENT STATUS posture sentence updated; the stale "Tier 3 hygiene
  — 19 P2 findings from the session-141 public-audit list" candidate
  removed (replaced by PUB-007 / 009 reference); "Type regen drop"
  candidate removed (closed by `c55f0c9`); two new architecture
  decisions added (force-dynamic pin, shared phone regex); session
  144 added to CLOSED list and SESSION HISTORY.
- Regenerated `.agent/CURRENT-SESSION.md` via
  `pwsh .agent/sync-context.ps1`.
- One close-out commit covering BACKLOG + CLAUDE-AI-CONTEXT +
  LAST-SESSION + CURRENT-SESSION.

### Files changed across the session

```
new:
  .agent/public-audit-2026-05-18.md          (Phase 3 deliverable)
  src/lib/validation/phone.ts                (T3-B PUB-015)

modified — code:
  src/app/api/cron/birthday-notify/route.ts            (c55f0c9)
  src/app/[locale]/account/login/actions.ts            (94e01c0 + a572bdb)
  src/app/[locale]/forgot-password/actions.ts          (94e01c0)
  src/app/[locale]/payment/[orderId]/page.tsx          (4444c3d + 67f9f59 + a572bdb)
  src/app/[locale]/order/[id]/page.tsx                 (67f9f59)
  src/app/[locale]/account/page.tsx                    (67f9f59)
  src/app/[locale]/checkout/page.tsx                   (67f9f59)
  src/app/[locale]/contact/actions.ts                  (a572bdb)
  src/app/[locale]/reserve/actions.ts                  (a572bdb)
  src/app/[locale]/catering/actions.ts                 (a572bdb)
  src/app/[locale]/menu/page.tsx                       (a572bdb)
  src/app/[locale]/set-password/actions.ts             (a572bdb)
  src/app/[locale]/checkout/error.tsx                  (a572bdb)

modified — bridge:
  .agent/BACKLOG.md                          (session 144 deferred items)
  .agent/CLAUDE-AI-CONTEXT.md                (session 144 update)
  .agent/CURRENT-SESSION.md                  (auto-regen)
  .agent/LAST-SESSION.md                     (this file)
```

### Commits this session (in order)

```
bc0811c  (push of carry from session 143)
c55f0c9  chore(types): drop notified_at cast in birthday-notify route
94e01c0  fix(security): T3-A1 — fail-closed Turnstile + rate limit on /account/login + /forgot-password
4444c3d  fix(observability): T3-A2 — route /payment page errors through Sentry
67f9f59  fix(rendering): T3-A3 — pin force-dynamic on per-user authenticated pages
a572bdb  chore(hygiene): T3-B — public-surface P2 cleanup pass (7 items) + PUB-002
[session-144 close-out commit]
```

### Decisions worth remembering

- **Generated a new audit because the referenced one didn't exist.**
  The bridge cited a "session-141 public-audit list" but session 141
  was the mobile-responsiveness sweep — no audit doc was produced
  then. Phantom reference. Fresh audit replaces it cleanly.
- **PUB-002 (P1) folded into T3-B (P2 batch)** rather than shipped as
  a separate A4. Cost of a 4th P1 commit didn't justify itself for a
  3-line UUID guard on the same surface as PUB-001. Surfaced loudly
  in the commit body.
- **PUB-007 + PUB-009 deferred to BACKLOG.md** rather than shipped.
  Ground rule: "no migrations unless strictly required" (PUB-007);
  P2 hygiene with 15-line refactor cost (PUB-009). Both fully
  documented for the next hygiene lane.
- **Forgot-password Turnstile bundled into T3-A1** even though the
  audit ID PUB-014 was scoped to `account/login`. The same defect
  shape lived in `forgot-password/actions.ts:13-16` (note 155 in the
  audit). Single commit handles both since they're the same
  architectural pattern.

## OPERATOR PENDING (unchanged from session 142/143)

- Supabase Free → Pro + Singapore migration
- Resend domain verification for kahramanat.com
- 13 staff emails from owner → run staff seed (migration 090)
- TAP merchant keys → wire refund
- WhatsApp Business API + Meta verification
- Benefit Pay merchant approval (CBB)
- ~12 missing dish photos (shoot list in `da5b199`)

## NEXT SESSION

- Optional: tackle PUB-007 + PUB-009 from BACKLOG together as a single
  hygiene lane (one migration + one type refactor; both small, both
  hygiene-tier, no production behaviour change).
- Optional: re-run the public-surface audit subagent on dashboard
  routes — same methodology, T1/T2/T3 already cleared on the customer
  side, dashboard side has its own audit history (v3 + v4 from
  session 105 + 97). Probably yields fewer than 15 findings given the
  recent session-137-140 sweeps.
- Push the session-144 close-out commit when this session ends.

Posture: customer login + register + password-reset + set-password
now all fail closed in production under env-var misconfiguration.
Per-user authenticated pages pinned to dynamic. Shared phone
validation in one module. All 9 gates green at HEAD.
